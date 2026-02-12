export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type RequestType = 'READ' | 'WRITE';

interface QueuedRequest {
    priority: Priority;
    type: RequestType;
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
}

export class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private maxTokens: number;
    private refillRate: number; // tokens per ms

    constructor(rps: number) {
        this.maxTokens = rps;
        this.tokens = rps;
        this.refillRate = rps / 1000;
        this.lastRefill = Date.now();
    }

    async consume(): Promise<void> {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }
        const waitTime = (1 - this.tokens) / this.refillRate;
        await new Promise(r => setTimeout(r, waitTime));
        return this.consume();
    }

    private refill() {
        const now = Date.now();
        const delta = now - this.lastRefill;
        this.tokens = Math.min(this.maxTokens, this.tokens + delta * this.refillRate);
        this.lastRefill = now;
    }

    getUsage(): number {
        this.refill();
        return (this.maxTokens - this.tokens) / this.maxTokens;
    }
}

export class RequestScheduler {
    private readBucket: TokenBucket;
    private writeBucket: TokenBucket;
    private queue: QueuedRequest[] = [];
    private processing = false;

    constructor(readRps: number, writeRps: number) {
        this.readBucket = new TokenBucket(readRps);
        this.writeBucket = new TokenBucket(writeRps);
    }

    async enqueue<T>(priority: Priority, type: RequestType, task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const request: QueuedRequest = { priority, type, task, resolve, reject };
            this.queue.push(request);
            this.sortQueue();
            this.processQueue();
        });
    }

    private sortQueue() {
        const priorityMap: Record<Priority, number> = {
            'CRITICAL': 0,
            'HIGH': 1,
            'NORMAL': 2,
            'LOW': 3
        };
        this.queue.sort((a, b) => priorityMap[a.priority] - priorityMap[b.priority]);
    }

    private async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const req = this.queue[0]; // Peek
            const bucket = req.type === 'READ' ? this.readBucket : this.writeBucket;

            // Circuit Breaker: Soft Limit Check
            const usage = bucket.getUsage();
            if (usage > 0.9 && req.priority === 'LOW') {
                // Defer low priority if near limit
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            await bucket.consume();
            this.queue.shift(); // Remove from queue

            try {
                const result = await this.executeWithRetry(req.task);
                req.resolve(result);
            } catch (error) {
                req.reject(error);
            }
        }

        this.processing = false;
    }

    private async executeWithRetry(task: () => Promise<any>, retries = 3): Promise<any> {
        try {
            return await task();
        } catch (error: any) {
            const statusCode = error?.status || error?.response?.status || 0;
            const isRateLimit = statusCode === 429 || error?.message?.includes('429');
            const isServerError = statusCode >= 500 || error?.message?.includes('ResponseError') || error?.message?.includes('timeout');

            // Enhanced error logging
            console.error(`[Scheduler] Error Details:`, {
                statusCode,
                message: error?.message,
                name: error?.name,
                responseBody: error?.response?.data || error?.data,
                stack: error?.stack?.split('\n').slice(0, 3).join('\n')
            });

            if (retries > 0 && (isRateLimit || isServerError)) {
                const baseWait = isRateLimit ? 2000 : 1000;
                const wait = baseWait * Math.pow(2, 3 - retries) + Math.random() * 1000;

                console.warn(`[Scheduler] ${isRateLimit ? '429 Rate Limit' : 'Transient Error'} Error (${statusCode}). ` +
                    `Retry ${4 - retries}/3 in ${wait.toFixed(0)}ms...`);

                await new Promise(r => setTimeout(r, wait));
                return this.executeWithRetry(task, retries - 1);
            }
            throw error;
        }
    }

    getHealth() {
        return {
            readUsage: this.readBucket.getUsage(),
            writeUsage: this.writeBucket.getUsage(),
            queueSize: this.queue.length,
            circuitBroken: this.readBucket.getUsage() > 0.95 || this.writeBucket.getUsage() > 0.95
        };
    }
}

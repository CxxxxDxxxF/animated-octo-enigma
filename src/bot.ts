import { Kalshi } from 'pmxtjs';
import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { RequestScheduler } from './scheduler';
import { KalshiProfileService } from './profileService';
import { KalshiSocialService } from './socialService';

dotenv.config();

export interface BotConfig {
    kalshiQuery: string;
    pollIntervalMs: number;
    apiPort?: number;
    maxRiskPerTrade: number;
    maxTotalExposure: number;
    dailyStopLossLimit: number;
    minVolume24h: number;
    autoTradeEnabled: boolean;
    socialConvolutionEnabled: boolean;
}

export interface PendingOrder {
    orderId: string;
    marketId: string;
    outcomeId: string;
    side: 'buy' | 'sell';
    price: number;
    size: number;
    timestamp: number;
}

export interface BotState {
    kalshiBalance: number;
    initialDailyBalance: number;
    currentExposure: number;
    dailyPL: number;
    lastPollTime: string;
    status: 'idle' | 'polling' | 'executing' | 'error' | 'stopped';
    activeExchanges: string[];
    errorCount: number;
    lastError?: string;
    monitoredMarkets: any[];
    tradeHistory: any[];
    executionSignals: any[];
    autoTradeEnabled: boolean;
    consoleLogs: string[];
    priceHistories: Record<string, number[]>;
    activePositions: any[];
    pendingOrders: PendingOrder[];
    marketNameCache: Record<string, string>;
    cancelCount: number;
    lastCancelHaltUntil?: number;
    filledOrdersHistory: Record<string, { price: number, avgPrice?: number, totalSize?: number, time: number }>;
    schedulerHealth?: {
        readUsage: number;
        writeUsage: number;
        queueSize: number;
        circuitBroken: boolean;
    };
}

export class ArbitrageBot {
    private kalshi?: Kalshi;
    private config: BotConfig;
    private isRunning: boolean = false;
    private lastPrices: Map<string, number> = new Map();
    private scheduler: RequestScheduler;
    private profileService: KalshiProfileService;
    private socialService: KalshiSocialService;
    private state: BotState;

    constructor(config: BotConfig) {
        this.config = config;
        this.state = {
            kalshiBalance: 0,
            initialDailyBalance: 0,
            currentExposure: 0,
            dailyPL: 0,
            lastPollTime: 'Never',
            status: 'idle',
            activeExchanges: [],
            errorCount: 0,
            monitoredMarkets: [],
            tradeHistory: [],
            executionSignals: [],
            autoTradeEnabled: config.autoTradeEnabled,
            consoleLogs: [],
            priceHistories: {},
            activePositions: [],
            pendingOrders: [],
            marketNameCache: {},
            cancelCount: 0,
            filledOrdersHistory: {}
        };

        if (process.env.KALSHI_API_KEY && process.env.KALSHI_PRIVATE_KEY) {
            this.kalshi = new Kalshi({
                apiKey: process.env.KALSHI_API_KEY,
                privateKey: process.env.KALSHI_PRIVATE_KEY
            });
            this.state.activeExchanges.push('kalshi');
        }

        this.scheduler = new RequestScheduler(20, 10);
        this.profileService = new KalshiProfileService(this.kalshi!, this.scheduler);
        this.socialService = new KalshiSocialService(this.kalshi!, this.scheduler);

        // Global Error Safety Nets
        process.on('unhandledRejection', (reason, promise) => {
            this.log(`⚠️ UNHANDLED REJECTION: ${reason}`);
        });

        process.on('uncaughtException', (error) => {
            this.log(`🔥 UNCAUGHT EXCEPTION: ${error.message}`);
            // Give time for logs to flush
            setTimeout(() => process.exit(1), 500);
        });

        if (this.config.apiPort) {
            this.setupApi();
        }

        this.loadState();
    }

    private saveState() {
        try {
            const fs = require('fs');
            const data = {
                kalshiBalance: this.state.kalshiBalance,
                initialDailyBalance: this.state.initialDailyBalance,
                currentExposure: this.state.currentExposure,
                dailyPL: this.state.dailyPL,
                activePositions: this.state.activePositions,
                pendingOrders: this.state.pendingOrders,
                marketNameCache: this.state.marketNameCache,
                executionSignals: this.state.executionSignals,
                autoTradeEnabled: this.config.autoTradeEnabled,
                filledOrdersHistory: this.state.filledOrdersHistory
            };
            fs.writeFileSync('bot_state.json', JSON.stringify(data, null, 2));
        } catch (e) {
            // Log to console only to avoid infinite loop if log uses state
            console.error('Failed to save state:', e);
        }
    }

    private loadState() {
        try {
            const fs = require('fs');
            if (fs.existsSync('bot_state.json')) {
                const data = JSON.parse(fs.readFileSync('bot_state.json', 'utf8'));
                this.state = {
                    ...this.state,
                    ...data,
                    // Ensure autoTradeEnabled syncs with config
                    autoTradeEnabled: this.config.autoTradeEnabled
                };
                this.log('💾 State restored from bot_state.json');
            }
        } catch (e) {
            this.log('⚠️ Failed to load state: ' + e);
        }
    }

    private log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        const formatted = `[${timestamp}] ${message}`;
        console.log(formatted);
        this.state.consoleLogs = [...this.state.consoleLogs, formatted].slice(-50);
    }

    private setupApi() {
        const app = express();
        app.use(cors());
        app.use(express.json());

        app.get('/api/state', (req, res) => res.json(this.state));

        // Profile (Phase 2)
        app.get('/api/kalshi/tracked-profiles', async (req, res) => {
            try { res.json(await this.profileService.getTrackedProfiles()); } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        app.get('/api/kalshi/profiles/:profileKey', async (req, res) => {
            try { res.json(await this.profileService.resolveProfile(req.params.profileKey)); } catch (e: any) { res.status(404).json({ error: e.message }); }
        });

        app.post('/api/kalshi/profiles/:profileKey/track', async (req, res) => {
            try { await this.profileService.trackProfile(req.params.profileKey); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        app.delete('/api/kalshi/profiles/:profileKey/track', async (req, res) => {
            try { await this.profileService.untrackProfile(req.params.profileKey); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        app.get('/api/kalshi/profiles/:profileKey/snapshots', async (req, res) => {
            try {
                const range = req.query.range === '30d' ? 30 : 7;
                res.json(await this.profileService.getSnapshots(req.params.profileKey, range));
            } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        // Social (Phase 3)
        app.get('/api/social/leaderboard', async (req, res) => {
            try { res.json(await this.socialService.getLeaderboard((req.query.type as any) || 'profit')); } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        app.get('/api/social/profile/:profileId', async (req, res) => {
            try { res.json(await this.socialService.getProfileStats(req.params.profileId)); } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        app.post('/api/social/profile/:profileId/track', async (req, res) => {
            try { await this.socialService.trackProfile(req.params.profileId, req.body.username || req.params.profileId); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        app.delete('/api/social/profile/:profileId/track', async (req, res) => {
            try { await this.socialService.untrackProfile(req.params.profileId); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        app.get('/api/social/profile/:profileId/snapshots', async (req, res) => {
            try { res.json(await this.socialService.getSnapshots(req.params.profileId, parseInt(req.query.limit as string) || 30)); } catch (e: any) { res.status(500).json({ error: e.message }); }
        });

        app.post('/api/config/toggle-auto', (req, res) => {
            this.config.autoTradeEnabled = !this.config.autoTradeEnabled;
            this.state.autoTradeEnabled = this.config.autoTradeEnabled;
            this.log(`${this.config.autoTradeEnabled ? '🟢 AUTO-TRADE ENABLED' : '🔴 AUTO-TRADE DISABLED'} via dashboard`);
            res.json({ enabled: this.config.autoTradeEnabled });
        });

        const port = this.config.apiPort || 3001;
        app.listen(port, () => this.log(`📡 API active on ${port}`));
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.log('🚀 Engine Started');

        await this.updateBalances();
        this.state.initialDailyBalance = this.state.kalshiBalance;

        // Initial discovery run
        await this.socialService.fetchAndCacheLeaderboard().catch(() => { });

        setInterval(async () => {
            await this.profileService.runDailySnapshots().catch(() => { });
            await this.socialService.fetchAndCacheLeaderboard().catch(() => { });
        }, 6 * 60 * 60 * 1000); // Every 6 hours

        const pollLoop = async () => {
            if (!this.isRunning || this.state.status === 'stopped') return;
            this.state.schedulerHealth = this.scheduler.getHealth();
            this.state.status = 'polling';
            try { await this.poll(); this.state.errorCount = 0; } catch (e: any) {
                this.state.status = 'error';
                this.state.errorCount++;
                this.log(`❌ Poll Error: ${e.message}`);
                if (e.message.includes('Unauthorized')) {
                    this.kalshi = new Kalshi({ apiKey: process.env.KALSHI_API_KEY!, privateKey: process.env.KALSHI_PRIVATE_KEY! });
                }
            }
            setTimeout(pollLoop, this.config.pollIntervalMs);
        };
        pollLoop();
    }

    private async updateBalances() {
        if (!this.kalshi) return;
        try {
            const kBalances = await this.scheduler.enqueue('NORMAL', 'READ', () => this.kalshi!.fetchBalance());
            const currentBalance = kBalances[0]?.available || 0;
            this.state.kalshiBalance = currentBalance;


            const positions = await this.scheduler.enqueue('NORMAL', 'READ', () => this.kalshi!.fetchPositions());
            const exchangePositions = positions.filter(p => Math.abs(p.size || 0) > 0);

            const exchangeOutcomeIds = exchangePositions.map(ep => ep.outcomeId);
            for (const localPos of this.state.activePositions) {
                if (!exchangeOutcomeIds.includes(localPos.outcomeId)) {
                    this.log(`🏁 Settled: ${localPos.displayTitle} reached resolution. Updating balance records.`);
                }
            }

            // Sync with local tracking and Mark-to-Market
            this.state.activePositions = await Promise.all(exchangePositions.map(async ep => {
                const localPos = this.state.activePositions.find(lp => lp.outcomeId === ep.outcomeId);
                const history = this.state.filledOrdersHistory[ep.marketId + ep.outcomeId];
                const displayTitle = this.state.marketNameCache[ep.marketId || ''] || localPos?.displayTitle || ep.marketId;

                // Mark-to-Market: Fetch latest price if possible
                let currentPrice = ep.currentPrice || 0;
                try {
                    const book = await this.scheduler.enqueue('LOW', 'READ', () => this.kalshi!.fetchOrderBook(ep.outcomeId));
                    currentPrice = book.bids[0]?.price || 0;
                } catch (e) {
                    currentPrice = localPos?.currentPrice || ep.entryPrice || 0;
                }

                const recoveredEntryPrice = ep.entryPrice || history?.price || localPos?.entryPrice || 0;

                return {
                    ...ep,
                    displayTitle,
                    entryPrice: recoveredEntryPrice,
                    currentPrice: currentPrice,
                    unrealizedPnL: (currentPrice - recoveredEntryPrice) * ep.size,
                    entryTime: localPos?.entryTime || history?.time || Date.now()
                };
            }));

            // Calculate exposure at COST for limit checks
            const posExposureCost = this.state.activePositions.reduce(
                (acc, p) => acc + (Math.abs(p.size || 0) * (p.entryPrice || 0)),
                0
            );

            // Calculate exposure at MARKET for equity tracking
            const posExposureMarket = this.state.activePositions.reduce(
                (acc, p) => acc + (Math.abs(p.size || 0) * (p.currentPrice || 0)),
                0
            );

            const pendingExposure = this.state.pendingOrders.reduce(
                (acc, o) => acc + (o.size * o.price),
                0
            );

            this.state.currentExposure = posExposureCost + pendingExposure;

            // Set initial balance on first run (Baseline Equity = Cash + Positions @ Market)
            if (this.state.initialDailyBalance === 0 && currentBalance > 0) {
                this.state.initialDailyBalance = currentBalance + posExposureMarket;
                this.log(`📊 Initial Baseline Equity set to $${this.state.initialDailyBalance.toFixed(2)}`);
            }

            // Update Daily P/L based on total mark-to-market equity change
            const totalEquity = currentBalance + posExposureMarket;
            this.state.dailyPL = Math.round((totalEquity - this.state.initialDailyBalance) * 100) / 100;
        } catch (e: any) { this.log(`❌ Sync Failed: ${e.message}`); }
    }

    private async poll() {
        try {
            this.state.lastPollTime = new Date().toLocaleTimeString();
            if (!this.kalshi) return;

            this.state.status = 'polling';

            const rawMarkets = await this.scheduler.enqueue('LOW', 'READ', () => this.kalshi!.fetchMarkets({ query: this.config.kalshiQuery, limit: 20 }));
            const qualified = rawMarkets.filter(m => (m.volume24h || 0) >= this.config.minVolume24h);
            const detailed = await Promise.all(qualified.map(async m => {
                const books: any = {};
                for (const o of m.outcomes || []) {
                    try { books[o.outcomeId] = await this.scheduler.enqueue('LOW', 'READ', () => this.kalshi!.fetchOrderBook(o.outcomeId)); } catch { }
                }

                // Extract person name from description for presidential markets
                let displayTitle = m.title;
                if (m.description) {
                    const nameMatch = m.description.match(/If ([A-Z][A-Za-z.\s]{2,}) is the next/);
                    const willMatch = m.description.match(/Will ([A-Z][A-Za-z.\s]{2,}) be the/);

                    if (nameMatch) displayTitle = nameMatch[1].trim();
                    else if (willMatch) displayTitle = willMatch[1].trim();
                }

                this.state.marketNameCache[m.marketId] = displayTitle;

                const cleanedOutcomes = (m.outcomes || []).map((o: any) => ({
                    ...o,
                    label: o.label?.replace(/^::\s*/, '').replace(/\s*::\s*/, ' ') || o.label
                }));

                return { ...m, orderBooks: books, displayTitle, outcomes: cleanedOutcomes };
            }));

            this.state.monitoredMarkets = detailed;

            if (this.config.autoTradeEnabled) {
                await this.updateBalances();
                await this.monitorPendingOrders();
                await this.managePositions(detailed);
                await this.processMarketLogic(detailed);
            }

            this.state.status = 'idle';
            this.saveState();
        } catch (e: any) {
            this.state.status = 'error';
            this.state.lastError = e.message;
            this.log(`❌ Poll Loop Failed: ${e.message}`);
            // Don't crash, just wait for next poll
        }
    }

    private async managePositions(markets: any[]) {
        // Check daily stop-loss
        if (this.state.dailyPL <= -this.config.dailyStopLossLimit) {
            this.log(`🛑 DAILY STOP-LOSS HIT: $${this.state.dailyPL.toFixed(2)}. Auto-trade disabled.`);
            this.config.autoTradeEnabled = false;
            this.state.autoTradeEnabled = false;
            return;
        }

        // Monitor active positions for stop-loss/take-profit
        for (const pos of this.state.activePositions) {
            try {
                const currentBid = pos.currentPrice || 0;
                const positionValue = Math.abs(pos.size) * pos.entryPrice;

                // Stop-loss: -20% of position value
                if (pos.unrealizedPnL < -0.2 * positionValue) {
                    this.log(`🛑 Stop-loss triggered for ${pos.marketId}: $${pos.unrealizedPnL.toFixed(2)}`);
                    await this.closePosition(pos, currentBid);
                }

                // Take-profit: +15% of position value
                else if (pos.unrealizedPnL > 0.15 * positionValue) {
                    this.log(`💰 Take-profit triggered for ${pos.marketId}: $${pos.unrealizedPnL.toFixed(2)}`);
                    await this.closePosition(pos, currentBid);
                }
            } catch (error: any) {
                this.log(`⚠️ Error managing position ${pos.marketId}: ${error.message}`);
            }
        }
    }

    private async processMarketLogic(markets: any[]) {
        // Check exposure limit
        if (this.state.currentExposure >= this.config.maxTotalExposure) {
            this.log(`⚠️ Max exposure reached: $${this.state.currentExposure.toFixed(2)}`);
            return;
        }

        for (const market of markets) {
            if (!market.orderBooks) continue;

            for (const outcomeId in market.orderBooks) {
                const book = market.orderBooks[outcomeId];
                if (!book || !book.bids?.length || !book.asks?.length) continue;

                const bestBid = book.bids[0]?.price || 0;
                const bestAsk = book.asks[0]?.price || 0;
                const mid = (bestBid + bestAsk) / 2;

                await this.evaluateSpreadCapture(market, outcomeId, bestBid, bestAsk, mid);
            }
        }
    }

    private async evaluateSpreadCapture(market: any, outcomeId: string, bBid: number, bAsk: number, mid: number) {
        // Spread capture strategy: Look for wide spreads with good liquidity
        const spread = bAsk - bBid;
        const spreadPct = spread / mid;

        // Criteria for a good spread opportunity:
        // 1. Spread > 5% of mid price
        // 2. Both bid and ask have reasonable size
        // 3. Price is not too extreme (avoid 1¢ or 99¢ markets)
        // [SCALE] Social Convolution Check
        let convMultiplier = 1.0;
        let spreadThreshold = 0.05;

        if (this.config.socialConvolutionEnabled) {
            const sentiment = await this.socialService.getWhaleSentiment(market.marketId);
            if (sentiment.whaleCount > 0) {
                convMultiplier = 1.5 + (sentiment.whaleCount * 0.5); // 2x for 1 whale, 2.5x for 2, etc.
                spreadThreshold = 0.03; // Lower threshold when whales are present
                this.log(`🐳 Whale Conviction Detected for ${market.marketId}: ${sentiment.whaleCount} whales active. Scaling factors: x${convMultiplier}, ${(spreadThreshold * 100).toFixed(1)}% threshold.`);
            }
        }

        if (spreadPct > spreadThreshold && mid > 0.05 && mid < 0.95) {
            const book = market.orderBooks[outcomeId];
            const bidSize = book.bids[0]?.size || 0;
            const askSize = book.asks[0]?.size || 0;

            // Check if there's enough liquidity (at least 100 contracts)
            if (bidSize >= 100 && askSize >= 100) {
                // Calculate potential trade size (respecting max risk per trade and scaling)
                const baseMaxContracts = Math.floor(this.config.maxRiskPerTrade / bAsk);
                const tradeSize = Math.min(Math.floor(baseMaxContracts * convMultiplier), 200); // Cap at 200 for safety

                if (tradeSize > 0 && this.state.currentExposure + (tradeSize * bAsk) <= this.config.maxTotalExposure) {
                    const displayName = market.displayTitle || market.marketId;
                    this.log(`📊 SPREAD OPPORTUNITY: ${displayName}`);
                    this.log(`   Spread: ${(spreadPct * 100).toFixed(2)}% | Bid: ${(bBid * 100).toFixed(1)}¢ | Ask: ${(bAsk * 100).toFixed(1)}¢`);
                    this.log(`   Potential: ${tradeSize} contracts @ ${(bAsk * 100).toFixed(1)}¢ = $${(tradeSize * bAsk).toFixed(2)}`);

                    // Add to execution signals for dashboard visibility
                    this.state.executionSignals.unshift({
                        id: Date.now(),
                        type: 'opportunity',
                        time: new Date().toLocaleTimeString(),
                        message: `${displayName}: ${(spreadPct * 100).toFixed(1)}% spread, ${tradeSize} contracts`
                    });
                    this.state.executionSignals = this.state.executionSignals.slice(0, 10);

                    // Execute the trade
                    try {
                        const order = await this.executeOrder(
                            market,
                            outcomeId,
                            'buy',
                            bAsk,
                            tradeSize
                        );

                        // Track the order for fill monitoring
                        this.state.pendingOrders.push({
                            orderId: order.id || `${Date.now()}`,
                            marketId: market.marketId,
                            outcomeId: outcomeId,
                            side: 'buy',
                            price: bAsk,
                            size: tradeSize,
                            timestamp: Date.now()
                        });

                        // Update exposure (will be recalculated in next sync, but update local state for immediate visibility)
                        this.state.currentExposure += tradeSize * bAsk;

                    } catch (error: any) {
                        this.log(`⚠️ Failed to execute trade: ${error.message}`);
                    }
                }
            }
        }
    }

    /**
     * Execute an order on Kalshi
     */
    private async executeOrder(
        market: any,
        outcomeId: string,
        side: 'buy' | 'sell',
        price: number,
        size: number
    ): Promise<any> {
        try {
            const orderParams = {
                marketId: market.marketId,
                outcomeId: outcomeId,
                side: side,
                type: 'limit' as const,
                amount: size,
                price: price
            };

            this.log(`🔄 Placing order: ${JSON.stringify(orderParams)}`);

            const result = await this.scheduler.enqueue('HIGH', 'WRITE', () =>
                this.kalshi!.createOrder(orderParams)
            );

            const displayTitle = this.state.marketNameCache[market.marketId] || market.marketId;
            this.log(`✅ Order placed: ${side.toUpperCase()} ${size} @ ${(price * 100).toFixed(1)}¢ on ${displayTitle}`);
            return result;
        } catch (error: any) {
            this.log(`❌ Order failed: ${error.message}`);
            this.log(`📋 Error details: ${JSON.stringify({
                name: error.name,
                message: error.message,
                statusCode: error.statusCode || error.status,
                response: error.response?.data || error.data,
                stack: error.stack?.split('\n').slice(0, 3).join('\n')
            }, null, 2)}`);
            throw error;
        }
    }

    /**
     * Monitor pending orders for fills
     */
    private async monitorPendingOrders() {
        if (!this.kalshi || this.state.pendingOrders.length === 0) return;

        for (const pendingOrder of [...this.state.pendingOrders]) {
            try {
                const order = await this.scheduler.enqueue('LOW', 'READ', () =>
                    this.kalshi!.fetchOrder(pendingOrder.orderId)
                );

                if (order.status === 'filled') {
                    // Move to active positions
                    this.state.activePositions.push({
                        marketId: pendingOrder.marketId,
                        outcomeId: pendingOrder.outcomeId,
                        side: pendingOrder.side,
                        size: pendingOrder.size,
                        entryPrice: pendingOrder.price,
                        entryTime: pendingOrder.timestamp,
                        unrealizedPnL: 0
                    });

                    // Weighted average cost recovery
                    const historyKey = pendingOrder.marketId + pendingOrder.outcomeId;
                    const existingHistory = this.state.filledOrdersHistory[historyKey];

                    if (existingHistory) {
                        const oldSize = existingHistory.totalSize || 0;
                        const oldPrice = existingHistory.avgPrice || existingHistory.price || 0;
                        const newTotalSize = oldSize + pendingOrder.size;
                        const newAvgPrice = ((oldPrice * oldSize) + (pendingOrder.price * pendingOrder.size)) / newTotalSize;

                        this.state.filledOrdersHistory[historyKey] = {
                            price: newAvgPrice, // Still set 'price' for legacy recovery compatibility
                            avgPrice: newAvgPrice,
                            totalSize: newTotalSize,
                            time: pendingOrder.timestamp
                        };
                    } else {
                        this.state.filledOrdersHistory[historyKey] = {
                            price: pendingOrder.price,
                            avgPrice: pendingOrder.price,
                            totalSize: pendingOrder.size,
                            time: pendingOrder.timestamp
                        };
                    }

                    // Remove from pending
                    this.state.pendingOrders = this.state.pendingOrders.filter(
                        o => o.orderId !== pendingOrder.orderId
                    );

                    const displayName = this.state.marketNameCache[pendingOrder.marketId] || pendingOrder.marketId;
                    this.log(`🎯 Order filled: ${pendingOrder.size} contracts @ ${(pendingOrder.price * 100).toFixed(1)}¢ on ${displayName}`);
                } else if (order.status === 'canceled' || order.status === 'rejected') {
                    // Remove from pending and adjust exposure
                    this.state.pendingOrders = this.state.pendingOrders.filter(
                        o => o.orderId !== pendingOrder.orderId
                    );

                    // Exposure will be corrected by next updateBalances() sync

                    this.log(`❌ Order ${order.status}: ${pendingOrder.orderId}`);
                }
            } catch (error: any) {
                this.log(`⚠️ Error checking order ${pendingOrder.orderId}: ${error.message}`);
            }
        }
    }

    /**
     * Close a position by placing a sell order
     */
    private async closePosition(position: any, exitPrice: number) {
        try {
            await this.executeOrder(
                { marketId: position.marketId },
                position.outcomeId,
                'sell',
                exitPrice,
                position.size
            );

            // Update P/L
            const realizedPnL = position.unrealizedPnL;
            this.state.dailyPL += realizedPnL;
            this.state.activePositions = this.state.activePositions.filter(
                p => p !== position
            );

            // Exposure will be corrected by next updateBalances() sync

            this.log(`✅ Position closed: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`);
        } catch (error: any) {
            this.log(`❌ Failed to close position: ${error.message}`);
        }
    }
}

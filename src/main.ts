import { ArbitrageBot } from './bot';
import * as dotenv from 'dotenv';

dotenv.config();

import * as fs from 'fs';
import * as path from 'path';

const PID_FILE = path.join(process.cwd(), 'bot.pid');

// Single-instance enforcement
if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
    try {
        process.kill(oldPid, 0); // Check if process exists
        console.error(`❌ Bot is already running (PID: ${oldPid}). Exiting.`);
        process.exit(1);
    } catch (e) {
        // Process doesn't exist, stale pid file
        fs.unlinkSync(PID_FILE);
    }
}

fs.writeFileSync(PID_FILE, process.pid.toString());

process.on('exit', () => {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
});

process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

const bot = new ArbitrageBot({
    kalshiQuery: "NBA, ECONOMY, FINANCE",
    pollIntervalMs: 60000,
    apiPort: 3002,
    // Phase 0: $45 Risk Framework
    maxRiskPerTrade: 2.00,        // $2 max per trade
    maxTotalExposure: 10.00,      // $10 max simultaneous exposure
    dailyStopLossLimit: 9.00,     // Halt if $9 (20%) lost in a day
    minVolume24h: 10000,          // Only trade liquid markets
    autoTradeEnabled: false,       // Start disabled for safety
    socialConvolutionEnabled: true
});

console.log('🚀 Starting Arbitrage Bot in LIVE mode...');

bot.start().catch(err => {
    console.error('🔥 FATAL ERROR DURING STARTUP:', err);
    process.exit(1);
});

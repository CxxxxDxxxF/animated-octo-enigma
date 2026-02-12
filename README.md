# Kalshi Sniper Engine

An automated trading bot and portfolio tracker for Kalshi prediction markets.

## Features

- **Phase 0/1**: Defensive Spread Capture engine with automated risk controls.
- **Phase 2**: Kalshi Profile Wallet Tracker.
  - Track any public Kalshi profile by username or ID.
  - Daily equity and PnL snapshots.
  - Performance visualization with trend charts.

## Setup

1. Clone the repository.
2. Install dependencies: `npm install && cd dashboard && npm install`.
3. Configure `.env` with your `KALSHI_API_KEY` and `KALSHI_PRIVATE_KEY`.
4. **Start everything**: `npm start` (launches bot + dashboard)

### Alternative: Run Separately

- Bot only: `npm run bot`
- Dashboard only: `npm run dashboard`
- Manual: `npx ts-node src/main.ts` and `cd dashboard && npm run dev`

## Environment Variables

- `KALSHI_READ_RPS`: Max read requests per second (default: 20).
- `KALSHI_WRITE_RPS`: Max write requests per second (default: 10).
- `KALSHI_API_PORT`: Port for the bot API (default: 3001).

## Profile Tracking Notes

- **API Limitations**: Specific portfolio details (live unrealized PnL, full position lists) for other users are often restricted via the official public API. The engine records "Equity" and "Realized PnL" snapshots based on available public stats and labels unavailable fields clearly in the UI.
- **Snapshots**: Run automatically every 24 hours while the bot is active.

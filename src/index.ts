import { Polymarket, UnifiedMarket } from 'pmxtjs';

async function main() {
    console.log('--- pmxtjs Early Prototype ---');

    try {
        // Initialize Polymarket exchange
        const exchange = new Polymarket();

        console.log('Fetching active markets from Polymarket...');
        const markets: UnifiedMarket[] = await exchange.fetchMarkets({ limit: 5 });

        console.log(`Successfully fetched ${markets.length} markets.\n`);

        // Display top markets
        console.log('Top Markets:');
        markets.forEach((market: UnifiedMarket, index: number) => {
            console.log(`${index + 1}. ${market.title}`);
            console.log(`   ID: ${market.marketId}`);
            console.log(`   Liquidity: $${market.liquidity}`);
            console.log(`   Volume (24h): $${market.volume24h}`);
            if (market.outcomes && market.outcomes.length > 0) {
                console.log(`   Outcomes: ${market.outcomes.map(o => `${o.label}: ${o.price}`).join(', ')}`);
            }
            console.log('---');
        });

    } catch (error) {
        console.error('Error fetching data from Polymarket:', error);
    }
}

main();

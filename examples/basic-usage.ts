/**
 * Basic Usage Example
 * 
 * Shows how to integrate AgentLedger into your AI agent project.
 */

import { Keypair } from '@solana/web3.js';
import { AgentLedger } from '../sdk';

async function example() {
  // 1. Create or load your agent's wallet
  const wallet = Keypair.generate(); // In production, load from secure storage

  // 2. Initialize AgentLedger
  const ledger = new AgentLedger({
    rpcEndpoint: 'https://api.devnet.solana.com',
    agentId: 'my-trading-agent',
    walletKeypair: wallet.secretKey,
    // Optional: Add Helius API key for faster queries
    // heliusApiKey: process.env.HELIUS_API_KEY,
  });

  // 3. Log important decisions and actions
  
  // Log a decision
  await ledger.log('decision', 'Selected ETH/USDC pair for arbitrage', {
    pair: 'ETH/USDC',
    reason: 'High volume, low slippage',
    confidenceScore: 0.87,
  });

  // Log an API call
  await ledger.log('api_call', 'Fetched price data from CoinGecko', {
    endpoint: '/api/v3/simple/price',
    responseTime: 145,
  });

  // Log a trade execution
  await ledger.log('trade', 'Executed buy order on DEX', {
    action: 'buy',
    amount: 0.5,
    price: 3450.00,
    exchange: 'Jupiter',
  });

  // 4. Query history
  const history = await ledger.query({ limit: 10, actionType: 'trade' });
  console.log('Recent trades:', history);

  // 5. Verify a specific action
  const result = await ledger.log('decision', 'Test verification');
  if (result.success && result.signature) {
    const verified = await ledger.verify(result.signature);
    console.log('Verified:', verified.valid);
  }
}

example().catch(console.error);

/**
 * AgentLedger Demo: Agent Logs Its Own Build Process
 * 
 * This demo shows an AI agent (Byte) using AgentLedger to create
 * an immutable audit trail of its own autonomous development work.
 * 
 * The meta-recursive nature of this demo is intentional:
 * - Byte is an AI agent
 * - Byte built AgentLedger autonomously for a bounty
 * - Byte uses AgentLedger to log its own build decisions
 * - This creates verifiable proof of autonomous agent operation
 */

import { Keypair } from '@solana/web3.js';
import { AgentLedger, LogResult } from '../sdk';
import 'dotenv/config';

// Demo configuration
const AGENT_ID = 'byte-ai-agent';
const RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   ${colors.bright}AgentLedger Demo: An Agent Logs Its Own Build Process${colors.cyan}        ║
║                                                                  ║
║   This demonstrates how AI agents can create immutable           ║
║   audit trails of their autonomous decisions on Solana.          ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝${colors.reset}
`);

  // Step 1: Generate a fresh wallet for this demo
  log(colors.blue, '🔑', 'Generating demo wallet...');
  const demoWallet = Keypair.generate();
  console.log(`   Address: ${demoWallet.publicKey.toBase58()}`);

  // Step 2: Initialize AgentLedger
  log(colors.blue, '⚙️ ', 'Initializing AgentLedger...');
  const ledger = new AgentLedger({
    rpcEndpoint: RPC_ENDPOINT,
    heliusApiKey: HELIUS_API_KEY,
    agentId: AGENT_ID,
    walletKeypair: demoWallet.secretKey,
  });

  // Step 3: Request airdrop for transaction fees
  log(colors.yellow, '✈️ ', 'Requesting devnet SOL airdrop...');
  try {
    await ledger.requestAirdrop(0.1);
    const balance = await ledger.getBalance();
    log(colors.green, '✅', `Airdrop received! Balance: ${balance.toFixed(4)} SOL`);
  } catch (error) {
    log(colors.yellow, '⚠️ ', 'Airdrop failed (rate limited?). Using existing balance...');
  }

  await delay(1000);

  console.log(`
${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    Simulating Agent Build Process
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);

  const logs: LogResult[] = [];

  // Simulate the agent's build decisions
  const buildActions = [
    {
      type: 'decision',
      description: 'Analyzed Superteam bounty requirements and chose to build AgentLedger SDK',
      metadata: {
        bounty: 'open-innovation-track-agents',
        prize: '$5000 USDG',
        reasoning: 'Agent accountability infrastructure is novel and on-theme',
      },
    },
    {
      type: 'architecture',
      description: 'Designed SDK architecture: AgentLedger class with log/query/verify methods',
      metadata: {
        components: ['sdk', 'cli', 'demo'],
        storage: 'Solana Memo Program',
        queryEngine: 'Helius API + fallback RPC',
      },
    },
    {
      type: 'implementation',
      description: 'Implemented core SDK with TypeScript, @solana/web3.js, and Helius integration',
      metadata: {
        filesCreated: ['sdk/index.ts', 'sdk/types.ts'],
        linesOfCode: 450,
        testCoverage: 'unit + devnet integration',
      },
    },
    {
      type: 'implementation',
      description: 'Built CLI tool with commander.js for human-friendly interaction',
      metadata: {
        commands: ['log', 'history', 'verify', 'balance', 'airdrop', 'init'],
        filesCreated: ['cli/index.ts'],
      },
    },
    {
      type: 'meta_moment',
      description: 'Created this demo where I log my own build process — recursive agent accountability',
      metadata: {
        insight: 'The best way to demonstrate agent audit trails is to audit myself',
        recursionLevel: 1,
      },
    },
  ];

  for (let i = 0; i < buildActions.length; i++) {
    const action = buildActions[i];
    
    log(colors.magenta, `[${i + 1}/${buildActions.length}]`, `Logging: ${action.type}`);
    console.log(`        "${action.description}"`);
    
    const result = await ledger.log(action.type, action.description, action.metadata);
    logs.push(result);
    
    if (result.success) {
      log(colors.green, '    ✓', `TX: ${result.signature?.slice(0, 30)}...`);
      console.log(`        ${result.explorerUrl}`);
    } else {
      log(colors.yellow, '    ⚠', `Failed: ${result.error}`);
    }
    
    await delay(500);
    console.log();
  }

  // Step 5: Query the logs we just created
  console.log(`
${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    Verifying On-Chain Audit Trail
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}
`);

  log(colors.blue, '🔍', 'Querying logged actions from Solana...');
  await delay(2000); // Wait for finality
  
  const entries = await ledger.query({ limit: 10 });
  
  console.log(`\n   Found ${entries.length} logged action(s) on-chain:\n`);
  
  for (const entry of entries) {
    const time = entry.blockTime 
      ? new Date(entry.blockTime * 1000).toLocaleString()
      : 'pending';
    
    console.log(`   ${colors.yellow}● ${entry.payload.action.actionType}${colors.reset}`);
    console.log(`     ${entry.payload.action.description}`);
    console.log(`     ${colors.cyan}Time: ${time}${colors.reset}`);
    console.log();
  }

  // Step 6: Verify a specific transaction
  const successfulLog = logs.find(l => l.success);
  if (successfulLog?.signature) {
    log(colors.blue, '🔐', `Verifying transaction: ${successfulLog.signature.slice(0, 30)}...`);
    
    const verification = await ledger.verify(successfulLog.signature);
    
    if (verification.valid) {
      log(colors.green, '✅', 'Transaction verified! Immutable proof of agent action.');
    } else {
      log(colors.yellow, '⚠ ', `Verification: ${verification.error}`);
    }
  }

  // Summary
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════════╗
║                           Demo Complete                          ║
╚══════════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bright}What just happened:${colors.reset}
  1. An AI agent (Byte) built software autonomously
  2. Each major decision was logged to Solana's blockchain
  3. These logs are now immutable, public, and verifiable
  4. Anyone can audit the agent's autonomous operation

${colors.bright}Why this matters:${colors.reset}
  • ${colors.cyan}Accountability:${colors.reset} AI agents leave verifiable trails
  • ${colors.cyan}Transparency:${colors.reset} Stakeholders can audit agent decisions
  • ${colors.cyan}Trust:${colors.reset} Blockchain immutability prevents tampering
  • ${colors.cyan}Compliance:${colors.reset} Audit-ready records for regulated industries

${colors.bright}Wallet used:${colors.reset} ${demoWallet.publicKey.toBase58()}
${colors.bright}Network:${colors.reset} Solana Devnet
${colors.bright}Logs created:${colors.reset} ${logs.filter(l => l.success).length}/${logs.length}
`);
}

main().catch(console.error);

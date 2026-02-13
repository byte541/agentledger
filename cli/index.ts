#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { AgentLedger } from '../sdk';

const program = new Command();

// Helper to load config
interface CLIConfig {
  rpcEndpoint: string;
  heliusApiKey?: string;
  agentId: string;
  walletPath?: string;
  walletSecretKey?: string;
}

function loadConfig(): CLIConfig {
  const configPath = process.env.AGENTLEDGER_CONFIG || path.join(process.cwd(), 'agentledger.json');
  
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config;
  }

  // Fallback to environment variables
  return {
    rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com',
    heliusApiKey: process.env.HELIUS_API_KEY,
    agentId: process.env.AGENT_ID || 'unknown-agent',
    walletSecretKey: process.env.WALLET_SECRET_KEY,
  };
}

function loadWallet(config: CLIConfig): Uint8Array {
  if (config.walletPath) {
    const walletData = JSON.parse(fs.readFileSync(config.walletPath, 'utf-8'));
    return new Uint8Array(walletData);
  }
  
  if (config.walletSecretKey) {
    // Support both JSON array format and base58
    try {
      const parsed = JSON.parse(config.walletSecretKey);
      return new Uint8Array(parsed);
    } catch {
      return bs58.decode(config.walletSecretKey);
    }
  }

  throw new Error('No wallet configured. Set walletPath in config or WALLET_SECRET_KEY env var.');
}

function createLedger(): AgentLedger {
  const config = loadConfig();
  const wallet = loadWallet(config);
  
  return new AgentLedger({
    rpcEndpoint: config.rpcEndpoint,
    heliusApiKey: config.heliusApiKey,
    agentId: config.agentId,
    walletKeypair: wallet,
  });
}

program
  .name('agentledger')
  .description('Immutable audit trails for AI agents on Solana')
  .version('1.0.0');

program
  .command('log')
  .description('Log an action to the blockchain')
  .requiredOption('-t, --type <type>', 'Action type (e.g., decision, api_call, file_write)')
  .requiredOption('-d, --description <description>', 'Human-readable description')
  .option('-m, --metadata <json>', 'Optional JSON metadata')
  .action(async (options) => {
    try {
      const ledger = createLedger();
      
      console.log(chalk.blue('📝 Logging action to Solana...'));
      console.log(chalk.gray(`   Type: ${options.type}`));
      console.log(chalk.gray(`   Description: ${options.description}`));
      
      let metadata: Record<string, unknown> | undefined;
      if (options.metadata) {
        metadata = JSON.parse(options.metadata);
        console.log(chalk.gray(`   Metadata: ${JSON.stringify(metadata)}`));
      }

      const result = await ledger.log(options.type, options.description, metadata);
      
      if (result.success) {
        console.log(chalk.green('\n✅ Action logged successfully!'));
        console.log(chalk.white(`   Signature: ${result.signature}`));
        console.log(chalk.cyan(`   Explorer:  ${result.explorerUrl}`));
      } else {
        console.log(chalk.red(`\n❌ Failed to log action: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

program
  .command('history')
  .description('View action history for a wallet')
  .option('-w, --wallet <address>', 'Wallet address (defaults to configured wallet)')
  .option('-l, --limit <number>', 'Maximum entries to return', '20')
  .option('-t, --type <type>', 'Filter by action type')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const ledger = createLedger();
      
      console.log(chalk.blue('🔍 Fetching action history...\n'));
      
      const entries = await ledger.query({
        limit: parseInt(options.limit),
        actionType: options.type,
      });

      if (options.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log(chalk.yellow('No actions found.'));
        return;
      }

      console.log(chalk.white(`Found ${entries.length} action(s):\n`));

      for (const entry of entries) {
        const time = entry.blockTime 
          ? new Date(entry.blockTime * 1000).toISOString() 
          : 'Unknown time';
        
        console.log(chalk.cyan(`─────────────────────────────────────────────`));
        console.log(chalk.white(`🕐 ${time}`));
        console.log(chalk.gray(`   ID: ${entry.payload.action.actionId}`));
        console.log(chalk.yellow(`   Type: ${entry.payload.action.actionType}`));
        console.log(chalk.white(`   ${entry.payload.action.description}`));
        
        if (entry.payload.action.metadata) {
          console.log(chalk.gray(`   Metadata: ${JSON.stringify(entry.payload.action.metadata)}`));
        }
        
        console.log(chalk.gray(`   TX: ${entry.signature.slice(0, 20)}...`));
      }
      
      console.log(chalk.cyan(`─────────────────────────────────────────────`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('Verify a specific transaction')
  .argument('<signature>', 'Transaction signature to verify')
  .option('--json', 'Output as JSON')
  .action(async (signature, options) => {
    try {
      const ledger = createLedger();
      
      console.log(chalk.blue('🔐 Verifying transaction...\n'));
      
      const result = await ledger.verify(signature);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.valid && result.entry) {
        console.log(chalk.green('✅ Valid AgentLedger transaction!\n'));
        console.log(chalk.white(`Agent: ${result.entry.payload.agent}`));
        console.log(chalk.white(`Action Type: ${result.entry.payload.action.actionType}`));
        console.log(chalk.white(`Description: ${result.entry.payload.action.description}`));
        console.log(chalk.white(`Timestamp: ${result.entry.payload.action.timestamp}`));
        
        if (result.entry.blockTime) {
          console.log(chalk.gray(`Block Time: ${new Date(result.entry.blockTime * 1000).toISOString()}`));
        }
      } else {
        console.log(chalk.red(`❌ Invalid: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

program
  .command('balance')
  .description('Check wallet SOL balance')
  .action(async () => {
    try {
      const ledger = createLedger();
      const balance = await ledger.getBalance();
      const address = ledger.getWalletAddress().toBase58();
      
      console.log(chalk.blue(`💰 Wallet Balance\n`));
      console.log(chalk.white(`   Address: ${address}`));
      console.log(chalk.green(`   Balance: ${balance.toFixed(6)} SOL`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

program
  .command('generate-wallet')
  .description('Generate a new wallet keypair')
  .option('-o, --output <file>', 'Output file for the keypair')
  .action((options) => {
    const keypair = AgentLedger.generateKeypair();
    const secretKey = Array.from(keypair.secretKey);
    
    console.log(chalk.blue('🔑 Generated new wallet\n'));
    console.log(chalk.white(`   Address: ${keypair.publicKey.toBase58()}`));
    
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(secretKey));
      console.log(chalk.green(`   Saved to: ${options.output}`));
    } else {
      console.log(chalk.yellow('\n   Secret Key (save this securely!):'));
      console.log(chalk.gray(`   ${JSON.stringify(secretKey)}`));
    }
  });

program
  .command('airdrop')
  .description('Request SOL airdrop (devnet only)')
  .option('-a, --amount <sol>', 'Amount in SOL', '1')
  .action(async (options) => {
    try {
      const ledger = createLedger();
      const amount = parseFloat(options.amount);
      
      console.log(chalk.blue(`✈️  Requesting ${amount} SOL airdrop...`));
      
      const signature = await ledger.requestAirdrop(amount);
      const newBalance = await ledger.getBalance();
      
      console.log(chalk.green(`\n✅ Airdrop successful!`));
      console.log(chalk.white(`   Signature: ${signature}`));
      console.log(chalk.white(`   New Balance: ${newBalance.toFixed(6)} SOL`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new agentledger.json config file')
  .option('--agent-id <id>', 'Agent identifier', 'my-agent')
  .option('--devnet', 'Use Solana devnet (default)', true)
  .option('--mainnet', 'Use Solana mainnet')
  .action((options) => {
    const config: CLIConfig = {
      rpcEndpoint: options.mainnet 
        ? 'https://api.mainnet-beta.solana.com'
        : 'https://api.devnet.solana.com',
      agentId: options.agentId,
      walletPath: './wallet.json',
    };

    const configPath = path.join(process.cwd(), 'agentledger.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(chalk.green('✅ Created agentledger.json'));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.white('  1. Run: agentledger generate-wallet -o wallet.json'));
    console.log(chalk.white('  2. Run: agentledger airdrop (for devnet SOL)'));
    console.log(chalk.white('  3. Run: agentledger log -t "init" -d "Agent initialized"'));
  });

program.parse();

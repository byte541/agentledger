# AgentLedger

**Immutable audit trails for AI agents on Solana**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Devnet%20%7C%20Mainnet-9945FF)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org)

---

## What is AgentLedger?

AgentLedger is an open-source TypeScript SDK and CLI that enables AI agents to create **immutable, verifiable audit trails** of their decisions and actions on the Solana blockchain.

As AI agents become more autonomous—making trades, sending emails, managing infrastructure—we need transparency and accountability mechanisms. AgentLedger provides this by leveraging Solana's speed and immutability: every logged action becomes permanent, tamper-proof, and publicly verifiable.

### The Problem

- AI agents operate as black boxes
- No reliable way to audit what an agent actually did
- Trust issues between humans and autonomous systems
- Compliance/regulatory gaps for AI-driven operations

### The Solution

- **Immutable logs**: Actions stored on Solana can never be altered or deleted
- **Verifiable history**: Anyone can verify an agent's claimed actions
- **Structured data**: Typed action payloads with metadata, not just text
- **Efficient queries**: Helius API integration for fast history retrieval

---

## How It Works

AgentLedger uses the **Solana Memo Program** to store structured JSON payloads:

```
Transaction → Memo Instruction → JSON Payload → On-chain forever
```

Each log entry contains:
- Agent identifier
- Action type (decision, api_call, trade, etc.)
- Human-readable description
- Structured metadata
- Timestamp
- Unique action ID

No custom programs needed—works immediately on devnet and mainnet.

---

## Installation

```bash
npm install agentledger
# or
yarn add agentledger
```

For CLI usage:
```bash
npm install -g agentledger
```

---

## Quick Start

### SDK Usage

```typescript
import { Keypair } from '@solana/web3.js';
import { AgentLedger } from 'agentledger';

// Initialize with your agent's wallet
const ledger = new AgentLedger({
  rpcEndpoint: 'https://api.devnet.solana.com',
  agentId: 'my-trading-agent',
  walletKeypair: myWallet.secretKey,
  heliusApiKey: process.env.HELIUS_API_KEY, // Optional, improves query speed
});

// Log a decision
await ledger.log('decision', 'Selected ETH/USDC for arbitrage', {
  pair: 'ETH/USDC',
  confidence: 0.87,
  reasoning: 'High volume, low slippage',
});

// Log a trade
await ledger.log('trade', 'Executed buy order', {
  action: 'buy',
  amount: 0.5,
  price: 3450.00,
});

// Query history
const history = await ledger.query({ 
  limit: 20, 
  actionType: 'trade' 
});

// Verify a specific transaction
const verified = await ledger.verify('5KtP...');
console.log(verified.valid); // true
```

### CLI Usage

```bash
# Initialize a new project
agentledger init --agent-id my-agent

# Generate a wallet
agentledger generate-wallet -o wallet.json

# Get devnet SOL
agentledger airdrop

# Log an action
agentledger log -t decision -d "Chose momentum strategy" -m '{"confidence": 0.9}'

# View history
agentledger history --limit 10

# Verify a transaction
agentledger verify 5KtP...
```

---

## API Reference

### `AgentLedger`

#### Constructor

```typescript
new AgentLedger(config: AgentLedgerConfig)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `rpcEndpoint` | string | ✓ | Solana RPC URL (devnet/mainnet) |
| `agentId` | string | ✓ | Unique identifier for your agent |
| `walletKeypair` | Uint8Array | ✓ | Agent's wallet secret key |
| `heliusApiKey` | string | | Helius API key for faster queries |

#### Methods

##### `log(actionType, description, metadata?): Promise<LogResult>`

Log an action to the blockchain.

```typescript
const result = await ledger.log(
  'api_call',                              // Action type
  'Fetched price data from CoinGecko',     // Description
  { endpoint: '/api/v3/simple/price' }     // Optional metadata
);

// result: { success: true, signature: '5KtP...', explorerUrl: '...' }
```

##### `query(options?): Promise<LogEntry[]>`

Query action history.

```typescript
const entries = await ledger.query({
  limit: 50,           // Max entries
  actionType: 'trade', // Filter by type
  after: 1704067200,   // Unix timestamp
  before: 1704153600,
});
```

##### `verify(signature): Promise<VerifyResult>`

Verify a specific transaction.

```typescript
const result = await ledger.verify('5KtP...');
// result: { valid: true, entry: { ... } }
```

##### `getBalance(): Promise<number>`

Get wallet SOL balance.

##### `requestAirdrop(amount?): Promise<string>`

Request devnet SOL (devnet only).

---

## How Solana is Used

AgentLedger leverages Solana in the following ways:

1. **Memo Program**: We use Solana's native Memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) to store structured JSON data. This program is designed exactly for this use case—attaching human-readable or machine-parseable data to transactions.

2. **Immutability**: Once a transaction is confirmed on Solana, it cannot be altered or deleted. This makes logs tamper-proof and creates genuine accountability.

3. **Speed**: Solana's ~400ms block times mean logs are confirmed almost instantly—critical for real-time agent monitoring.

4. **Cost**: Memo transactions cost approximately 0.000005 SOL (~$0.001), making it economically viable to log thousands of actions.

5. **Public Verifiability**: Anyone can query Solana's public blockchain to verify an agent's claimed actions without trusting a centralized server.

---

## How Byte Built This Autonomously

This project was built by **Byte**, an AI agent, for the [Superteam Open Innovation Track](https://earn.superteam.fun). Here's how:

### 1. Bounty Analysis
Byte analyzed the bounty requirements and identified that AI agent accountability was an underserved niche with strong alignment to the "agent-only" track's theme.

### 2. Architecture Decision
Byte decided to use the Solana Memo program (no custom program deployment) for immediate usability, with Helius integration for efficient historical queries.

### 3. Implementation
Byte wrote the entire codebase:
- Core SDK (`sdk/index.ts`, `sdk/types.ts`)
- CLI tool (`cli/index.ts`)
- Demo script (`demo/agent-builds-itself.ts`)
- Tests and examples

### 4. Meta-Demonstration
The demo script is recursive: Byte uses AgentLedger to log its own build decisions, creating verifiable proof of autonomous operation. An AI agent building accountability infrastructure for AI agents, then using it on itself.

---

## Demo: Agent Logs Itself

Run the demo to see AgentLedger in action:

```bash
npm run demo
```

This runs `demo/agent-builds-itself.ts`, which:
1. Generates a fresh wallet
2. Requests devnet SOL
3. Simulates Byte's build decisions, logging each to Solana
4. Queries the logs back from the blockchain
5. Verifies a transaction

Each logged action is real and viewable on [Solana Explorer](https://explorer.solana.com/?cluster=devnet).

---

## Use Cases

- **Trading Bots**: Log every trade decision for auditing
- **Autonomous Agents**: Create transparency for AI-driven actions
- **Compliance**: Generate audit trails for regulated industries
- **Research**: Study agent behavior through immutable logs
- **Multi-Agent Systems**: Track coordination between agents

---

## Project Structure

```
agentledger/
├── sdk/                  # Core TypeScript SDK
│   ├── index.ts          # AgentLedger class
│   └── types.ts          # Type definitions
├── cli/                  # Command-line interface
│   └── index.ts          # CLI commands
├── demo/                 # Demonstration scripts
│   └── agent-builds-itself.ts
├── examples/             # Usage examples
│   ├── basic-usage.ts
│   └── middleware-pattern.ts
├── tests/                # Jest test suite
│   └── sdk.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run demo
npm run demo
```

---

## Requirements

- Node.js 18+
- npm or yarn
- Solana wallet with SOL (devnet is free via airdrop)

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Links

- [Solana Memo Program](https://spl.solana.com/memo)
- [Helius API](https://helius.dev)
- [Solana Explorer](https://explorer.solana.com)
- [Superteam Earn](https://earn.superteam.fun)

---

*Built autonomously by Byte, an AI agent, to demonstrate that the future of AI accountability is on-chain.*

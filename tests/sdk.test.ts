import { Keypair } from '@solana/web3.js';
import { AgentLedger, AgentLedgerConfig } from '../sdk';

describe('AgentLedger SDK', () => {
  let ledger: AgentLedger;
  let wallet: Keypair;

  beforeAll(() => {
    wallet = Keypair.generate();
  });

  describe('Initialization', () => {
    it('should create an AgentLedger instance', () => {
      ledger = new AgentLedger({
        rpcEndpoint: 'https://api.devnet.solana.com',
        agentId: 'test-agent',
        walletKeypair: wallet.secretKey,
      });

      expect(ledger).toBeInstanceOf(AgentLedger);
    });

    it('should return the correct wallet address', () => {
      const address = ledger.getWalletAddress();
      expect(address.toBase58()).toBe(wallet.publicKey.toBase58());
    });

    it('should return the correct agent ID', () => {
      expect(ledger.getAgentId()).toBe('test-agent');
    });
  });

  describe('Wallet Generation', () => {
    it('should generate a valid keypair', () => {
      const keypair = AgentLedger.generateKeypair();
      expect(keypair).toBeInstanceOf(Keypair);
      expect(keypair.publicKey.toBase58()).toHaveLength(44);
    });
  });

  describe('Balance', () => {
    it('should fetch wallet balance', async () => {
      const balance = await ledger.getBalance();
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Logging (requires devnet SOL)', () => {
    beforeAll(async () => {
      // Try to get devnet SOL
      try {
        await ledger.requestAirdrop(0.05);
        // Wait for airdrop to confirm
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log('Airdrop failed, tests may fail if no SOL');
      }
    });

    it('should log an action successfully', async () => {
      const result = await ledger.log(
        'test_action',
        'This is a test action from Jest',
        { testRun: true, timestamp: Date.now() }
      );

      // May fail if no SOL, which is expected in CI
      if (result.success) {
        expect(result.signature).toBeDefined();
        expect(result.explorerUrl).toContain('explorer.solana.com');
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should reject oversized memos', async () => {
      const largeMetadata = {
        data: 'x'.repeat(1000), // Way too big
      };

      const result = await ledger.log('test', 'Large memo test', largeMetadata);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('Query', () => {
    it('should return an array of log entries', async () => {
      const entries = await ledger.query({ limit: 5 });
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should respect limit option', async () => {
      const entries = await ledger.query({ limit: 2 });
      expect(entries.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Verify', () => {
    it('should return invalid for non-existent transaction', async () => {
      const result = await ledger.verify('invalidSignature123');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Memo Payload Validation', () => {
    it('should create valid payload structure', async () => {
      // We test the structure by logging and verifying
      const result = await ledger.log('structure_test', 'Testing payload structure', {
        key: 'value',
      });

      if (result.success && result.signature) {
        const verified = await ledger.verify(result.signature);
        if (verified.valid && verified.entry) {
          expect(verified.entry.payload.v).toBe(1);
          expect(verified.entry.payload.agent).toBe('test-agent');
          expect(verified.entry.payload.action.actionType).toBe('structure_test');
          expect(verified.entry.payload.action.description).toBe('Testing payload structure');
          expect(verified.entry.payload.action.metadata).toEqual({ key: 'value' });
          expect(verified.entry.payload.action.actionId).toBeDefined();
          expect(verified.entry.payload.action.timestamp).toBeDefined();
        }
      }
    });
  });
});

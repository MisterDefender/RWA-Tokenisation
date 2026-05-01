import { ethers, Contract, JsonRpcProvider } from "ethers";
import { config } from "../config";
import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

export interface TransactionRecord {
  depositor: string;
  token: string;
  depositAmount: string;
  mintedAmount: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
//  ABI Loader
// ─────────────────────────────────────────────────────────────

/**
 * Loads a contract ABI from the Hardhat artifacts directory.
 * @param contractPath - Relative path within artifacts/contracts (e.g. "Treasury.sol/Treasury.json")
 */
function loadABI(contractPath: string): ethers.InterfaceAbi {
  const fullPath = path.join(config.artifactsDir, contractPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Artifact not found: ${fullPath}. Did you run 'npx hardhat compile'?`);
  }
  const artifact = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  return artifact.abi;
}

// ─────────────────────────────────────────────────────────────
//  Contract Service (Singleton)
// ─────────────────────────────────────────────────────────────

class ContractService {
  private provider: JsonRpcProvider;
  private rwaToken: Contract;
  private treasury: Contract;

  constructor() {
    this.provider = new JsonRpcProvider(config.rpcUrl);

    // Load ABIs
    const rwaTokenABI = loadABI("RWAToken.sol/RWAToken.json");
    const treasuryABI = loadABI("Treasury.sol/Treasury.json");

    // Validate addresses
    if (!config.contracts.rwaToken || !config.contracts.treasury) {
      console.warn(
        " Contract addresses not set in .env — API calls will fail. " +
        "Deploy contracts first and update .env."
      );
    }

    this.rwaToken = new Contract(
      config.contracts.rwaToken,
      rwaTokenABI,
      this.provider
    );

    this.treasury = new Contract(
      config.contracts.treasury,
      treasuryABI,
      this.provider
    );
  }

  // ── Balance ──

  /**
   * Returns the RWA token balance for a given wallet address.
   * @param address - Ethereum wallet address.
   * @returns Token balance formatted in ether units (18 decimals).
   */
  async getTokenBalance(address: string): Promise<{ balance: string; raw: string }> {
    const raw: bigint = await this.rwaToken.balanceOf(address);
    return {
      balance: ethers.formatEther(raw),
      raw: raw.toString(),
    };
  }

  // ── Transaction History ──

  /**
   * Queries on-chain `Deposited` events from the Treasury for a
   * specific depositor address. Returns the most recent transactions.
   *
   * @param address - Depositor wallet address.
   * @param fromBlock - Starting block for the query (default: 0).
   * @returns Array of formatted transaction records.
   */
  async getTransactionHistory(
    address: string,
    fromBlock: number = 0
  ): Promise<TransactionRecord[]> {
    // Build the event filter: Deposited(address indexed depositor, ...)
    const filter = this.treasury.filters.Deposited(address);

    const events = await this.treasury.queryFilter(filter, fromBlock, "latest");

    const records: TransactionRecord[] = await Promise.all(
      events.map(async (event) => {
        const log = event as ethers.EventLog;
        const block = await log.getBlock();

        return {
          depositor: log.args[0] as string,
          token: log.args[1] as string,
          depositAmount: ethers.formatEther(log.args[2] as bigint),
          mintedAmount: ethers.formatEther(log.args[3] as bigint),
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          timestamp: block.timestamp,
        };
      })
    );

    // Return most recent first
    return records.reverse();
  }

  // ── Preview ──

  /**
   * Calls the Treasury's `previewDeposit` view function to calculate
   * how many RWA tokens would be minted for a given deposit amount.
   *
   * @param amount - Deposit amount in ether units (e.g. "1.5").
   * @returns Expected tokens formatted in ether units.
   */
  async previewDeposit(
    amount: string
  ): Promise<{ expectedTokens: string; raw: string }> {
    const amountWei = ethers.parseEther(amount);
    const raw: bigint = await this.treasury.previewDeposit(amountWei);
    return {
      expectedTokens: ethers.formatEther(raw),
      raw: raw.toString(),
    };
  }
}

// Export singleton instance
export const contractService = new ContractService();

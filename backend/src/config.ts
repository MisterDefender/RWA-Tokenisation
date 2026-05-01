import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Centralised application configuration.
 *
 * Reads from environment variables with sensible defaults pointing
 * to a local Hardhat node (localhost:8545).
 */
export const config = {
  /** Express server port. */
  port: parseInt(process.env.PORT || "3000", 10),

  /** JSON-RPC endpoint of the target EVM node. */
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",

  /** Deployed contract addresses (populated after deployment). */
  contracts: {
    rwaToken: process.env.RWA_TOKEN_ADDRESS || "",
    treasury: process.env.TREASURY_ADDRESS || "",
    depositToken: process.env.DEPOSIT_TOKEN_ADDRESS || "",
  },

  /**
   * Path to Hardhat artifact directory.
   * ABIs are loaded from here at runtime.
   */
  artifactsDir: path.resolve(__dirname, "../../artifacts/contracts"),
} as const;

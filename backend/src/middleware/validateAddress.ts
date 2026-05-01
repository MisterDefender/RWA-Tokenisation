import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";

/**
 * Middleware that validates the `:address` route parameter is a
 * well-formed Ethereum address (checksum or lowercase).
 */
export function validateAddress(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { address } = req.params;

  if (!address) {
    res.status(400).json({
      success: false,
      error: "Wallet address is required.",
    });
    return;
  }

  if (!ethers.isAddress(address)) {
    res.status(400).json({
      success: false,
      error: `Invalid Ethereum address: ${address}`,
    });
    return;
  }

  // Normalise to checksum format for downstream use
  req.params.address = ethers.getAddress(address);
  next();
}

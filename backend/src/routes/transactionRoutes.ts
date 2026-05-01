import { Router, Request, Response, NextFunction, type IRouter } from "express";
import { contractService } from "../services/contractService";
import { validateAddress } from "../middleware/validateAddress";

const router: IRouter = Router();

/**
 * GET /api/transactions/:address
 *
 * Returns the deposit transaction history for a given wallet address.
 * Data is sourced from on-chain `Deposited` events emitted by the Treasury.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "address": "0x...",
 *     "count": 3,
 *     "transactions": [ ... ]
 *   }
 * }
 */
router.get(
  "/:address",
  validateAddress,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = req.params.address as string;
      const transactions = await contractService.getTransactionHistory(address);

      res.json({
        success: true,
        data: {
          address,
          count: transactions.length,
          transactions,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

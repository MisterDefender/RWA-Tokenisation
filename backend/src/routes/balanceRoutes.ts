import { Router, Request, Response, NextFunction, type IRouter } from "express";
import { contractService } from "../services/contractService";
import { validateAddress } from "../middleware/validateAddress";

const router: IRouter = Router();

/**
 * GET /api/balance/:address
 *
 * Returns the RWA token balance for a given wallet address.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "address": "0x...",
 *     "balance": "200.0",      // human-readable (ether units)
 *     "raw": "200000000..."    // raw wei value
 *   }
 * }
 */
router.get(
  "/:address",
  validateAddress,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = req.params.address as string;
      const result = await contractService.getTokenBalance(address);

      res.json({
        success: true,
        data: {
          address,
          ...result,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

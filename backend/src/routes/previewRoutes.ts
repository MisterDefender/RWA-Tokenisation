import { Router, Request, Response, NextFunction, type IRouter } from "express";
import { contractService } from "../services/contractService";

const router: IRouter = Router();

/**
 * GET /api/preview/:amount
 *
 * Returns the expected number of RWA tokens that would be minted
 * for a given deposit amount.
 *
 * @param amount - Deposit amount in ether units (e.g. "1.5").
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "depositAmount": "1.5",
 *     "expectedTokens": "150.0",
 *     "raw": "150000000..."
 *   }
 * }
 */
router.get(
  "/:amount",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const amount = req.params.amount as string;

      // Validate amount is a positive number
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        res.status(400).json({
          success: false,
          error: "Amount must be a positive number.",
        });
        return;
      }

      const result = await contractService.previewDeposit(amount);

      res.json({
        success: true,
        data: {
          depositAmount: amount,
          ...result,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

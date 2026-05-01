import express, { type Express } from "express";
import cors from "cors";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";

// ── Route imports ──
import balanceRoutes from "./routes/balanceRoutes";
import transactionRoutes from "./routes/transactionRoutes";
import previewRoutes from "./routes/previewRoutes";

// ─────────────────────────────────────────────────────────────
//  Express application
// ─────────────────────────────────────────────────────────────

const app: Express = express();

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── Health check ──
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "RWA Tokenisation API is running",
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──
app.use("/api/balance", balanceRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/preview", previewRoutes);

// ── Error handler (must be last) ──
app.use(errorHandler);

// ── Start server ──
app.listen(config.port, () => {
  console.log(`\n RWA Backend API running on http://localhost:${config.port}`);
  console.log(`   ├── GET /api/health`);
  console.log(`   ├── GET /api/balance/:address`);
  console.log(`   ├── GET /api/transactions/:address`);
  console.log(`   └── GET /api/preview/:amount`);
  console.log(`\n Connected to RPC: ${config.rpcUrl}\n`);
});

export default app;

# RWA Tokenisation System

A simplified Real-World Asset (RWA) tokenisation system built with Solidity smart contracts, a Node.js/TypeScript backend API, and comprehensive Hardhat tests.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Express)                        │
│  GET /api/balance/:addr   GET /api/transactions/:addr           │
│  GET /api/preview/:amount GET /api/health                       │
└────────────────────────────┬────────────────────────────────────┘
                             │  ethers.js (JSON-RPC)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        EVM Blockchain                           │
│                                                                 │
│  ┌──────────────┐    mints     ┌──────────────────┐             │
│  │   Treasury   │ ──────────►  │    RWAToken       │             │
│  │              │              │    (ERC-20)       │             │
│  │  deposit()   │              │  Fractional       │             │
│  │  withdraw()  │              │  Ownership        │             │
│  │  preview()   │              └──────────────────┘             │
│  └──────┬───────┘                                               │
│         │ accepts                                               │
│         ▼                                                       │
│  ┌──────────────────┐                                           │
│  │ ETH (address(0)) │   OR   MockDepositToken (ERC-20)          │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Design Decisions

### Smart Contracts

- **Unified `deposit()` function**: A single function handles both ETH and ERC-20 deposits. Passing `address(0)` as the token parameter triggers the ETH deposit path (using `msg.value`), while any other accepted token address triggers the ERC-20 path. This simplifies the interface and reduces code duplication.

- **Interface-driven design**: `IRWAToken` and `ITreasury` interfaces define the contract boundaries, enabling clean decoupling and future extensibility.

- **OpenZeppelin foundations**: Built on battle-tested `ERC20`, `Ownable`, `ReentrancyGuard`, and `SafeERC20` from OpenZeppelin v5.x — no need to reinvent security primitives.

- **Custom errors over require strings**: Gas-efficient custom errors (`ZeroAmount`, `ZeroAddress`, `TokenNotAccepted`, etc.) instead of string-based `require` messages.

- **Exchange rate model**: A simple `exchangeRate` multiplier (e.g., 100 = 1 ETH → 100 RWA tokens). The `previewDeposit()` view function lets users simulate deposits before committing.

### Backend

- **Service layer pattern**: `ContractService` encapsulates all blockchain interactions, keeping route handlers thin and testable.

- **Event-based transaction history**: Transaction history is sourced from on-chain `Deposited` events rather than maintaining a separate database, ensuring data integrity.

- **Address validation middleware**: Ethereum address format is validated before reaching handlers, with automatic checksum normalisation.

- **ABI loading from artifacts**: The backend reads ABIs directly from Hardhat's compiled artifacts — no manual ABI copying needed.

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** (package manager)

## Setup & Installation

```bash
# 1. Install smart contract dependencies
pnpm install

# 2. Install backend dependencies
cd backend && pnpm install && cd ..

# 3. Copy and configure environment variables
cp .env.example .env
# Edit .env with your deployed contract addresses (after step 5)

# 4. Compile the contracts
pnpm run compile
```

## Running the Project

### Run Tests

```bash
# Run all tests
pnpm run test

# Run with gas reporting
pnpm run test:gas

# Run with coverage
pnpm run test:coverage
```

### Run Locally (Full Stack)

```bash
# Terminal 1: Start local Hardhat node
pnpm run node

# Terminal 2: Deploy contracts to localhost (use Hardhat console or a script)
npx hardhat console --network localhost
# In the console:
# const MockDepositToken = await ethers.getContractFactory("MockDepositToken");
# const dt = await MockDepositToken.deploy();
# const RWAToken = await ethers.getContractFactory("RWAToken");
# const rwa = await RWAToken.deploy("RWA Property Token", "RWAP", (await ethers.getSigners())[0].address);
# const Treasury = await ethers.getContractFactory("Treasury");
# const treasury = await Treasury.deploy(await rwa.getAddress(), await dt.getAddress(), 100, (await ethers.getSigners())[0].address);
# await rwa.transferOwnership(await treasury.getAddress());
# console.log("DepositToken:", await dt.getAddress());
# console.log("RWAToken:", await rwa.getAddress());
# console.log("Treasury:", await treasury.getAddress());

# Terminal 3: Update .env with contract addresses, then start the backend
cd backend
pnpm run dev
```

### Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Get wallet balance
curl http://localhost:3000/api/balance/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Preview deposit (1.5 ETH → expected tokens)
curl http://localhost:3000/api/preview/1.5

# Get transaction history
curl http://localhost:3000/api/transactions/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

## API Reference

| Method | Endpoint | Input | Output |
|--------|----------|-------|--------|
| GET | `/api/health` | — | Server status |
| GET | `/api/balance/:address` | Wallet address | RWA token balance |
| GET | `/api/transactions/:address` | Wallet address | Deposit transaction history |
| GET | `/api/preview/:amount` | Amount (in ether units) | Expected RWA tokens to be minted |

## Project Structure

```
weare86-assignment/
├── contracts/
│   ├── interfaces/
│   │   ├── IRWAToken.sol         # RWA token interface
│   │   └── ITreasury.sol         # Treasury interface (events, errors, functions)
│   ├── mocks/
│   │   └── MockDepositToken.sol  # Mock ERC-20 for testing
│   ├── RWAToken.sol              # Fractional ownership ERC-20 token
│   └── Treasury.sol              # Core treasury — deposits, withdrawals, minting
├── test/
│   └── Treasury.test.ts          # 37 test cases across 7 categories
├── backend/
│   └── src/
│       ├── config.ts             # Centralised configuration
│       ├── index.ts              # Express server entry point
│       ├── middleware/
│       │   ├── errorHandler.ts   # Global error handler
│       │   └── validateAddress.ts # Ethereum address validator
│       ├── routes/
│       │   ├── balanceRoutes.ts  # GET /api/balance/:address
│       │   ├── transactionRoutes.ts # GET /api/transactions/:address
│       │   └── previewRoutes.ts  # GET /api/preview/:amount
│       └── services/
│           └── contractService.ts # Blockchain interaction layer
├── hardhat.config.ts             # Hardhat configuration (optimizer, networks)
├── .env.example                  # Environment variable template
└── README.md
```

## Test Coverage

37 test cases covering:

| Category | Tests | Description |
|----------|-------|-------------|
| Deployment | 7 | Constructor validation, ownership setup, invalid params |
| ETH Deposit | 5 | ETH deposits, balance tracking, events, zero-value revert |
| ERC-20 Deposit | 8 | Token deposits, approval checks, event validation, edge cases |
| Withdrawal | 7 | ETH/ERC-20 withdrawals, events, insufficient balance, zero checks |
| Access Control | 3 | Non-owner revert for ETH/ERC-20 withdrawals, multi-user deposits |
| Preview | 3 | Preview calculations, zero input, small amounts |
| RWAToken | 4 | Name/symbol, owner minting, non-owner revert, burning |

## Tech Stack

- **Solidity** ^0.8.28 with OpenZeppelin v5.x
- **Hardhat** — compilation, testing, local node
- **TypeScript** — tests and backend
- **ethers.js** v6 — blockchain interaction
- **Express** v5 — backend API
- **Chai** — assertions

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/ITreasury.sol";
import "./interfaces/IRWAToken.sol";

/**
 * @title Treasury
 * @notice The Treasury is the central contract in the RWA tokenisation flow.
 *         Users deposit either native ETH or an accepted ERC-20 token, and
 *         the Treasury mints RWA tokens back to them at a configurable
 *         exchange rate.
 */
contract Treasury is ITreasury, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The RWA token minted on deposits.
    IRWAToken public immutable rwaToken;

    /// @notice The accepted ERC-20 deposit token (e.g. mUSDC).
    IERC20 public immutable depositToken;

    /// @notice Number of RWA tokens minted per whole unit deposited.
    ///         e.g. 100 means 1 ETH (or 1e18 mUSDC) → 100 RWA tokens.
    uint256 public exchangeRate;

    /// @notice Running total of ETH deposited (in wei).
    uint256 public totalETHDeposits;

    /// @notice Running total of ERC-20 tokens deposited (in wei).
    uint256 public totalTokenDeposits;

    /**
     * @param rwaToken_      Address of the deployed RWAToken contract.
     * @param depositToken_  Address of the accepted ERC-20 deposit token.
     * @param exchangeRate_  Initial exchange rate (RWA tokens per deposit unit).
     * @param owner_         Treasury owner / admin.
     */
    constructor(
        address rwaToken_,
        address depositToken_,
        uint256 exchangeRate_,
        address owner_
    ) Ownable(owner_) {
        if (rwaToken_ == address(0)) revert ZeroAddress();
        if (depositToken_ == address(0)) revert ZeroAddress();
        if (exchangeRate_ == 0) revert ZeroAmount();

        rwaToken = IRWAToken(rwaToken_);
        depositToken = IERC20(depositToken_);
        exchangeRate = exchangeRate_;
    }

    /**
     * @inheritdoc ITreasury
     * @dev When `token == address(0)` the function expects `msg.value > 0`
     *      and ignores the `amount` parameter. When `token == depositToken`
     *      the caller must have approved this contract for at least `amount`.
     */
    function deposit(
        address token,
        uint256 amount
    ) external payable override nonReentrant {
        if (token == address(0)) {
            // ETH deposit
            if (msg.value == 0) revert ZeroAmount();
            amount = msg.value; 
            totalETHDeposits += amount;
        } else {
            // ERC-20 deposit
            if (token != address(depositToken)) revert TokenNotAccepted();
            if (amount == 0) revert ZeroAmount();
            if (msg.value != 0) revert ETHNotAccepted();

            depositToken.safeTransferFrom(msg.sender, address(this), amount);
            totalTokenDeposits += amount;
        }

        uint256 tokensToMint = _calculateMintAmount(amount);
        rwaToken.mint(msg.sender, tokensToMint);

        emit Deposited(msg.sender, token, amount, tokensToMint);
    }

    // External — Withdraw  (owner only)
    function withdraw(
        address to,
        address token,
        uint256 amount
    ) external override onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        if (token == address(0)) {
            // ── ETH withdrawal ──
            if (address(this).balance < amount) revert InsufficientBalance();

            (bool success, ) = to.call{value: amount}("");
            if (!success) revert ETHTransferFailed();
        } else {
            // ── ERC-20 withdrawal ──
            if (token != address(depositToken)) revert TokenNotAccepted();

            uint256 balance = depositToken.balanceOf(address(this));
            if (balance < amount) revert InsufficientBalance();

            depositToken.safeTransfer(to, amount);
        }

        emit Withdrawn(to, token, amount);
    }

    //  View helpers

    /**
     * @inheritdoc ITreasury
     */
    function previewDeposit(
        uint256 amount
    ) external view override returns (uint256) {
        return _calculateMintAmount(amount);
    }

    //  Internal helpers

    /**
     * @dev Calculates the number of RWA tokens to mint for a given deposit.
     * @param depositAmount The raw deposit amount (in wei).
     * @return mintAmount   The number of RWA tokens to mint (in wei).
     */
    function _calculateMintAmount(
        uint256 depositAmount
    ) internal view returns (uint256 mintAmount) {
        // exchangeRate is expressed as "tokens per 1 whole unit" (1e18).
        // Formula:  mintAmount = depositAmount * exchangeRate
        // Both depositAmount and result are in 18-decimal precision.
        mintAmount = depositAmount * exchangeRate;
    }
}

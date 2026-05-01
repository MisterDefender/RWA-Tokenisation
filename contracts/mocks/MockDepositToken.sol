// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockDepositToken
 * @notice A simple ERC-20 token used in tests and local development to
 *         simulate a stablecoin / deposit asset (e.g. USDC, DAI).
 * @dev    Anyone can mint — this is intentional for testing convenience.
 */
contract MockDepositToken is ERC20 {
    constructor() ERC20("Mock USD Coin", "mUSDC") {}

    /**
     * @notice Mint tokens to any address. No access control — test only.
     * @param to     Recipient address.
     * @param amount Amount to mint.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

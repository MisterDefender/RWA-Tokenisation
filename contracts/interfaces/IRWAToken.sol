// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IRWAToken
 * @notice Interface for the RWA (Real-World Asset) fractional ownership token.
 */
interface IRWAToken {
    /**
     * @notice Mints new RWA tokens to a specified address.
     * @dev Only callable by the authorised minter (Treasury).
     * @param to     Recipient of the minted tokens.
     * @param amount Number of tokens to mint (in wei units).
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Burns tokens from the caller's balance.
     * @param amount Number of tokens to burn (in wei units).
     */
    function burn(uint256 amount) external;
}

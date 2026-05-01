// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ITreasury
 * @notice Interface for the RWA Treasury contract.
 * @dev The Treasury accepts deposits (ETH or ERC-20) and mints RWA tokens
 *      in return. Pass `address(0)` as the deposit token to deposit native ETH.
 */
interface ITreasury {
    //  Events

    /**
     * @notice Emitted on every successful deposit.
     * @param depositor    Address that made the deposit.
     * @param token        Token address used for deposit (`address(0)` = ETH).
     * @param depositAmount Amount of ETH / ERC-20 deposited.
     * @param mintedAmount  Amount of RWA tokens minted to the depositor.
     */
    event Deposited(
        address indexed depositor,
        address indexed token,
        uint256 depositAmount,
        uint256 mintedAmount
    );

    /**
     * @notice Emitted when the owner withdraws funds from the treasury.
     * @param to     Recipient of the withdrawn funds.
     * @param token  Token address withdrawn (`address(0)` = ETH).
     * @param amount Amount withdrawn.
     */
    event Withdrawn(
        address indexed to,
        address indexed token,
        uint256 amount
    );


    //  Errors

    /// @notice Thrown when a zero amount is provided.
    error ZeroAmount();

    /// @notice Thrown when a zero address is provided where it is not allowed.
    error ZeroAddress();

    /// @notice Thrown when the deposited token is not accepted by the treasury.
    error TokenNotAccepted();

    /// @notice Thrown when an ETH deposit sends an incorrect `msg.value`.
    error InvalidETHAmount();

    /// @notice Thrown when an ERC-20 deposit is sent with non-zero `msg.value`.
    error ETHNotAccepted();

    /// @notice Thrown when a withdrawal exceeds the available balance.
    error InsufficientBalance();

    /// @notice Thrown when a native ETH transfer fails.
    error ETHTransferFailed();


    //  Core functions

    /**
     * @notice Deposit funds into the treasury and receive RWA tokens.
     * @dev    Pass `address(0)` as `token` and attach ETH via `msg.value`
     *         to deposit native ETH. For ERC-20 deposits, approve the
     *         treasury first, then call with the token address and amount.
     * @param token  The deposit token address (`address(0)` for ETH).
     * @param amount The amount to deposit (ignored for ETH — uses `msg.value`).
     */
    function deposit(address token, uint256 amount) external payable;

    /**
     * @notice Withdraw funds from the treasury (owner only).
     * @param to     Recipient address.
     * @param token  Token to withdraw (`address(0)` for ETH).
     * @param amount Amount to withdraw.
     */
    function withdraw(address to, address token, uint256 amount) external;

    /**
     * @notice Preview how many RWA tokens would be minted for a given deposit.
     * @param amount The deposit amount.
     * @return The number of RWA tokens that would be minted.
     */
    function previewDeposit(uint256 amount) external view returns (uint256);
}

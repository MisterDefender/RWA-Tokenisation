// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RWAToken
 * @notice ERC-20 token representing fractional ownership of a real-world asset.
 * @dev    Only the owner (Treasury contract) can mint new tokens. 
 */
contract RWAToken is ERC20, ERC20Burnable, Ownable {
    /**
     * @param name_   Token name  (e.g. "RWA Property Token").
     * @param symbol_ Token symbol (e.g. "RWAP").
     * @param owner_  Initial owner — typically the deployer, later transferred
     *                to the Treasury contract.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {}


    //  External functions

    /**
     * @notice Mint new RWA tokens to a recipient.
     * @dev    Restricted to the contract owner (Treasury).
     * @param to     Address receiving the minted tokens.
     * @param amount Amount to mint (in wei, 18-decimal precision).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

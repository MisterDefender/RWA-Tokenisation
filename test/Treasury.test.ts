import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Treasury, RWAToken, MockDepositToken } from "../typechain-types";

const TOKEN_NAME = "RWA Property Token";
const TOKEN_SYMBOL = "RWAP";
const EXCHANGE_RATE = 100n; // 1 ETH (or 1 mUSDC) → 100 RWA tokens
const ADDRESS_ZERO = ethers.ZeroAddress;

/**
 * Deployment order:
 *   1. MockDepositToken
 *   2. RWAToken  (deployer as initial owner)
 *   3. Treasury  (references both tokens)
 *   4. Transfer RWAToken ownership → Treasury
 */
async function deployFullSuiteFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  // 1. Mock deposit token
  const MockDepositToken = await ethers.getContractFactory("MockDepositToken");
  const depositToken = await MockDepositToken.deploy();

  // 2. RWA token  (deployer owns initially)
  const RWAToken = await ethers.getContractFactory("RWAToken");
  const rwaToken = await RWAToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, owner.address);

  // 3. Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(
    await rwaToken.getAddress(),
    await depositToken.getAddress(),
    EXCHANGE_RATE,
    owner.address
  );

  // 4. Hand minting rights to the Treasury
  await rwaToken.transferOwnership(await treasury.getAddress());

  // Mint some mock deposit tokens for Alice & Bob (1000 each)
  const mintAmount = ethers.parseEther("1000");
  await depositToken.mint(alice.address, mintAmount);
  await depositToken.mint(bob.address, mintAmount);

  return { treasury, rwaToken, depositToken, owner, alice, bob };
}

// ─────────────────────────────────────────────────────────────
//  Test suite
// ─────────────────────────────────────────────────────────────

describe("Treasury", function () {
  // ────────────── Deployment ──────────────

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      const { treasury, owner } = await loadFixture(deployFullSuiteFixture);
      expect(await treasury.owner()).to.equal(owner.address);
    });

    it("should set the correct RWA token address", async function () {
      const { treasury, rwaToken } = await loadFixture(deployFullSuiteFixture);
      expect(await treasury.rwaToken()).to.equal(await rwaToken.getAddress());
    });

    it("should set the correct deposit token address", async function () {
      const { treasury, depositToken } = await loadFixture(deployFullSuiteFixture);
      expect(await treasury.depositToken()).to.equal(await depositToken.getAddress());
    });

    it("should set the correct exchange rate", async function () {
      const { treasury } = await loadFixture(deployFullSuiteFixture);
      expect(await treasury.exchangeRate()).to.equal(EXCHANGE_RATE);
    });

    it("should have transferred RWA token ownership to Treasury", async function () {
      const { treasury, rwaToken } = await loadFixture(deployFullSuiteFixture);
      expect(await rwaToken.owner()).to.equal(await treasury.getAddress());
    });

    it("should revert if rwaToken is zero address", async function () {
      const [owner] = await ethers.getSigners();
      const MockDepositToken = await ethers.getContractFactory("MockDepositToken");
      const dt = await MockDepositToken.deploy();

      const Treasury = await ethers.getContractFactory("Treasury");
      await expect(
        Treasury.deploy(ADDRESS_ZERO, await dt.getAddress(), EXCHANGE_RATE, owner.address)
      ).to.be.revertedWithCustomError(Treasury, "ZeroAddress");
    });

    it("should revert if exchange rate is zero", async function () {
      const [owner] = await ethers.getSigners();
      const MockDepositToken = await ethers.getContractFactory("MockDepositToken");
      const dt = await MockDepositToken.deploy();
      const RWAToken = await ethers.getContractFactory("RWAToken");
      const rwa = await RWAToken.deploy("T", "T", owner.address);

      const Treasury = await ethers.getContractFactory("Treasury");
      await expect(
        Treasury.deploy(await rwa.getAddress(), await dt.getAddress(), 0, owner.address)
      ).to.be.revertedWithCustomError(Treasury, "ZeroAmount");
    });
  });

  // ────────────── ETH Deposit Flow ──────────────

  describe("ETH Deposit Flow", function () {
    it("should accept ETH deposits and mint correct RWA tokens", async function () {
      const { treasury, rwaToken, alice } = await loadFixture(deployFullSuiteFixture);

      const depositAmount = ethers.parseEther("2");
      const expectedMint = depositAmount * EXCHANGE_RATE; // 2 * 100 = 200 tokens

      await treasury.connect(alice).deposit(ADDRESS_ZERO, 0, { value: depositAmount });

      expect(await rwaToken.balanceOf(alice.address)).to.equal(expectedMint);
    });

    it("should update totalETHDeposits correctly", async function () {
      const { treasury, alice } = await loadFixture(deployFullSuiteFixture);

      const depositAmount = ethers.parseEther("5");
      await treasury.connect(alice).deposit(ADDRESS_ZERO, 0, { value: depositAmount });

      expect(await treasury.totalETHDeposits()).to.equal(depositAmount);
    });

    it("should increase Treasury ETH balance", async function () {
      const { treasury, alice } = await loadFixture(deployFullSuiteFixture);

      const depositAmount = ethers.parseEther("3");
      await treasury.connect(alice).deposit(ADDRESS_ZERO, 0, { value: depositAmount });

      const treasuryAddr = await treasury.getAddress();
      expect(await ethers.provider.getBalance(treasuryAddr)).to.equal(depositAmount);
    });

    it("should emit Deposited event with correct args for ETH", async function () {
      const { treasury, alice } = await loadFixture(deployFullSuiteFixture);

      const depositAmount = ethers.parseEther("1");
      const expectedMint = depositAmount * EXCHANGE_RATE;

      await expect(
        treasury.connect(alice).deposit(ADDRESS_ZERO, 0, { value: depositAmount })
      )
        .to.emit(treasury, "Deposited")
        .withArgs(alice.address, ADDRESS_ZERO, depositAmount, expectedMint);
    });

    it("should revert ETH deposit with zero value", async function () {
      const { treasury, alice } = await loadFixture(deployFullSuiteFixture);

      await expect(
        treasury.connect(alice).deposit(ADDRESS_ZERO, 0, { value: 0 })
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });
  });

  // ────────────── ERC-20 Deposit Flow ──────────────

  describe("ERC-20 Deposit Flow", function () {
    it("should accept ERC-20 deposits and mint correct RWA tokens", async function () {
      const { treasury, rwaToken, depositToken, alice } = await loadFixture(
        deployFullSuiteFixture
      );

      const depositAmount = ethers.parseEther("50");
      const expectedMint = depositAmount * EXCHANGE_RATE;
      const treasuryAddr = await treasury.getAddress();

      await depositToken.connect(alice).approve(treasuryAddr, depositAmount);
      await treasury
        .connect(alice)
        .deposit(await depositToken.getAddress(), depositAmount);

      expect(await rwaToken.balanceOf(alice.address)).to.equal(expectedMint);
    });

    it("should transfer deposit tokens to Treasury", async function () {
      const { treasury, depositToken, alice } = await loadFixture(
        deployFullSuiteFixture
      );

      const depositAmount = ethers.parseEther("25");
      const treasuryAddr = await treasury.getAddress();

      await depositToken.connect(alice).approve(treasuryAddr, depositAmount);
      await treasury
        .connect(alice)
        .deposit(await depositToken.getAddress(), depositAmount);

      expect(await depositToken.balanceOf(treasuryAddr)).to.equal(depositAmount);
    });

    it("should update totalTokenDeposits correctly", async function () {
      const { treasury, depositToken, alice } = await loadFixture(
        deployFullSuiteFixture
      );

      const depositAmount = ethers.parseEther("10");
      const treasuryAddr = await treasury.getAddress();

      await depositToken.connect(alice).approve(treasuryAddr, depositAmount);
      await treasury
        .connect(alice)
        .deposit(await depositToken.getAddress(), depositAmount);

      expect(await treasury.totalTokenDeposits()).to.equal(depositAmount);
    });

    it("should emit Deposited event with correct args for ERC-20", async function () {
      const { treasury, depositToken, alice } = await loadFixture(
        deployFullSuiteFixture
      );

      const depositAmount = ethers.parseEther("10");
      const expectedMint = depositAmount * EXCHANGE_RATE;
      const treasuryAddr = await treasury.getAddress();
      const depositTokenAddr = await depositToken.getAddress();

      await depositToken.connect(alice).approve(treasuryAddr, depositAmount);

      await expect(
        treasury.connect(alice).deposit(depositTokenAddr, depositAmount)
      )
        .to.emit(treasury, "Deposited")
        .withArgs(alice.address, depositTokenAddr, depositAmount, expectedMint);
    });

    it("should revert ERC-20 deposit with zero amount", async function () {
      const { treasury, depositToken, alice } = await loadFixture(
        deployFullSuiteFixture
      );

      await expect(
        treasury
          .connect(alice)
          .deposit(await depositToken.getAddress(), 0)
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });

    it("should revert ERC-20 deposit when ETH is sent along", async function () {
      const { treasury, depositToken, alice } = await loadFixture(
        deployFullSuiteFixture
      );

      const depositAmount = ethers.parseEther("10");
      const treasuryAddr = await treasury.getAddress();

      await depositToken.connect(alice).approve(treasuryAddr, depositAmount);

      await expect(
        treasury
          .connect(alice)
          .deposit(await depositToken.getAddress(), depositAmount, {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWithCustomError(treasury, "ETHNotAccepted");
    });

    it("should revert deposit with an unaccepted token address", async function () {
      const { treasury, alice } = await loadFixture(deployFullSuiteFixture);

      // Use a random address as the token — not the accepted deposit token
      const fakeToken = ethers.Wallet.createRandom().address;

      await expect(
        treasury.connect(alice).deposit(fakeToken, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(treasury, "TokenNotAccepted");
    });

    it("should revert ERC-20 deposit without prior approval", async function () {
      const { treasury, depositToken, alice } = await loadFixture(
        deployFullSuiteFixture
      );

      const depositAmount = ethers.parseEther("10");

      // No approval given — should revert
      await expect(
        treasury
          .connect(alice)
          .deposit(await depositToken.getAddress(), depositAmount)
      ).to.be.reverted; // SafeERC20 will revert
    });
  });

  // ────────────── Withdrawal Flow ──────────────

  describe("Withdrawal Flow", function () {
    it("should allow owner to withdraw ETH", async function () {
      const { treasury, alice, owner } = await loadFixture(deployFullSuiteFixture);

      const depositAmount = ethers.parseEther("5");
      await treasury.connect(alice).deposit(ADDRESS_ZERO, 0, { value: depositAmount });

      const ownerBalBefore = await ethers.provider.getBalance(owner.address);

      const tx = await treasury
        .connect(owner)
        .withdraw(owner.address, ADDRESS_ZERO, depositAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const ownerBalAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalAfter).to.equal(ownerBalBefore + depositAmount - gasUsed);
    });

    it("should allow owner to withdraw ERC-20 tokens", async function () {
      const { treasury, depositToken, alice, owner } = await loadFixture(
        deployFullSuiteFixture
      );

      const depositAmount = ethers.parseEther("50");
      const treasuryAddr = await treasury.getAddress();
      const depositTokenAddr = await depositToken.getAddress();

      await depositToken.connect(alice).approve(treasuryAddr, depositAmount);
      await treasury.connect(alice).deposit(depositTokenAddr, depositAmount);

      await treasury.connect(owner).withdraw(owner.address, depositTokenAddr, depositAmount);

      expect(await depositToken.balanceOf(owner.address)).to.equal(depositAmount);
      expect(await depositToken.balanceOf(treasuryAddr)).to.equal(0);
    });

    it("should emit Withdrawn event", async function () {
      const { treasury, alice, owner } = await loadFixture(deployFullSuiteFixture);

      const depositAmount = ethers.parseEther("3");
      await treasury.connect(alice).deposit(ADDRESS_ZERO, 0, { value: depositAmount });

      await expect(
        treasury.connect(owner).withdraw(owner.address, ADDRESS_ZERO, depositAmount)
      )
        .to.emit(treasury, "Withdrawn")
        .withArgs(owner.address, ADDRESS_ZERO, depositAmount);
    });

    it("should revert withdrawal to zero address", async function () {
      const { treasury, alice, owner } = await loadFixture(deployFullSuiteFixture);

      await treasury
        .connect(alice)
        .deposit(ADDRESS_ZERO, 0, { value: ethers.parseEther("1") });

      await expect(
        treasury
          .connect(owner)
          .withdraw(ADDRESS_ZERO, ADDRESS_ZERO, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(treasury, "ZeroAddress");
    });

    it("should revert withdrawal of zero amount", async function () {
      const { treasury, owner } = await loadFixture(deployFullSuiteFixture);

      await expect(
        treasury.connect(owner).withdraw(owner.address, ADDRESS_ZERO, 0)
      ).to.be.revertedWithCustomError(treasury, "ZeroAmount");
    });

    it("should revert ETH withdrawal when balance is insufficient", async function () {
      const { treasury, owner } = await loadFixture(deployFullSuiteFixture);

      await expect(
        treasury
          .connect(owner)
          .withdraw(owner.address, ADDRESS_ZERO, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(treasury, "InsufficientBalance");
    });

    it("should revert ERC-20 withdrawal when balance is insufficient", async function () {
      const { treasury, depositToken, owner } = await loadFixture(
        deployFullSuiteFixture
      );

      await expect(
        treasury
          .connect(owner)
          .withdraw(
            owner.address,
            await depositToken.getAddress(),
            ethers.parseEther("100")
          )
      ).to.be.revertedWithCustomError(treasury, "InsufficientBalance");
    });
  });

  // ────────────── Edge Cases / Access Control ──────────────

  describe("Access Control & Edge Cases", function () {
    it("should revert when non-owner tries to withdraw ETH", async function () {
      const { treasury, alice } = await loadFixture(deployFullSuiteFixture);

      // Alice deposits first
      await treasury
        .connect(alice)
        .deposit(ADDRESS_ZERO, 0, { value: ethers.parseEther("2") });

      // Alice tries to withdraw — must revert
      await expect(
        treasury
          .connect(alice)
          .withdraw(alice.address, ADDRESS_ZERO, ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });

    it("should revert when non-owner tries to withdraw ERC-20", async function () {
      const { treasury, depositToken, alice } = await loadFixture(
        deployFullSuiteFixture
      );

      const depositAmount = ethers.parseEther("10");
      const treasuryAddr = await treasury.getAddress();
      const depositTokenAddr = await depositToken.getAddress();

      await depositToken.connect(alice).approve(treasuryAddr, depositAmount);
      await treasury.connect(alice).deposit(depositTokenAddr, depositAmount);

      await expect(
        treasury.connect(alice).withdraw(alice.address, depositTokenAddr, depositAmount)
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });

    it("should handle multiple deposits from different users correctly", async function () {
      const { treasury, rwaToken, alice, bob } = await loadFixture(
        deployFullSuiteFixture
      );

      const aliceDeposit = ethers.parseEther("3");
      const bobDeposit = ethers.parseEther("7");

      await treasury.connect(alice).deposit(ADDRESS_ZERO, 0, { value: aliceDeposit });
      await treasury.connect(bob).deposit(ADDRESS_ZERO, 0, { value: bobDeposit });

      expect(await rwaToken.balanceOf(alice.address)).to.equal(
        aliceDeposit * EXCHANGE_RATE
      );
      expect(await rwaToken.balanceOf(bob.address)).to.equal(
        bobDeposit * EXCHANGE_RATE
      );
      expect(await treasury.totalETHDeposits()).to.equal(aliceDeposit + bobDeposit);
    });
  });

  // ────────────── Preview Deposit ──────────────

  describe("Preview Deposit", function () {
    it("should return correct preview for a given amount", async function () {
      const { treasury } = await loadFixture(deployFullSuiteFixture);

      const amount = ethers.parseEther("5");
      const expected = amount * EXCHANGE_RATE;

      expect(await treasury.previewDeposit(amount)).to.equal(expected);
    });

    it("should return zero for zero input", async function () {
      const { treasury } = await loadFixture(deployFullSuiteFixture);
      expect(await treasury.previewDeposit(0)).to.equal(0);
    });

    it("should handle small amounts correctly", async function () {
      const { treasury } = await loadFixture(deployFullSuiteFixture);

      const amount = 1n; // 1 wei
      expect(await treasury.previewDeposit(amount)).to.equal(EXCHANGE_RATE);
    });
  });
});

// ─────────────────────────────────────────────────────────────
//  RWAToken — isolated tests
// ─────────────────────────────────────────────────────────────

describe("RWAToken", function () {
  async function deployTokenFixture() {
    const [owner, alice] = await ethers.getSigners();

    const RWAToken = await ethers.getContractFactory("RWAToken");
    const rwaToken = await RWAToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, owner.address);

    return { rwaToken, owner, alice };
  }

  it("should have correct name and symbol", async function () {
    const { rwaToken } = await loadFixture(deployTokenFixture);
    expect(await rwaToken.name()).to.equal(TOKEN_NAME);
    expect(await rwaToken.symbol()).to.equal(TOKEN_SYMBOL);
  });

  it("should allow owner to mint", async function () {
    const { rwaToken, owner, alice } = await loadFixture(deployTokenFixture);

    const amount = ethers.parseEther("100");
    await rwaToken.connect(owner).mint(alice.address, amount);

    expect(await rwaToken.balanceOf(alice.address)).to.equal(amount);
  });

  it("should revert mint from non-owner", async function () {
    const { rwaToken, alice } = await loadFixture(deployTokenFixture);

    await expect(
      rwaToken.connect(alice).mint(alice.address, ethers.parseEther("100"))
    ).to.be.revertedWithCustomError(rwaToken, "OwnableUnauthorizedAccount");
  });

  it("should allow token holders to burn their tokens", async function () {
    const { rwaToken, owner, alice } = await loadFixture(deployTokenFixture);

    const amount = ethers.parseEther("50");
    await rwaToken.connect(owner).mint(alice.address, amount);
    await rwaToken.connect(alice).burn(ethers.parseEther("20"));

    expect(await rwaToken.balanceOf(alice.address)).to.equal(ethers.parseEther("30"));
  });
});

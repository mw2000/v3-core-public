const { expect } = require("chai");
const { ethers } = require("hardhat");
const zeroAddress = ethers.constants.AddressZero;

describe("AccessControlManager", function() {
  let AccessControlManager, accessControlManager, admin, addr1, addr2;
  const PLATFORM_ADMIN = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("PLATFORM_ADMIN")
  );

  beforeEach(async () => {
    AccessControlManager = await ethers.getContractFactory(
      "AccessControlManager"
    );
    [admin, addr1, addr2, _] = await ethers.getSigners();

    accessControlManager = await upgrades.deployProxy(
      AccessControlManager,
      [
        {
          admin: admin.address,
          swellTreasury: addr1.address,
        },
      ],
      {
        initializer: "initialize",
      }
    );
  });

  describe("Initialization", function() {
    it("Should set the right roles", async function() {
      expect(await accessControlManager.hasRole(PLATFORM_ADMIN, admin.address)).to.equal(
        true
      );
    });
  });

  describe("Set SwellTreasury", function() {
    it("Should fail if not PLATFORM_ADMIN", async function() {
      await expect(
        accessControlManager.connect(addr2).setSwellTreasury(addr1.address)
      ).to.be.revertedWith(
        `AccessControl: account ${addr2.address.toLowerCase()} is missing role ${PLATFORM_ADMIN}`
      );
    });

    it("Should fail if address is zero", async function() {
      await expect(
        accessControlManager.setSwellTreasury(zeroAddress)
      ).to.be.revertedWith("CannotBeZeroAddress");
    });
  });

  describe("Core Methods Pause Functionality", function() {
    it("Should pause core methods correctly", async function() {
      if (!(await accessControlManager.coreMethodsPaused())) {
        await accessControlManager.connect(admin).pauseCoreMethods();
      }
      expect(await accessControlManager.coreMethodsPaused()).to.equal(true);
    });
  
    it("Should unpause core methods correctly", async function() {
      if (await accessControlManager.coreMethodsPaused()) {
        await accessControlManager.connect(admin).unpauseCoreMethods();
      }
      expect(await accessControlManager.coreMethodsPaused()).to.equal(false);
    });
  });  

  describe("Role Check", function() {
    it("Should return true for PLATFORM_ADMIN role check", async function() {
      await accessControlManager.checkRole(PLATFORM_ADMIN, admin.address);
      expect(await accessControlManager.hasRole(PLATFORM_ADMIN, admin.address)).to.equal(true);
    });
  });

  describe("Token Withdrawal", function() {
    it("Should revert if contract has no ERC20 tokens to withdraw", async function() {
      const dummyToken = await ethers.getContractFactory("swETH");
      const token = await dummyToken.deploy();

      await expect(
        accessControlManager.connect(admin).withdrawERC20(token.address)
      ).to.be.revertedWith("NoTokensToWithdraw");
    });
  });
});

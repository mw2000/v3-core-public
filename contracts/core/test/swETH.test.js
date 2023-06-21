const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

describe("swETH", function () {
  let swETH, admin, bot, addr1, addr2, accessControlManager;
  const PLATFORM_ADMIN = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("PLATFORM_ADMIN")
  );

  beforeEach(async function () {
    const AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    [admin, bot, addr1, addr2] = await ethers.getSigners();

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
    await accessControlManager.deployed();
  
    // Deploying SWETH
    const ERC20 = await ethers.getContractFactory("swETH");
    const token = await ERC20.deploy();
    await token.deployed();
  
    const swETHFactory = await ethers.getContractFactory("swETH");
    swETH = await upgrades.deployProxy(swETHFactory, [accessControlManager.address], { initializer: 'initialize' });
  });
  

  it("Should initialize the contract correctly", async function() {
    expect(await swETH.totalETHDeposited()).to.equal(0);
    expect(await swETH.minimumRepriceTime()).to.equal(0);
    expect(await swETH.maximumRepriceDifferencePercentage()).to.equal(0);
    expect(await swETH.maximumRepriceswETHDifferencePercentage()).to.equal(0);
    expect(await accessControlManager.hasRole(PLATFORM_ADMIN, admin.address)).to.equal(
      true
    );
  });

  it("Should revert if deposit is made without whitelist", async function() {
    await expect(swETH.connect(addr1).deposit({value: ethers.utils.parseEther("1")})).to.be.reverted;
  });

  it("Should revert if withdrawERC20 is called by non-admin", async function() {
    await expect(swETH.connect(addr1).withdrawERC20(swETH.address)).to.be.reverted;
  });

  it("Should fail if called by non-bot address", async function () {
    await expect(
      swETH.connect(addr1).reprice(
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("10")
      )
    ).to.be.reverted;
  });

  it("Should fail if time since last reprice is less than minimumRepriceTime", async function () {
    await swETH.connect(bot).reprice(
      ethers.utils.parseEther("5"),
      ethers.utils.parseEther("2"),
      ethers.utils.parseEther("10")
    );
    await expect(
      swETH.connect(bot).reprice(
        ethers.utils.parseEther("6"),
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("12")
      )
    ).to.be.revertedWith("NotEnoughTimeElapsedForReprice");
  });

  it("Should update the lastRepriceETHReserves and swETHToETHRateFixed correctly", async function () {
    await swETH.connect(admin).reprice(
      ethers.utils.parseEther("5"),
      ethers.utils.parseEther("2"),
      ethers.utils.parseEther("10")
    );
    expect(await swETH.lastRepriceETHReserves()).to.equal(ethers.utils.parseEther("7"));
    expect(await swETH.swETHToETHRate()).to.be.closeTo(ethers.utils.parseEther("0.7"), 0.1);
  });
  
  it("Should fail if called by non-bot address", async function () {
    await expect(
      swETH.connect(addr1).reprice(
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("10")
      )
    ).to.be.revertedWith("AccessControlManager: caller is not an authorized operator");
  });

  it("Should fail if botMethodsPaused is true", async function () {
    await accessControlManager.botMethodsPaused();
    await expect(
      swETH.connect(addr1).reprice(
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("10")
      )
    ).to.be.revertedWith("SwellLib.BotMethodsPaused");
  });

  it("Should fail if time since last reprice is less than minimumRepriceTime", async function () {
    await swETH.connect(addr1).reprice(
      ethers.utils.parseEther("5"),
      ethers.utils.parseEther("2"),
      ethers.utils.parseEther("10")
    );
    await expect(
      swETH.connect(bot).reprice(
        ethers.utils.parseEther("6"),
        ethers.utils.parseEther("2"),
        ethers.utils.parseEther("12")
      )
    ).to.be.revertedWith("NotEnoughTimeElapsedForReprice");
  });

  it("Should update the lastRepriceETHReserves and swETHToETHRateFixed correctly", async function () {
    await swETH.connect(bot).reprice(
      ethers.utils.parseEther("5"),
      ethers.utils.parseEther("2"),
      ethers.utils.parseEther("10")
    );
    expect(await swETH.lastRepriceETHReserves()).to.equal(ethers.utils.parseEther("7"));
    expect(await swETH.swETHToETHRate()).to.be.closeTo(ethers.utils.parseEther("0.7"), 0.1);
  });
});

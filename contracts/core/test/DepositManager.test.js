const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DepositManager", function () {
  let DepositManager, depositManager, AccessControlManager, accessControlManager, admin, addr1, addr2;
  const BOT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BOT"));
  const PLATFORM_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PLATFORM_ADMIN"));

  beforeEach(async function () {
    AccessControlManager = await ethers.getContractFactory("AccessControlManager");
    [admin, addr1, addr2, _] = await ethers.getSigners();
    accessControlManager = await upgrades.deployProxy(AccessControlManager, [{admin: admin.address, swellTreasury: addr1.address}], {initializer: "initialize"});
  
    DepositManager = await ethers.getContractFactory("DepositManager");
    depositManager = await upgrades.deployProxy(DepositManager, [], {initializer: false});
    await depositManager.initialize(accessControlManager.address);
  });

  describe("Initialization", function() {
    it("Should initialize the deposit contract correctly", async function() {
      expect(await depositManager.AccessControlManager()).to.equal(accessControlManager.address);
    });
  });


  describe("setupValidators", function() {
    it("Should revert if contract has insufficient ETH balance", async function() {
      const pubKeys = [
        "0x439a2b6a7336114774c4a7e0af8174142432b8b2c5a64b7b390918c5427b3ac1d4f5efca4be23b27f0ff9d6f3f7766c9",
        "0x8e99c4696fd67a653f1eff9b7c1b4d7df8a1f470aa3668e6eaf4b45792e8ee50caacb73e1185d9a5e6ca91c8557568b2"
      ]; 
      
      await expect(
        depositManager.connect(addr1).setupValidators(pubKeys, ethers.constants.HashZero)
      ).to.be.revertedWith("InsufficientETHBalance");
    });

    it("Should set up validators correctly", async function() {
      // Funding the contract with 32 ether (the minimum deposit amount for a validator)
      await admin.sendTransaction({
        to: depositManager.address,
        value: ethers.utils.parseEther("32"),
      });

      const pubKeys = [
        "0x439a2b6a7336114774c4a7e0af8174142432b8b2c5a64b7b390918c5427b3ac1d4f5efca4be23b27f0ff9d6f3f7766c9",
        "0x8e99c4696fd67a653f1eff9b7c1b4d7df8a1f470aa3668e6eaf4b45792e8ee50caacb73e1185d9a5e6ca91c8557568b2"
      ];

      // Assuming NodeOperatorRegistry and DepositContract behave as expected
      const mockNodeOperatorRegistry = await ethers.getContractFactory("NodeOperatorRegistry");
      const mockDepositContract = await ethers.getContractFactory("DepositManager");
      
      const usePubKeysForValidatorSetupResult = [
        {
          pubKey: pubKeys[0],
          signature: "0xabcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcdef" 
        },
        {
          pubKey: pubKeys[1],
          signature: "0xfedcba654321fedcba654321fedcba654321fedcba654321fedcba654321fedc"
        }
      ];
      await mockNodeOperatorRegistry.mock.usePubKeysForValidatorSetup.returns(usePubKeysForValidatorSetupResult);
      
      await mockDepositContract.mock.deposit.returns(); // assuming it does not return anything

      // Setup validators
      await depositManager.connect(admin).setupValidators(pubKeys, ethers.constants.HashZero);

      await expect(mockNodeOperatorRegistry.mock.usePubKeysForValidatorSetup).to.have.been.calledWith(pubKeys);
      await expect(mockDepositContract.mock.deposit).to.have.been.called;
    });
  });

  describe("withdrawERC20", function() {
    it("Should revert if not PLATFORM_ADMIN", async function() {
      const dummyToken = await ethers.getContractFactory("swETH");
      const token = await dummyToken.deploy();

      await expect(
        depositManager.connect(addr2).withdrawERC20(token.address)
      ).to.be.revertedWith(
        `AccessControl: account ${addr2.address.toLowerCase()} is missing role ${PLATFORM_ADMIN}`
      );
    });

    it("Should revert if contract has no ERC20 tokens to withdraw", async function() {
      const dummyToken = await ethers.getContractFactory("swETH");
      const token = await dummyToken.deploy();

      await expect(
        depositManager.connect(admin).withdrawERC20(token.address)
      ).to.be.revertedWith("NoTokensToWithdraw");
    });
  });
});

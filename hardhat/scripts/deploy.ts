import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const Contract = await hre.ethers.getContractFactory("NewDatasetNFT");
  const contract = await Contract.deploy(deployer.address);

  await contract.waitForDeployment();   // new syntax

  console.log("NewDatasetNFT deployed at:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox"
import dotenv from "dotenv";

dotenv.config();
interface FlowNetworkConfig {
  url: string;
  accounts: string[];
  chainId: number;
}
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    flowTestnet: {
      type: "http",
      url: "https://testnet.evm.nodes.onflow.org",
      accounts: [PRIVATE_KEY],
      chainId: 545,
    },
    flow: {
      type: "http",
      url: "https://mainnet.evm.nodes.onflow.org",
      accounts: [PRIVATE_KEY],
      chainId: 747,
    },
  },
};

export default config;

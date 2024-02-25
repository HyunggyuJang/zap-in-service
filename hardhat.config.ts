import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/config';
import '@openzeppelin/hardhat-upgrades';
import '@nomicfoundation/hardhat-toolbox';

const mainnetFork = {
  url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
  blockNumber: parseInt(process.env.BLOCK_NUMBER ?? '0') || 19304000,
};

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 1_000_000,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 1,
      allowUnlimitedContractSize: false,
      forking: mainnetFork,
    },
  },
  typechain: {
    outDir: 'types',
  },
};

export default config;

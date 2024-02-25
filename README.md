# Zap In Service

Welcome to the Zap In Service project! This innovative solution is designed to streamline the liquidity provision process on Uniswap V2. It enables liquidity providers to deposit a single token into a pool and receive Uniswap V2 LP tokens in return. This project addresses the common inconvenience faced by liquidity providers who typically need to deposit both tokens in a pool. It simplifies the process, making it more accessible for users, especially those new to DeFi, to participate in liquidity provision.

## Getting Started

This section will guide you through the prerequisites, installation process, and how to run tests for the Zap In Service project.

### Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 18)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- [Hardhat](https://hardhat.org/getting-started/) for compiling and running the smart contracts on a local blockchain
- [Poetry](https://python-poetry.org/) for managing Python dependencies (for Slither static analysis)

### Installation

Follow these steps to set up the project locally:

1. Clone the repository:
   ```sh
   git clone https://github.com/HyunggyuJang/zap-in-service.git
   ```
2. Navigate to the project directory:
   ```sh
   cd zap-in-service
   ```
3. Install the required npm packages:
   ```sh
   npm install
   ```
4. Install the required Poetry packages:
   ```sh
    poetry install
    ```
5. Set up your environment variables by creating a `.env` file in the root directory and adding the following:
   ```sh
   # .env
   INFURA_API_KEY=<your_infura_api_key>
   BLOCK_NUMBER=<block_number_you_want_to_fork>
   ```
   The `INFURA_API_KEY` is required to fork the Ethereum mainnet using Hardhat. You can obtain an API key by signing up on the [Infura website](https://infura.io/).
   The `BLOCK_NUMBER` is the block number you want to fork from the Ethereum mainnet. 

### Run Tests

To ensure the smart contracts work as expected, run the provided test scripts with Hardhat:

```sh
npm run test
```

### Run Slither Static Analysis

To perform static analysis on the smart contracts, run the following command:

```sh
npm run analyze
```

### Run Local Blockchain & Deploy Contracts

You can run a local blockchain and deploy the smart contracts using Hardhat. To do so, run the following command:

```sh
npx hardhat node
npm run deploy -- --network localhost
```

This will start a local blockchain and deploy the smart contracts to the network by running the deployment scripts.

## Design Notes

This section provides an overview of the smart contracts and the design decisions made for the Zap In Service project.

A naive approach to the Zap In Service would be to 1) split the input token amount into two equal parts, 2) swap one part for the other token using the target pool's liquidity, and 3) add the two tokens to the pool. However, this approach has several drawbacks, such as inevitable slippage and altering the pool's price, leading to a suboptimal solution where the user receives fewer LP tokens than expected.

A better approach is to use close-to-optimal solutions, such as [Uniswap V3's Swap and Add functionality](https://docs.uniswap.org/sdk/v3/guides/liquidity/swap-and-add), which aggregates swap routes to minimize slippage and maximize the amount of liquidity added to the pool. However, this approach requires a lot of bootstrapping and is not feasible for the current Zap In Service project.

The current implementation of the Zap In Service is based on the following observations:
- We can calculate the exact output amount of the output token by using Uniswap V2's formula. 

  For example, the following code snippet is taken from the `UniSwapV2Library.sol`:
  ```solidity
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "UniswapV2Library: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn.mul(997);
        uint256 numerator = amountInWithFee.mul(reserveOut);
        uint256 denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }
  ```
- Similarly, we can formulate the optimal ratio of the input token amount to the output token amount.

  The relevant function, `calculateSwapInAmount` in the `Helper.sol` contract, is based on these observations and allows for a simple and efficient solution for liquidity providers to deposit a single token into a pool and receive Uniswap V2 LP tokens in return.

A space for improvement is to implement the aforementioned Uniswap V3's Swap and Add functionality and compare the performance based on the estimated LP token amount in return from off-chain computation, such as from client-side front-end, and choose the better one.

## Time Spent on the Project
The project involved extensive research and implementation phases, including:
- Approximately 5 hours researching relevant features available in open-source projects.
- About 2 hours for theoretical research on Uniswap V2's formula and optimal token amount ratios.
- Around 2 hours researching optimal implementation strategies.
- Approximately 3 hours for the implementation of the smart contracts and tests.
- About 2 hours for documentation, including this README.

The focus was on design and research to ensure an efficient and secure implementation, leveraging battle-tested solutions from the open-source community. The implementation phase was relatively straightforward, following the completion of the design and research phases.

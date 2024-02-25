// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20; // To support ERC-7201: Namespaced Storage Layout

import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./libraries/Babylonian.sol";
import "./libraries/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract Helper is ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Uniswap V2 Router address
    IUniswapV2Router public uniswapV2Router;

    /// @notice Event emitted when a user ZapIn
    /// @param sender The address that initiated the ZapIn
    /// @param recipient The address that received the LP tokens
    /// @param pool The Uniswap V2 pair address
    /// @param tokensRec The amount of LP tokens received
    event ZapIn(address indexed sender, address indexed recipient, address indexed pool, uint256 tokensRec);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(IUniswapV2Router _router) public initializer {
        require(address(_router) != address(0), "Invalid router address");
        uniswapV2Router = _router;
    }

    /// @notice Add liquidity to a Uniswap V2 pair using single token (ERC20)
    /// @param pair Uniswap V2 pair address to deposit liquidity
    /// @param tokenA Single token address to deposit
    /// @param singleAmount Amount of single token to deposit
    /// @param to Address to receive LP tokens
    /// @param deadline Unix timestamp after which the transaction will revert
    function singleTokenAddLiquidity(
        IUniswapV2Pair pair,
        address tokenA,
        uint256 singleAmount,
        address to,
        uint256 deadline
    ) external {
        require(address(pair) != address(0), "Invalid pair address");
        require(tokenA != address(0), "Invalid token address");
        require(singleAmount > 0, "Invalid amount");
        require(to != address(0), "Invalid to address");

        // Transfer tokenA from sender to this contract
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), singleAmount);

        // Retrieve tokenB address from pair
        (address tokenB, uint256 resA) = retrieveTokenBAndTokenAReserve(pair, tokenA);
        
        // Calculate amount of tokenA to get optimal amount of tokenB
        uint256 amountToSwap = calculateSwapInAmount(
            resA,
            singleAmount
        );

        // Approve tokenA to be spent by Uniswap
        IERC20(tokenA).forceApprove(address(uniswapV2Router), amountToSwap);

        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;

        uint256 tokenBought = uniswapV2Router.swapExactTokensForTokens(
            amountToSwap,
            1, // enforce non-zero output amount
            path,
            address(this),
            deadline
        )[1];

        uint256 amountADesired = singleAmount - amountToSwap;
        uint256 amountBDesired = tokenBought;

        // Approve tokenA and tokenB to be spent by Uniswap
        IERC20(tokenA).forceApprove(address(uniswapV2Router), amountADesired);
        IERC20(tokenB).forceApprove(address(uniswapV2Router), amountBDesired);

        (uint256 amountA, uint256 amountB, uint256 liquidity) = uniswapV2Router.addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            1,
            1,
            to,
            deadline
        );

        // Send any remaining tokenA and tokenB to the sender
        if (amountADesired > amountA) {
            IERC20(tokenA).safeTransfer(msg.sender, amountADesired - amountA);
        }
        if (amountBDesired > amountB) {
            IERC20(tokenB).safeTransfer(msg.sender, amountBDesired - amountB);
        }

        require(liquidity > 0, "Invalid liquidity");

        emit ZapIn(msg.sender, to, address(pair), liquidity);
    }

    function retrieveTokenBAndTokenAReserve(IUniswapV2Pair pair, address tokenA) internal view returns (address, uint256) {
        address token0 = pair.token0();
        address token1 = pair.token1();

        (uint256 res0, uint256 res1, ) = pair.getReserves();

        return tokenA == token0 ? (token1, res0) : (token0, res1);
    }

    function calculateSwapInAmount(uint256 reserveIn, uint256 userIn)
        internal
        pure
        returns (uint256)
    {
        return
            Babylonian
                .sqrt(
                reserveIn.mul(userIn.mul(3988000) + reserveIn.mul(3988009))
            )
                .sub(reserveIn.mul(1997)) / 1994;
    }

}

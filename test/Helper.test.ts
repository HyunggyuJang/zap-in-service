import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { parseEther } from 'ethers';
import {
  Helper,
  IUniswapV2Factory__factory,
  IUniswapV2Pair__factory,
  IUniswapV2Router__factory,
  TestERC20__factory,
} from '../types';

describe('Helper', function () {
  const MAINNET_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async function setup() {
    const [owner, otherAccount] = await ethers.getSigners();

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const Helper = await ethers.getContractFactory('Helper');
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const _helper = await upgrades.deployProxy(Helper, [
      MAINNET_ROUTER_ADDRESS,
    ]);
    await _helper.waitForDeployment();
    const helper = _helper as unknown as Helper;

    const testTokenInitialSupply = parseEther('1000000');
    const testTokenDepositAmount = parseEther('1000');
    const mat = await new TestERC20__factory(owner).deploy(
      'MAT',
      'MAT',
      testTokenInitialSupply,
    );
    const mbt = await new TestERC20__factory(owner).deploy(
      'MBT',
      'MBT',
      testTokenInitialSupply,
    );
    await mat.waitForDeployment();
    await mbt.waitForDeployment();

    const router = IUniswapV2Router__factory.connect(
      MAINNET_ROUTER_ADDRESS,
      owner,
    );

    await (
      await mat.approve(MAINNET_ROUTER_ADDRESS, testTokenDepositAmount)
    ).wait();
    await (
      await mbt.approve(MAINNET_ROUTER_ADDRESS, testTokenDepositAmount)
    ).wait();

    await (
      await router.addLiquidity(
        mat.getAddress(),
        mbt.getAddress(),
        testTokenDepositAmount,
        testTokenDepositAmount,
        testTokenDepositAmount,
        testTokenDepositAmount,
        owner.address,
        (await time.latest()) + 1000,
      )
    ).wait();

    const factory = IUniswapV2Factory__factory.connect(
      await router.factory(),
      owner,
    );
    const pair = IUniswapV2Pair__factory.connect(
      await factory.getPair(mat.getAddress(), mbt.getAddress()),
      owner,
    );

    // eslint-disable-next-line @typescript-eslint/naming-convention
    return { helper, Helper, pair, mat, mbt, owner, otherAccount };
  }

  describe('Deployment', function () {
    it('Should be able to deploy', async function () {
      const { helper } = await loadFixture(setup);

      expect(await helper.uniswapV2Router()).to.equal(MAINNET_ROUTER_ADDRESS);
    });

    it('Should fail if router address is zero', async function () {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { Helper } = await loadFixture(setup);

      await expect(
        upgrades.deployProxy(Helper, [ethers.ZeroAddress]),
      ).to.be.revertedWith('Invalid router address');
    });

    it('Should fail if try to re-initialize', async function () {
      const { helper } = await loadFixture(setup);

      await expect(
        helper.initialize(MAINNET_ROUTER_ADDRESS),
      ).to.be.revertedWithCustomError(helper, 'InvalidInitialization');
    });
  });
  describe('singleTokenAddLiquidity', function () {
    describe('Validations', function () {
      it('Should revert with the right error if pair address is zero', async function () {
        const { helper, mat, otherAccount } = await loadFixture(setup);

        await expect(
          helper.singleTokenAddLiquidity(
            ethers.ZeroAddress,
            mat.getAddress(),
            parseEther('1000'),
            otherAccount.address,
            (await time.latest()) + 1000,
          ),
        ).to.be.revertedWith('Invalid pair address');
      });

      it('Should revert with the right error if token address is zero', async function () {
        const { helper, pair, otherAccount } = await loadFixture(setup);

        await expect(
          helper.singleTokenAddLiquidity(
            pair.getAddress(),
            ethers.ZeroAddress,
            parseEther('1000'),
            otherAccount.address,
            (await time.latest()) + 1000,
          ),
        ).to.be.revertedWith('Invalid token address');
      });

      it('Should revert with the right error if token amount is zero', async function () {
        const { helper, pair, mat, otherAccount } = await loadFixture(setup);

        await expect(
          helper.singleTokenAddLiquidity(
            pair.getAddress(),
            mat.getAddress(),
            0,
            otherAccount.address,
            (await time.latest()) + 1000,
          ),
        ).to.be.revertedWith('Invalid amount');
      });

      it('Should revert with the right error if recipient address is zero', async function () {
        const { helper, pair, mat } = await loadFixture(setup);

        await expect(
          helper.singleTokenAddLiquidity(
            pair.getAddress(),
            mat.getAddress(),
            parseEther('1000'),
            ethers.ZeroAddress,
            (await time.latest()) + 1000,
          ),
        ).to.be.revertedWith('Invalid to address');
      });

      it('Should revert with the right error if deadline has passed', async function () {
        const { helper, pair, mat, otherAccount } = await loadFixture(setup);

        await expect(
          helper.singleTokenAddLiquidity(
            pair.getAddress(),
            mat.getAddress(),
            parseEther('1000'),
            otherAccount.address,
            await time.latest(),
          ),
        ).to.be.revertedWith('EXPIRED');
      });

      it('Should revert with the right error if token amount is too small', async function () {
        const { helper, pair, mat, otherAccount } = await loadFixture(setup);

        // Approve the helper to spend MAT tokens
        await (await mat.approve(helper.getAddress(), 1)).wait();

        await expect(
          helper.singleTokenAddLiquidity(
            pair.getAddress(),
            mat.getAddress(),
            1,
            otherAccount.address,
            (await time.latest()) + 1000,
          ),
        ).to.be.revertedWith('UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
      });
    });

    describe('Happy Path', function () {
      it('Should add liquidity to the pair providing MAT token only', async function () {
        const { helper, pair, mat, mbt, owner, otherAccount } =
          await loadFixture(setup);

        // Approve the helper to spend MAT tokens
        await (
          await mat.approve(helper.getAddress(), parseEther('1000'))
        ).wait();

        const tx = helper.singleTokenAddLiquidity(
          pair.getAddress(),
          mat.getAddress(),
          parseEther('1000'),
          otherAccount.address,
          (await time.latest()) + 1000,
        );

        let loggedMinted;
        const positiveWhileLogging = (minted: bigint): boolean => {
          loggedMinted = minted;
          return minted > 0n;
        };

        await expect(tx)
          .to.emit(helper, 'ZapIn')
          .withArgs(
            owner.address,
            otherAccount.address,
            await pair.getAddress(),
            positiveWhileLogging,
          );

        await expect(tx).to.changeTokenBalances(
          mat,
          [owner, helper],
          [
            '-999999999999999999997', // very close to parseEther("-1000")
            0,
          ],
        ); // consume all the input MAT tokens & helper's doesn't possess any MAT tokens
        await expect(tx).to.changeTokenBalances(mbt, [owner, helper], [0, 0]); // helper's MBT token balance should remain unchanged

        expect(await pair.balanceOf(otherAccount.address)).be.equal(
          loggedMinted,
        ); // LP tokens should be minted and sent to the recipient
      });
    });
  });
});

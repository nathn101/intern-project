import { ethers, BigNumber } from 'ethers';
import { ETH, USDC, WETH} from './tokens';
import { CoinGeckoClient, SimplePriceResponse } from 'coingecko-api-v3';
import fs from 'fs';

const FROM_TOKEN = USDC;
const FROM_BALANCE = BigNumber.from('1000000');
const TO_TOKEN = ETH;

(async () => {
  console.info(`Converting ${FROM_BALANCE.toString()} ${FROM_TOKEN.symbol} to ${TO_TOKEN.symbol}`);

  // Get the contract for a DEX.

  // Uniswap Router contract address: https://etherscan.io/address/0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D#code
  const uniAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  // Uniswap Router Application Binary Interface
  const uniAbi = fs.readFileSync("./router.json").toString();

  // Using the default provider
  const provider = ethers.getDefaultProvider('homestead');

  // Create a contract object from a contract address and ABI
  let uniContract = new ethers.Contract(uniAddress, uniAbi, provider);  
  
  // Use ethers and the DEX contract to figure out how much TO_TOKEN you can get
  // for the FROM_TOKEN.
  
  let result = await uniContract.getAmountsOut(FROM_BALANCE, [FROM_TOKEN.address, WETH.address]);

  let ETHamnt = result[1];
  // console.log(ETHamnt);
  // TODO:
  const swapBalance = BigNumber.from((ETHamnt as unknown) as string);

  // Figure out spot values of tokens.

  let client = new CoinGeckoClient({
    timeout: 10000,
    autoRetry: true,
  });
  
  async function getTokenPrice(tokenId:string) {
    try {
      let response = await client.simplePrice({
        ids: tokenId,
        vs_currencies: 'usd'
      });
      // console.log(response);
      return (response[tokenId]['usd']);
    } catch (error) {
      console.error('Error retrieving token price:', error);
      throw error;
    }
  }

  let from_price = await getTokenPrice(FROM_TOKEN.coingecko);
  // let from_price_BN = BigNumber.from((from_price as unknown) as string);
  // console.log(`From price: ${from_price}`);
  let to_price_BN = await getTokenPrice(TO_TOKEN.coingecko);
  let to_price = ethers.utils.parseUnits(to_price_BN.toString(), 2);
  // console.log(`To price: ${to_price.toBigInt()}`); 

  // Calculate slippage on the swap.
  // Money gained from the sale of the USDC tokens
  const cur = ethers.utils.parseUnits(FROM_BALANCE.toString(), 2);
  // console.log(cur.toBigInt());

  let wei = cur.mul(ethers.constants.WeiPerEther).div(to_price);
  // console.log(wei.toBigInt());
  // console.log(swapBalance.toBigInt());

  // Slippage is the difference between the ETH tokens gained from the swap and the ETH tokens gained from a manual transaction
  const slippage = BigNumber.from((wei.sub(swapBalance.mul(1000000))).toString());
  // console.log(slippage.toBigInt());
  let slip_ether = ethers.utils.formatUnits(slippage, "ether");
  // console.log(slip_ether);
  let swap_ether = ethers.utils.formatUnits(swapBalance.mul(1000000), "ether");
  // console.log(swap_ether);
  
  console.info(`Estimated swap balance: ${swap_ether.toString()} ETH`);

  // TODO:
  const slippagePercent =  ((slip_ether as unknown) as number) / ((swap_ether as unknown) as number);

  console.info(`Slippage: ${slippagePercent * 100}%`);
})();

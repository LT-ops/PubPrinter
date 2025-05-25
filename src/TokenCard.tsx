import React from 'react';
import { TokenPriceChart } from './components/TokenPriceChart';
import { Tooltip } from 'react-tooltip';
import { Spinner, ErrorMsg } from './components/shared';
import { usePulseXTokenHistory } from './components/usePulseXTokenHistory';

interface TokenCardProps {
  color: string;
  title: string;
  token: any;
  tokenData: { name: string; symbol: string; totalSupply: string; decimals: number };
  marketData: any;
  marketLoading: boolean;
  marketError: string | null;
  TokenBalance: React.FC<{ token: { address: string }, decimals: number }>;
  mintingInfo?: React.ReactNode;
  children?: React.ReactNode;
}

const TokenCard: React.FC<TokenCardProps> = ({
  color,
  title,
  token,
  tokenData,
  marketData,
  marketLoading,
  marketError,
  TokenBalance,
  mintingInfo,
  children,
}) => {
  const { data: priceHistory = [], loading: historyLoading } = usePulseXTokenHistory(token?.address || '', 7);
  
  const chartData = priceHistory.map(day => ({
    timestamp: day.date,
    price: Number(day.priceUSD)
  })).reverse();

  // Improved version to get price from marketData (PulseX or Dexscreener)
  const getBestPriceUsd = (marketData: any): string | undefined => {
    if (!marketData) {
      console.log('No market data available for price calculation');
      return undefined;
    }

    console.log('Market data received in TokenCard:', marketData);

    // Simple debug check for all available properties
    if (marketData) {
      console.log('Available market data properties in TokenCard:', Object.keys(marketData));
    }

    // FIRST CHECK: Handle direct price fields which are most reliable
    // Handle PulseX format - check derivedUSD (most common)
    if (marketData.derivedUSD !== undefined) {
      // Convert to string to ensure proper handling
      const price = String(marketData.derivedUSD);
      console.log('Found PulseX derivedUSD price in TokenCard:', price);
      
      // Make sure it's a valid number and greater than 0
      if (!isNaN(Number(price)) && Number(price) > 0) {
        console.log(`✅ Using derivedUSD price: ${price}`);
        return price;
      }
    }

    // Try alternate price fields that might be available
    if (marketData.priceUSD !== undefined) {
      const price = String(marketData.priceUSD);
      console.log('Found priceUSD in TokenCard:', price);
      if (!isNaN(Number(price)) && Number(price) > 0) {
        console.log(`✅ Using priceUSD: ${price}`);
        return price;
      }
    }

    // SECOND CHECK: Look for price in pair data
    // Try looking for price in token0Price/token1Price if available
    if (marketData.pairBase) {
      console.log('Found pairBase data in TokenCard:', marketData.pairBase);
      // Handle both array and single object formats
      const pairs = Array.isArray(marketData.pairBase) ? marketData.pairBase : [marketData.pairBase];
      
      for (const pair of pairs) {
        if (!pair) continue;
        
        if (pair.token0Price && !isNaN(Number(pair.token0Price)) && Number(pair.token0Price) > 0) {
          console.log('Found price in token0Price in TokenCard:', pair.token0Price);
          console.log(`✅ Using token0Price: ${pair.token0Price}`);
          return String(pair.token0Price);
        }
        if (pair.token1Price && !isNaN(Number(pair.token1Price)) && Number(pair.token1Price) > 0) {
          console.log('Found price in token1Price in TokenCard:', pair.token1Price);
          console.log(`✅ Using token1Price: ${pair.token1Price}`);
          return String(pair.token1Price);
        }
      }
    }

    // THIRD CHECK: Handle Dexscreener format if available
    if (marketData.pairs && Array.isArray(marketData.pairs)) {
      console.log('Found Dexscreener pairs data in TokenCard:', marketData.pairs);
      // Find the pair with the highest liquidity
      const bestPair = marketData.pairs.reduce((best: any, current: any) => {
        const bestLiq = best?.liquidity?.usd ? Number(best.liquidity.usd) : 0;
        const currentLiq = current?.liquidity?.usd ? Number(current.liquidity.usd) : 0;
        return currentLiq > bestLiq ? current : best;
      }, marketData.pairs[0]);

      if (bestPair?.priceUsd && !isNaN(Number(bestPair.priceUsd)) && Number(bestPair.priceUsd) > 0) {
        console.log('Found Dexscreener price in TokenCard:', bestPair.priceUsd);
        console.log(`✅ Using Dexscreener price: ${bestPair.priceUsd}`);
        return bestPair.priceUsd;
      }
    }

    // FINAL CHECK: If we have a price specifically set to 0, we should display it
    if (marketData.derivedUSD === "0" || marketData.priceUSD === "0") {
      console.log('Price explicitly set to 0, returning "0"');
      return "0";
    }

    console.log('⚠️ No valid price found in market data');
    
    // For troubleshooting, try to extract any numeric value as a last resort
    for (const key in marketData) {
      if (typeof marketData[key] === 'string' || typeof marketData[key] === 'number') {
        const numValue = Number(marketData[key]);
        if (!isNaN(numValue) && numValue > 0) {
          console.log(`⚠️ Last resort: Found numeric value in ${key}: ${numValue}`);
          return String(numValue);
        }
      }
    }

    // Really couldn't find anything useful
    console.log('❌ Could not extract any price information from market data');
    return undefined;
  };

  const priceUsd = getBestPriceUsd(marketData);
  const priceNum = priceUsd ? Number(priceUsd) : undefined;
  const [copied, setCopied] = React.useState(false);
  const contractAddress = token?.address;

  // Copy to clipboard handler
  const handleCopy = async () => {
    if (contractAddress) {
      await navigator.clipboard.writeText(contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <section
      className={`bg-white rounded-lg shadow transition-shadow duration-200 p-6 flex flex-col gap-4 border border-gray-200 hover:shadow-2xl hover:border-blue-300`}
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className={`text-2xl font-bold ${color}`}>{title}</h2>
        {marketLoading ? (
          <span className="ml-2"><Spinner /> Loading price...</span>
        ) : marketError ? (
          <span className="ml-2"><ErrorMsg msg={marketError || "Market data unavailable"} /></span>
        ) : priceUsd ? (
          <span className="text-lg font-mono font-bold text-gray-700 bg-gray-100 rounded px-3 py-1 border border-gray-200" title="Current token price (USD)">
            ${Number(priceUsd).toLocaleString(undefined, { maximumFractionDigits: 6 })} USD
          </span>
        ) : marketData ? (
          <div>
            <span className="text-xs text-gray-500 ml-2">Price extraction error</span>
            <button 
              onClick={() => console.log('Market data debug:', marketData)}
              className="ml-2 text-xs text-blue-500 underline"
            >
              Debug
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-500 ml-2">No price data available</span>
        )}
      </div>
      <div className="text-black">
        <span className="font-semibold" data-tooltip-id="name-tooltip">Name:</span> {tokenData.name}
      </div>
      <div className="text-black flex items-center gap-1">
        <span className="font-semibold" data-tooltip-id="symbol-tooltip">Symbol:</span> {tokenData.symbol}
        {contractAddress && (
          <>
            <span
              className="ml-1 text-gray-400 cursor-pointer"
              data-tooltip-id={`contract-tooltip-${contractAddress}`}
              data-tooltip-content={contractAddress}
              style={{ fontSize: '1.1em' }}
            >
              ℹ️
            </span>
            <button
              className="ml-1 px-1 py-0.5 rounded bg-gray-100 border border-gray-300 text-xs text-gray-600 hover:bg-gray-200 focus:outline-none"
              style={{ fontSize: '0.95em' }}
              onClick={handleCopy}
              title="Copy contract address"
              tabIndex={0}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <Tooltip id={`contract-tooltip-${contractAddress}`} place="top" />
          </>
        )}
      </div>
      <div className="text-black"><span className="font-semibold" data-tooltip-id="supply-tooltip">Total Supply:</span> <span className={`${color.replace('text-', 'text-')} font-bold`}>{tokenData.totalSupply ? Number(tokenData.totalSupply).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '...'}</span></div>
      <div className="text-black flex items-center gap-2"><span className="font-semibold" data-tooltip-id="balance-tooltip">Your Balance:</span> <TokenBalance token={token} decimals={tokenData.decimals} />
        {priceNum !== undefined && priceNum > 0 && (
          <span className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-0.5 ml-2" title="USD value of your balance">
            {/* USD value placeholder for future refactor */}
          </span>
        )}
      </div>
      {token && token.address && !historyLoading && (
        <TokenPriceChart 
          data={chartData}
          color={color.startsWith('#') ? color : '#4F46E5'} // fallback to a visible blue if not a hex
        />
      )}
      {mintingInfo}
      {/* Hide irrelevant minting info if market data is missing or mint cost is fixed */}
      {/* The UI already only shows fixed mint cost and hides step/next price info, so nothing to show here. */}
      <div className={`bg-gray-50 rounded p-2 border ${color.replace('text-', 'border-100 border-')}`}> 
        <span className={`font-semibold ${color}`} data-tooltip-id="market-tooltip">Market Data:</span>
        {marketLoading ? (
          <span>Loading...</span>
        ) : marketError ? (
          <span className="text-xs text-red-500 ml-2">{marketError}</span>
        ) : marketData ? (
          <div className="text-sm mt-1 text-black">
            Price: <span className="font-bold">{getBestPriceUsd(marketData) ? Number(getBestPriceUsd(marketData)).toLocaleString(undefined, { maximumFractionDigits: 6 }) + ' USD' : <span className="text-gray-500">No price data available</span>}</span><br />
            Liquidity: <span className="font-bold">{(() => {
              // Try PulseX format first
              if (marketData.totalLiquidity) return `$${Number(marketData.totalLiquidity).toLocaleString()}`;
              // Try Dexscreener format
              const bestPair = marketData.pairs?.reduce((best: any, current: any) => {
                const bestLiq = best?.liquidity?.usd ? Number(best.liquidity.usd) : 0;
                const currentLiq = current?.liquidity?.usd ? Number(current.liquidity.usd) : 0;
                return currentLiq > bestLiq ? current : best;
              }, marketData.pairs?.[0]);
              return bestPair?.liquidity?.usd ? `$${Number(bestPair.liquidity.usd).toLocaleString()}` : <span className="text-gray-500">N/A</span>;
            })()}</span><br />
            24h Volume: <span className="font-bold">{(() => {
              // Try PulseX format first
              if (marketData.tradeVolumeUSD) return `$${Number(marketData.tradeVolumeUSD).toLocaleString()}`;
              // Try Dexscreener format
              const bestPair = marketData.pairs?.reduce((best: any, current: any) => {
                const bestVol = best?.volume?.h24 ? Number(best.volume.h24) : 0;
                const currentVol = current?.volume?.h24 ? Number(current.volume.h24) : 0;
                return currentVol > bestVol ? current : best;
              }, marketData.pairs?.[0]);
              return bestPair?.volume?.h24 ? `$${Number(bestPair.volume.h24).toLocaleString()}` : <span className="text-gray-500">N/A</span>;
            })()}</span><br />
            Market Cap: <span className="font-bold">{(() => {
              // For both PulseX and Dexscreener, calculate using total supply if available
              const price = getBestPriceUsd(marketData);
              if (price && tokenData.totalSupply) {
                const mcap = Number(price) * Number(tokenData.totalSupply);
                return `$${mcap.toLocaleString()}`;
              }
              // Fallback to Dexscreener's FDV if available
              const bestPair = marketData.pairs?.[0];
              return bestPair?.fdv ? `$${Number(bestPair.fdv).toLocaleString()}` : <span className="text-gray-500">N/A</span>;
            })()}</span>
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
};

export default TokenCard;

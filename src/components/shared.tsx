// Shared UI components and helpers for PulseChain Token Dashboard

export function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-t-2 border-gray-300 border-t-blue-500 rounded-full animate-spin align-middle mr-1" />;
}

export function ErrorMsg({ msg }: { msg: string }) {
  return <span className="text-xs text-red-500 ml-2">{msg}</span>;
}

export function OpportunityBadge({ isProfitable, profitMargin }: { isProfitable: boolean; profitMargin: number }) {
  const badgeColor = isProfitable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  const badgeText = isProfitable ? `Profit: ${profitMargin.toFixed(2)}%` : `Loss: ${profitMargin.toFixed(2)}%`;

  return (
    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded ${badgeColor} text-xs font-semibold`}>
      {isProfitable ? '🚀' : '⚠️'} {badgeText}
    </span>
  );
}

export function formatNumber(n: number, decimals: number = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export function getMintingCostColor(currentCost: number, marketPrice: string | undefined, gasCostUSD: number = 0.5): string {
  if (!marketPrice) return 'text-gray-400';
  const price = parseFloat(marketPrice);
  if (isNaN(price)) return 'text-gray-400';
  
  // Calculate effective cost including gas
  const effectiveCost = currentCost + gasCostUSD;
  
  // Calculate profit margin considering gas costs
  const profitMargin = ((price - effectiveCost) / effectiveCost) * 100;
  
  // More granular color system
  if (profitMargin > 5) {
    // Excellent profit margin
    return 'text-green-600'; 
  } else if (profitMargin > 2) {
    // Good profit margin
    return 'text-green-500'; 
  } else if (profitMargin > 0) {
    // Small profit margin
    return 'text-yellow-400'; 
  } else if (profitMargin > -2) {
    // Break-even or small loss
    return 'text-yellow-600'; 
  } else {
    // Clear loss
    return 'text-red-600';
  }
}

// Canonical market price extraction for PulseX/Dexscreener data
export async function getMarketPriceAsync(data: any, tokenAddress: string): Promise<string | undefined> {
  console.log(`getMarketPriceAsync: Getting price for ${tokenAddress}`);
  
  try {
    // First try to get price from DexScreener with retry
    let dexPrice: string | undefined;
    for (let i = 0; i < 3; i++) {
      try {
        dexPrice = await fetchDexscreenerPrice(tokenAddress);
        if (dexPrice) break;
      } catch (error) {
        if (i === 2) console.error(`Failed to get DexScreener price after 3 attempts`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
      }
    }
    if (dexPrice) return dexPrice;
    
    // If DexScreener fails, try to get price from data parameter
    if (data) {
      const price = getMarketPrice(data);
      if (price) return price;
    }
    
    // As a last resort, try to get price from subgraph with retry
    let subgraphPrice: string | undefined;
    for (let i = 0; i < 3; i++) {
      try {
        subgraphPrice = await fetchSubgraphPrice(tokenAddress);
        if (subgraphPrice) break;
      } catch (error) {
        if (i === 2) console.error(`Failed to get subgraph price after 3 attempts`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
      }
    }
    if (subgraphPrice) return subgraphPrice;
    
    // If all else fails, return undefined (no mock price)
    return undefined;
  } catch (error) {
    console.error(`Error getting market price for ${tokenAddress}:`, error);
    return undefined;
  }
}

// Add subgraph price fetching
export async function fetchSubgraphPrice(tokenAddress: string): Promise<string | undefined> {
  try {
    const response = await fetch('https://api.thegraph.com/subgraphs/name/pulsechain/pulsechain-subgraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query TokenPrice($id: ID!) {
            token(id: $id) {
              derivedUSD
            }
          }
        `,
        variables: { id: tokenAddress.toLowerCase() }
      })
    });
    const data = await response.json();
    return data.data?.token?.derivedUSD;
  } catch (error) {
    console.error(`Error fetching subgraph price for ${tokenAddress}:`, error);
    return undefined;
  }
}

// Direct Dexscreener API fetch function for more up-to-date prices
export async function fetchDexscreenerPrice(tokenAddress: string): Promise<string | undefined> {
  try {
    console.log(`Fetching Dexscreener price for ${tokenAddress}...`);
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    console.log(`DexScreener API response status: ${response.status}`);
    if (!response.ok) {
      console.error(`DexScreener API returned status ${response.status}`);
      return undefined;
    }
    const data = await response.json();
    console.log(`DexScreener API response data:`, data);

    if (data && data.pairs && Array.isArray(data.pairs) && data.pairs.length > 0) {
      const bestPair = data.pairs.reduce((best: any, current: any) => {
        const bestLiq = best?.liquidity?.usd ? Number(best.liquidity.usd) : 0;
        const currentLiq = current?.liquidity?.usd ? Number(current.liquidity.usd) : 0;
        return currentLiq > bestLiq ? current : best;
      }, data.pairs[0]);

      if (bestPair?.priceUsd && !isNaN(Number(bestPair.priceUsd))) {
        const price = Number(bestPair.priceUsd);
        if (price > 0 && price < 1000) {
          console.log(`Valid DexScreener price for ${tokenAddress}: ${bestPair.priceUsd}`);
          return bestPair.priceUsd;
        } else {
          console.warn(`Price ${price} for ${tokenAddress} seems unreasonable`);
        }
      }
    }

    console.log(`No valid price found in DexScreener data for ${tokenAddress}`);
    return undefined;
  } catch (error) {
    console.error(`Error fetching DexScreener price for ${tokenAddress}:`, error);
    return undefined;
  }
}

export async function getMarketPrice(data: any): Promise<string | undefined> {
  if (!data) return undefined;
  // Only use DexScreener pairs price for A1A, B2B, EOE, BTB
  if (data.pairs && Array.isArray(data.pairs)) {
    const bestPair = data.pairs.reduce((best: any, current: any) => {
      const bestLiq = best?.liquidity?.usd ? Number(best.liquidity.usd) : 0;
      const currentLiq = current?.liquidity?.usd ? Number(current.liquidity.usd) : 0;
      return currentLiq > bestLiq ? current : best;
    }, data.pairs[0]);
    if (bestPair?.priceUsd && !isNaN(Number(bestPair.priceUsd)) && Number(bestPair.priceUsd) > 0) {
      return String(bestPair.priceUsd);
    }
  }
  // For these tokens, never fallback to derivedUSD or priceUSD
  return undefined;
}

// --- DexScreener Price Fetch Utility ---
const DEX_SCREENER_API = "https://api.dexscreener.com/latest/dex/tokens/";

export async function fetchTokenPriceFromDexScreener(tokenAddress: string): Promise<number | undefined> {
  try {
    const res = await fetch(`${DEX_SCREENER_API}${tokenAddress.toLowerCase()}`);
    const json = await res.json();
    // --- DEBUG LOG ---
    console.log(`[DexScreener DEBUG] Token ${tokenAddress}:`, JSON.stringify(json, null, 2));
    // DexScreener returns an array of pairs, pick the first with priceUsd
    const price = json?.pairs?.find((p: any) => p.priceUsd && !isNaN(Number(p.priceUsd)))?.priceUsd;
    if (price && !isNaN(Number(price))) {
      return Number(price);
    }
    return undefined;
  } catch (e) {
    console.error("DexScreener price fetch error", e);
    return undefined;
  }
}

// --- React hook for DexScreener price ---
import { useState, useEffect } from 'react';
export function useDexScreenerTokenPrice(tokenAddress: string) {
  const [data, setData] = useState<any>(null); // <-- This will be the full API response
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenAddress) return;
    setLoading(true);
    setError(null);
    fetch(`${DEX_SCREENER_API}${tokenAddress.toLowerCase()}`)
      .then(res => res.json())
      .then(json => setData(json))
      .catch((e) => setError(e.message || "Unknown error"))
      .finally(() => setLoading(false));
  }, [tokenAddress]);

  return { data, loading, error };
}

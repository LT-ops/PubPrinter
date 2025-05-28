import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { TOKENS } from '../constants/tokens';
import { useTokenData } from '../hooks/useTokenData';
import { Spinner, ErrorMsg, OpportunityBadge, fetchDexscreenerPrice } from './shared';
import MintButton from './MintButton';
import { getMintingInfo, checkMintingProfitability } from '../utils/minting';

interface ChildToken {
  address: string;
  symbol?: string;
  name?: string;
  description?: string;
}

export function ChildTokenCard({ token }: { token: ChildToken }) {
  const [marketPrice, setMarketPrice] = useState<string | undefined>();
  const [parentPrice, setParentPrice] = useState<string | undefined>();
  const [isProfitable, setIsProfitable] = useState<boolean>(false);
  const [profitMargin, setProfitMargin] = useState<number>(0);
  
  // Get dark mode preference from localStorage or system preference
  const darkMode = typeof window !== 'undefined' ? 
    localStorage.getItem('darkMode') === 'true' || 
    (localStorage.getItem('darkMode') === null && 
     window.matchMedia('(prefers-color-scheme: dark)').matches) : false;

  // Get token data using our custom hook
  const tokenData = useTokenData(token.address, TOKENS.EHONEEH.abi); // Using EHONEEH ABI as base token ABI

  // Set up contract instance for parent token lookup
  useEffect(() => {
    let isMounted = true;

    async function getContract() {
      try {
        const provider = new ethers.JsonRpcProvider("https://rpc.pulsechain.com");
        const contract = new ethers.Contract(token.address, TOKENS.EHONEEH.abi, provider);
        const parentAddress = await contract.Parent();

        if (!isMounted) return;

        // Fetch parent price
        const parentPriceData = await fetchDexscreenerPrice(parentAddress);
        if (parentPriceData) setParentPrice(parentPriceData);

        // Fetch token price
        const tokenPriceData = await fetchDexscreenerPrice(token.address);
        if (tokenPriceData) setMarketPrice(tokenPriceData);
      } catch (error) {
        console.error('Error setting up token data:', error);
      }
    }

    getContract();

    return () => {
      isMounted = false;
    };
  }, [token.address]);

  // Calculate minting profitability whenever prices update
  useEffect(() => {
    if (tokenData && !tokenData.loading && tokenData.totalSupply) {
      const totalSupply = Math.floor(Number(tokenData.totalSupply));
      const mintingInfo = getMintingInfo(
        totalSupply,
        token.symbol === 'EOE' ? TOKENS.EHONEEH.mintStep : TOKENS.BEETWOBEE.mintStep,
        token.symbol === 'EOE' ? 1111 : 420
      );

      if (mintingInfo && marketPrice && parentPrice) {
        const { isProfitable: profitable, profitMargin: margin } = checkMintingProfitability(
          mintingInfo.currentCost,
          marketPrice,
          parentPrice
        );
        setIsProfitable(profitable);
        setProfitMargin(margin);
      }
    }
  }, [marketPrice, parentPrice, tokenData, token.symbol]);

  if (tokenData.loading) {
    return <div className="p-4 border rounded shadow-sm"><Spinner /></div>;
  }

  if (tokenData.error) {
    return <div className="p-4 border rounded shadow-sm"><ErrorMsg msg={tokenData.error} /></div>;
  }

  const mintingInfo = getMintingInfo(
    Math.floor(Number(tokenData.totalSupply)),
    token.symbol === 'EOE' ? TOKENS.EHONEEH.mintStep : TOKENS.BEETWOBEE.mintStep,
    token.symbol === 'EOE' ? 1111 : 420
  );

  return (
    <div className="p-4 rounded shadow-sm" style={{
      background: darkMode ? 'rgba(40,48,64,0.96)' : '#f7f8fa',
      border: darkMode ? '1px solid #2d3650' : '1px solid #e5e7eb',
      color: darkMode ? '#f3f6fa' : '#1a202c',
      boxShadow: darkMode ? '0 2px 16px #0006' : '0 2px 8px #0001',
    }}>
      <h2 className="text-xl font-bold mb-2" style={{
        color: darkMode ? '#ffffff' : '#1a202c'
      }}>{token.name || tokenData.name}</h2>
      
      <div className="mb-2">
        <span className="font-semibold">Symbol: </span>
        {token.symbol || tokenData.symbol}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Total Supply: </span>
        {Number(tokenData.totalSupply).toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </div>
      
      <div className="mb-2">
        <span className="font-semibold">Current Mint Cost: </span>
        {mintingInfo.currentCost} {token.symbol === 'EOE' ? 'A1A' : 'B2B'}
      </div>

      <div className="mb-2">
        <span className="font-semibold">Live Price: </span>
        {marketPrice ? (
          <span className="font-mono font-bold" style={{ color: darkMode ? '#4ade80' : '#15803d' }}>
            ${Number(marketPrice).toFixed(6)}
          </span>
        ) : (
          <span style={{ color: darkMode ? '#c7d0e0' : '#6b7280' }}>Loading...</span>
        )}
      </div>

      {isProfitable && profitMargin > 0 && (
        <div className="mb-4">
          <OpportunityBadge isProfitable={false} profitMargin={0} />
          <span className="ml-2" style={{ color: darkMode ? '#4ade80' : '#15803d' }}>
            Profitability: {profitMargin.toFixed(1)}%
          </span>
        </div>
      )}

      {mintingInfo.remainingAtCurrentCost > 0 && (
        <div className="text-sm mb-2" style={{ color: darkMode ? '#c7d0e0' : '#4b5563' }}>
          Remaining at current cost: {mintingInfo.remainingAtCurrentCost.toLocaleString()}
        </div>
      )}

      <div className="mt-4">
        <MintButton 
          token={{
            ...tokenData,
            address: token.address,
            abi: TOKENS.EHONEEH.abi
          }}
          label={`Mint ${token.symbol || tokenData.symbol}`}
          parentToken={token.symbol === 'EOE' ? TOKENS.A1A : TOKENS.B2B}
          parentSymbol={token.symbol === 'EOE' ? 'A1A' : 'B2B'}
        />
      </div>
    </div>
  );
}

import React from 'react';
import { TOKENS } from './constants/tokens';
import MintButton from './components/MintButton';

interface MintingInfo {
  currentCost?: number;
  remainingAtCurrentCost?: number;
  nextMintingStep?: number;
  profitability?: number;
  debug?: any;
}

interface TokenCardProps {
  color: string;
  title: string;
  tokenData: {
    name: string;
    symbol: string;
    totalSupply: string;
    decimals: number;
  };
  mintingInfo?: MintingInfo;
  lastUpdated?: number;
  marketData?: any; // <-- Add this prop for live price
  debugInfo?: { marketData?: any; tokenData?: any }; // <-- Add debugInfo prop
  loadingState?: 'loading' | 'error' | 'nodata' | 'ok'; // <-- Add loadingState prop
  darkMode?: boolean; // <-- Add darkMode prop
}

// Custom replacer for JSON.stringify to handle BigInt
function jsonReplacer(_: string, value: any) {
  return typeof value === 'bigint' ? value.toString() + 'n' : value;
}

const TokenCard: React.FC<TokenCardProps> = ({
  color,
  title,
  tokenData,
  mintingInfo,
  lastUpdated,
  marketData, // <-- Add this prop for live price
  debugInfo, // <-- Add debugInfo prop
  loadingState = 'ok', // <-- Add loadingState prop
  darkMode = false, // <-- Add darkMode prop
}) => {
  const [livePrice, setLivePrice] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    // Try to get price from marketData (DexScreener pairs)
    if (marketData && marketData.pairs && Array.isArray(marketData.pairs)) {
      const bestPair = marketData.pairs.reduce((best: any, current: any) => {
        const bestLiq = best?.liquidity?.usd ? Number(best.liquidity.usd) : 0;
        const currentLiq = current?.liquidity?.usd ? Number(current.liquidity.usd) : 0;
        return currentLiq > bestLiq ? current : best;
      }, marketData.pairs[0]);
      if (bestPair?.priceUsd && !isNaN(Number(bestPair.priceUsd)) && Number(bestPair.priceUsd) > 0) {
        setLivePrice(bestPair.priceUsd);
        return;
      }
    }
    setLivePrice(undefined);
  }, [marketData]);

  function lastUpdatedString(ts: number | undefined) {
    if (!ts) return '';
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 2) return 'just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    return `${Math.floor(seconds / 3600)} hr ago`;
  }

  // Always show Mint Button and profitability for EOE and BTB
  const isChildToken = tokenData.symbol === 'EOE' || tokenData.symbol === 'BTB';

  return (
    <section className={`rounded-lg shadow-md border-t-4 ${color} mb-4 relative`} style={{
      background: darkMode ? 'rgba(40,48,64,0.96)' : '#f7f8fa',
      boxShadow: darkMode ? '0 2px 16px #0006' : '0 2px 8px #0001',
      border: darkMode ? '1px solid #2d3650' : '1px solid #e5e7eb',
      color: darkMode ? '#f3f6fa' : '#1a202c',
      transition: 'background 0.3s, color 0.3s',
    }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className={`text-2xl font-bold ${color}`}>{title}</h2>
      </div>
      <div className="mb-2" style={{ color: darkMode ? '#f3f6fa' : '#1a202c' }}>
        <span className="font-semibold">Name:</span> {tokenData.name}
      </div>
      <div className="mb-2" style={{ color: darkMode ? '#f3f6fa' : '#1a202c' }}>
        <span className="font-semibold">Symbol:</span> {tokenData.symbol}
      </div>
      <div className="mb-2" style={{ color: darkMode ? '#f3f6fa' : '#1a202c' }}>
        <span className="font-semibold">Total Supply:</span> {tokenData.totalSupply ? Number(tokenData.totalSupply).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '...'}
      </div>
      {/* Live Price Display with loading/error states */}
      <div className="mb-2" style={{ color: darkMode ? '#f3f6fa' : '#1a202c' }}>
        <span className="font-semibold">Live Price:</span>{' '}
        {loadingState === 'loading' ? (
          <span className="text-gray-500 font-bold">Loading...</span>
        ) : loadingState === 'error' ? (
          <span className="text-red-500 font-bold">Error loading price</span>
        ) : livePrice !== undefined ? (
          <span className="font-mono text-green-700 font-bold">${Number(livePrice).toFixed(6)}</span>
        ) : (
          <span className="text-red-500 font-bold">Unavailable</span>
        )}
        <span className="text-xs text-gray-500 ml-2">(DexScreener, onchain)</span>
      </div>
      {/* Debug info for troubleshooting */}
      <details className="text-xs text-gray-400 mb-2">
        <summary>Debug: marketData & livePrice</summary>
        <div>
          <b>livePrice:</b> {String(livePrice)}<br />
          <b>marketData.pairs:</b> {marketData && marketData.pairs ? marketData.pairs.length : 'none'}<br />
          <pre style={{maxHeight: 200, overflow: 'auto'}}>{JSON.stringify(marketData, jsonReplacer, 2)}</pre>
        </div>
      </details>
      {isChildToken && (
        <div style={{ 
            background: darkMode ? 'rgba(15,23,42,0.95)' : '#f9fafb',
            borderRadius: '0.25rem',
            padding: '0.5rem',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: darkMode ? '#334155' : '#d1d5db', 
            marginBottom: '0.5rem'
          }}>
          <div style={{ 
            fontWeight: 'bold', 
            color: darkMode ? '#ffffff' : 'inherit' 
          }}>Current Mint Cost:</div>
          <div style={{ 
            fontSize: '1.5rem',
            lineHeight: '2rem',
            marginTop: '0.25rem',
            color: darkMode ? '#ffffff' : 'inherit',
            fontWeight: '600'
          }}>
            {typeof mintingInfo?.currentCost === 'number' && mintingInfo.currentCost >= 2
              ? `${mintingInfo.currentCost} ${tokenData.symbol === 'EOE' ? 'A1A' : 'B2B'}`
              : <span style={{ color: darkMode ? '#f87171' : '#ef4444', fontWeight: 'bold' }}>Live supply unavailable. Please try again later.</span>}
          </div>
          {/* Profitability badge placeholder - you can add logic to show/hide based on live price data */}
          {mintingInfo?.profitability !== undefined && (
            <div className="mt-2">
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm font-semibold">Profitability: {mintingInfo.profitability.toFixed(1)}%</span>
            </div>
          )}
          {/* Always show Mint Button for EOE/BTB */}
          <div className="mt-4">
            {tokenData.symbol === 'EOE' ? (
              <MintButton token={tokenData} label={`Mint EOE`} parentToken={TOKENS.A1A} parentSymbol="A1A" darkMode={darkMode} />
            ) : tokenData.symbol === 'BTB' ? (
              <MintButton token={tokenData} label={`Mint BTB`} parentToken={TOKENS.B2B} parentSymbol="B2B" darkMode={darkMode} />
            ) : null}
          </div>
          {mintingInfo?.debug && (
            <div className="mt-2 text-xs text-left bg-gray-100 rounded p-2 border border-gray-300 overflow-x-auto" style={{maxWidth: 400, margin: '0 auto'}}>
              <b>Debug Info:</b>
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(mintingInfo.debug, jsonReplacer, 2)}</pre>
            </div>
          )}
        </div>
      )}
      {lastUpdated !== undefined && (
        <div className="text-xs text-gray-500 mt-1">Last updated: {lastUpdatedString(lastUpdated)}</div>
      )}
      {/* Collapsible debug info for advanced troubleshooting */}
      {debugInfo && (
        <details className="text-xs text-gray-400 mb-2">
          <summary>Debug: marketData & tokenData</summary>
          <div>
            <b>marketData:</b>
            <pre style={{maxHeight: 200, overflow: 'auto'}}>{JSON.stringify(debugInfo.marketData, jsonReplacer, 2)}</pre>
            <b>tokenData:</b>
            <pre style={{maxHeight: 100, overflow: 'auto'}}>{JSON.stringify(debugInfo.tokenData, jsonReplacer, 2)}</pre>
          </div>
        </details>
      )}
    </section>
  );
};

export default TokenCard;

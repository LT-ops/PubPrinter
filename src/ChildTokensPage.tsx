import { useState, useEffect } from 'react';
import MintButton from './components/MintButton';
import { getMintingInfo, checkMintingProfitability } from './utils/minting';
import { TOKENS } from './constants/tokens';
import { useDexScreenerTokenPrice } from './components/shared';
import { ethers } from 'ethers';

interface ChildToken {
  name: string;
  symbol: string;
  address: string;
  abi: any;
  decimals: number;
  mintStep: number;
  initialSupply: number;
  baseCost: number;
}

// Example known child tokens (can be extended)
const KNOWN_CHILD_TOKENS: ChildToken[] = [
  // Example: add your known child tokens here
  // {
  //   name: 'ChildToken1',
  //   symbol: 'CT1',
  //   address: '0x...',
  //   abi: [...],
  //   parent: 'A1A',
  //   decimals: 18,
  //   mintStep: 1000,
  //   initialSupply: 0,
  // },
];

// Simple import form for user tokens
function ImportTokenForm({ onImport }: { onImport: (token: any) => void }) {
  const [address, setAddress] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [decimals, setDecimals] = useState(18);
  const [mintStep, setMintStep] = useState(1000);
  const [initialSupply, setInitialSupply] = useState(0);
  const [baseCost, setBaseCost] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchTokenInfo(addr: string) {
    setLoading(true);
    setError(null);
    try {
      const provider = new ethers.JsonRpcProvider('https://rpc.pulsechain.com');
      // Use patched ABI from TOKENS.A1A.abi for ethers v6 compatibility
      const contract = new ethers.Contract(addr, TOKENS.A1A.abi, provider);
      let fetchedSymbol = '', fetchedName = '', fetchedDecimals = 18;
      try { fetchedSymbol = await contract.symbol(); } catch {}
      try { fetchedName = await contract.name(); } catch {}
      try { fetchedDecimals = await contract.decimals(); } catch {}
      setSymbol(fetchedSymbol);
      setName(fetchedName);
      setDecimals(Number(fetchedDecimals));
      // Optionally, try to fetch mintStep, initialSupply, baseCost if public (not required)
    } catch (e: any) {
      setError('Could not fetch token info: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="p-4 bg-gray-50 rounded shadow mb-6"
      onSubmit={e => {
        e.preventDefault();
        setError(null);
        if (!address || !symbol) {
          setError('Address and Symbol are required');
          return;
        }
        onImport({
          address,
          symbol,
          name,
          decimals,
          abi: TOKENS.A1A.abi,
          mintStep,
          initialSupply,
          baseCost,
        });
        setAddress(''); setSymbol(''); setName(''); setDecimals(18); setMintStep(1000); setInitialSupply(0); setBaseCost(2);
      }}
    >
      <div className="flex gap-2 mb-2">
        <input
          className="border p-2 rounded flex-1"
          placeholder="Token address"
          value={address}
          onChange={e => setAddress(e.target.value)}
          onBlur={e => {
            if (ethers.isAddress(e.target.value)) fetchTokenInfo(e.target.value);
          }}
          required
        />
        <button
          type="button"
          className="px-3 py-2 bg-indigo-500 text-white rounded"
          disabled={loading || !ethers.isAddress(address)}
          onClick={() => fetchTokenInfo(address)}
        >
          {loading ? 'Loading...' : 'Auto-Fill'}
        </button>
      </div>
      <div className="flex gap-2 mb-2">
        <input className="border p-2 rounded w-24" placeholder="Symbol" value={symbol} onChange={e => setSymbol(e.target.value)} required />
        <input className="border p-2 rounded flex-1" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="border p-2 rounded w-20" type="number" min={0} max={18} placeholder="Decimals" value={decimals} onChange={e => setDecimals(Number(e.target.value))} />
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <input name="mintStep" value={mintStep} onChange={e => setMintStep(Number(e.target.value))} placeholder="Mint Step" type="number" className="p-2 border rounded" />
        <input name="initialSupply" value={initialSupply} onChange={e => setInitialSupply(Number(e.target.value))} placeholder="Initial Supply" type="number" className="p-2 border rounded" />
        <input name="baseCost" value={baseCost} onChange={e => setBaseCost(Number(e.target.value))} placeholder="Base Cost" type="number" className="p-2 border rounded" />
      </div>
      {error && <div className="text-red-600 mt-2">{error}</div>}
      <button className="bg-indigo-600 text-white px-4 py-2 rounded" type="submit">Import Token</button>
    </form>
  );
}

function useParentAddress(token: ChildToken) {
  const [parent, setParent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function fetchParent() {
      setLoading(true);
      setError(null);
      try {
        const provider = new ethers.JsonRpcProvider('https://rpc.pulsechain.com');
        const contract = new ethers.Contract(token.address, token.abi, provider);
        // Try both 'parent' and 'Parent' (case differences in ABIs)
        let parentAddr;
        try {
          parentAddr = await contract.parent();
        } catch {
          try {
            parentAddr = await contract.Parent();
          } catch {
            parentAddr = null;
          }
        }
        if (!cancelled) setParent(parentAddr);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to fetch parent');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchParent();
    return () => { cancelled = true; };
  }, [token.address, token.abi]);
  return { parent, loading, error };
}

function ChildTokenCard({ token }: { token: ChildToken }) {
  const { parent, loading: parentLoading, error: parentError } = useParentAddress(token);
  let parentSymbol = '';
  if (parent) {
    if (parent.toLowerCase() === (TOKENS.A1A.address as string).toLowerCase()) parentSymbol = 'A1A';
    else if (parent.toLowerCase() === (TOKENS.B2B.address as string).toLowerCase()) parentSymbol = 'B2B';
    else parentSymbol = parent;
  }
  // Fetch price for child token and parent token
  const childPrice = useDexScreenerTokenPrice(token.address);
  const parentPrice = parent && typeof parent === 'string' && parent.startsWith('0x') && parent.length === 42
    ? useDexScreenerTokenPrice(parent)
    : null;

  // Get minting info for this child token (assume EOE/BTB logic for now)
  const totalSupply = 0; // TODO: fetch live totalSupply if needed
  const mintStep = token.mintStep;
  const initialSupply = token.initialSupply;
  const mintingInfo = getMintingInfo(totalSupply, mintStep, initialSupply);
  // Calculate profitability if price data is available
  let profitability = undefined;
  if (
    mintingInfo.currentCost &&
    childPrice?.data?.pairs?.[0]?.priceUsd &&
    parentPrice?.data?.pairs?.[0]?.priceUsd
  ) {
    const mintedTokenMarketPrice = childPrice.data.pairs[0].priceUsd;
    const parentTokenMarketPrice = parentPrice.data.pairs[0].priceUsd;
    profitability = checkMintingProfitability(
      mintingInfo.currentCost,
      mintedTokenMarketPrice,
      parentTokenMarketPrice
    );
  }

  return (
    <div className="p-4 border rounded bg-white shadow">
      <div className="font-bold text-lg mb-1">{token.name || token.symbol}</div>
      <div className="text-xs text-gray-500 mb-2">{token.address}</div>
      <div className="mb-2">
        Parent: {parentLoading ? <span className="text-gray-400">Loading...</span> : parentError ? <span className="text-red-500">Error</span> : <span className="font-semibold">{parentSymbol || 'Unknown'}</span>}
        {parent && !parentSymbol.match(/A1A|B2B/) && (
          <span className="ml-2 text-xs text-gray-400">({parent})</span>
        )}
      </div>
      {/* Live price display */}
      <div className="mb-2 text-sm">
        <span className="font-semibold">Live Price:</span>{' '}
        {childPrice.loading ? (
          <span className="text-gray-500 font-bold">Loading...</span>
        ) : childPrice.error ? (
          <span className="text-red-500 font-bold">Error loading price</span>
        ) : childPrice.data?.pairs?.[0]?.priceUsd ? (
          <span className="font-mono text-green-700 font-bold">${Number(childPrice.data.pairs[0].priceUsd).toFixed(6)}</span>
        ) : (
          <span className="text-red-500 font-bold">Unavailable</span>
        )}
      </div>
      {/* Mint cost and profitability */}
      <div className="mb-2 text-sm">
        <span className="font-semibold">Mint Cost:</span> {mintingInfo.currentCost} {parentSymbol}
        {profitability && (
          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${profitability.statusClass}`}>
            {profitability.icon} {profitability.statusLabel} ({profitability.profitMargin.toFixed(1)}%)
          </span>
        )}
      </div>
      {/* Mint UI for this child token */}
      <MintButton
        token={token}
        label={`Mint ${token.symbol}`}
        parentToken={parentSymbol === 'A1A' ? TOKENS.A1A : parentSymbol === 'B2B' ? TOKENS.B2B : { address: parent, symbol: parentSymbol, decimals: 18, abi: [] }}
        parentSymbol={parentSymbol}
      />
      {/* Show parent price info if available */}
      {parentPrice && (
        <div className="mt-2 text-xs text-gray-600">
          Parent Price: {parentPrice?.data?.pairs?.[0]?.priceUsd ? `$${Number(parentPrice.data.pairs[0].priceUsd).toFixed(4)}` : '...'} USD
        </div>
      )}
    </div>
  );
}

export default function ChildTokensPage() {
  const [importedTokens, setImportedTokens] = useState<ChildToken[]>([]);
  // Combine known and imported tokens
  const allChildTokens = [...KNOWN_CHILD_TOKENS, ...importedTokens];
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold mb-4">Mint & Compare Child Tokens</h2>
      <ImportTokenForm onImport={token => setImportedTokens(toks => [...toks, token])} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allChildTokens.length === 0 && <div className="text-gray-500 col-span-2">No child tokens yet. Import one above!</div>}
        {allChildTokens.map((token, idx) => (
          <ChildTokenCard key={token.address + idx} token={token} />
        ))}
      </div>
    </div>
  );
}

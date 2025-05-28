import { useState, useEffect, memo } from 'react';
import './App.css';
import { ethers } from 'ethers';
import { TOKENS } from "./constants/tokens";
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import TokenCard from './TokenCard';
import { useDexScreenerTokenPrice } from './components/shared';
import TipJar from './components/TipJar';
import { getMintingInfo, checkMintingProfitability } from './utils/minting';
import { useAccount } from 'wagmi';

// --- Chain and WalletConnect Setup ---

// --- Minting Step Logic ---
// Calculates minting cost, step, and supply info for a token based on total supply
// interface MintingDebugInfo {
//   totalSupply: number;
//   stepSize: number;
//   initialSupply: number;
//   mintedAfterInitial: number;
//   currentStepNumber: number;
//   initialBaseCost: number;
//   totalIncrease: number;
//   currentCost: number;
//   nextMintingStep: number;
//   remainingAtCurrentCost: number;
//   tokenType: string;
// }

// interface MintingInfo {
//   currentCost: number;
//   remainingAtCurrentCost: number;
//   nextMintingStep: number;
//   debug: MintingDebugInfo;
// }

// function getMintingInfo(totalSupply: number | undefined, step: number, initialSupply: number = 0): MintingInfo {
//   // Calculate mint cost based on step logic
//   if (typeof totalSupply !== 'number' || isNaN(totalSupply)) {
//     const baseCost = 2;
//     return {
//       currentCost: baseCost,
//       remainingAtCurrentCost: initialSupply > 0 ? initialSupply : step,
//       nextMintingStep: initialSupply + step,
//       debug: {
//         totalSupply: 0,
//         stepSize: step,
//         initialSupply,
//         mintedAfterInitial: 0,
//         currentStepNumber: 0,
//         initialBaseCost: baseCost,
//         totalIncrease: 0,
//         currentCost: baseCost,
//         nextMintingStep: initialSupply + step,
//         remainingAtCurrentCost: initialSupply > 0 ? initialSupply : step,
//         tokenType: step === 1111 ? 'EOE' : 'BTB',
//       },
//     };
//   }
//   // If supply is less than initialSupply, still show base cost
//   if (totalSupply < initialSupply) {
//     const baseCost = 2;
//     return {
//       currentCost: baseCost,
//       remainingAtCurrentCost: initialSupply - totalSupply,
//       nextMintingStep: initialSupply,
//       debug: {
//         totalSupply: totalSupply || 0,
//         stepSize: step,
//         initialSupply,
//         mintedAfterInitial: 0,
//         currentStepNumber: 0,
//         initialBaseCost: baseCost,
//         totalIncrease: 0,
//         currentCost: baseCost,
//         nextMintingStep: initialSupply,
//         remainingAtCurrentCost: initialSupply - totalSupply,
//         tokenType: step === 1111 ? 'EOE' : 'BTB',
//       },
//     };
//   }
//   // EOE and BTB start at baseCost 2, increase by 1 every step
//   const baseCost = 2;
//   // Use totalSupply + 1 to get the cost for the next token to be minted
//   const nextTokenSupply = Math.floor(totalSupply) + 1;
//   const mintedAfterInitial = Math.max(0, nextTokenSupply - initialSupply - 1);
//   const currentStep = Math.floor(mintedAfterInitial / step);
//   const currentCost = baseCost + currentStep;
//   const nextMintingStep = initialSupply + (currentStep + 1) * step;
//   const remainingAtCurrentCost = nextMintingStep - Math.floor(totalSupply);
//   const debugInfo: MintingDebugInfo = {
//     totalSupply: totalSupply || 0,
//     stepSize: step,
//     initialSupply,
//     mintedAfterInitial,
//     currentStepNumber: currentStep,
//     initialBaseCost: baseCost,
//     totalIncrease: currentStep,
//     currentCost,
//     nextMintingStep,
//     remainingAtCurrentCost,
//     tokenType: step === 1111 ? 'EOE' : 'BTB',
//   };
//   return {
//     currentCost,
//     remainingAtCurrentCost,
//     nextMintingStep,
//     debug: debugInfo,
//   };
// }

// function checkMintingProfitability(
//   currentCost: number,
//   mintedTokenMarketPrice: string | undefined,
//   parentTokenMarketPrice: string | undefined
// ): {
//   isProfitable: boolean,
//   profitMargin: number,
//   profitColor: string,
//   status: 'profit' | 'breakeven' | 'loss' | 'unknown',
//   statusLabel: string,
//   statusClass: string,
//   icon: string
// } {
//   if (
//     !mintedTokenMarketPrice ||
//     isNaN(Number(mintedTokenMarketPrice)) ||
//     !parentTokenMarketPrice ||
//     isNaN(Number(parentTokenMarketPrice))
//   ) {
//     return { 
//       isProfitable: false, 
//       profitMargin: 0, 
//       profitColor: 'text-gray-500',
//       status: 'unknown',
//       statusLabel: 'UNKNOWN',
//       statusClass: 'bg-gray-100 text-gray-500',
//       icon: '❓'
//     };
//   }

//   const mintingCostUSD = currentCost * Number(parentTokenMarketPrice);
//   const marketPriceUSD = Number(mintedTokenMarketPrice);
//   const profitMargin = ((marketPriceUSD - mintingCostUSD) / mintingCostUSD) * 100;

//   if (profitMargin > 2) {
//     return {
//       isProfitable: true,
//       profitMargin,
//       profitColor: profitMargin > 20 ? 'text-green-600' : 'text-green-500',
//       status: 'profit',
//       statusLabel: 'PROFIT',
//       statusClass: profitMargin > 20 ? 'bg-green-100 text-green-700' : 'bg-green-50 text-green-600',
//       icon: '💰'
//     };
//   } else if (profitMargin >= -2 && profitMargin <= 2) {
//     return {
//       isProfitable: false,
//       profitMargin,
//       profitColor: 'text-yellow-600',
//       status: 'breakeven',
//       statusLabel: 'BREAK EVEN',
//       statusClass: 'bg-yellow-50 text-yellow-700',
//       icon: '⚖️'
//     };
//   } else {
//     return {
//       isProfitable: false,
//       profitMargin,
//       profitColor: profitMargin > -20 ? 'text-yellow-500' : 'text-red-500',
//       status: 'loss',
//       statusLabel: 'LOSS',
//       statusClass: profitMargin > -20 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700',
//       icon: '⚠️'
//     };
//   }
// }

// function calculateTotalMintCost({
//   totalSupply,
//   amount,
//   step,
//   initialSupply = 0,
//   baseCost = 2,
// }: {
//   totalSupply: number;
//   amount: number;
//   step: number;
//   initialSupply?: number;
//   baseCost?: number;
// }): { totalCost: number; breakdown: Array<{ count: number; cost: number }> } {
//   let remaining = amount;
//   let supply = Math.floor(totalSupply);
//   let totalCost = 0;
//   let breakdown: Array<{ count: number; cost: number }> = [];
//   // If supply is less than initialSupply, fill up to initialSupply at baseCost
//   if (supply < initialSupply) {
//     const atBase = Math.min(initialSupply - supply, remaining);
//     if (atBase > 0) {
//       totalCost += atBase * baseCost;
//       breakdown.push({ count: atBase, cost: baseCost });
//       remaining -= atBase;
//       supply += atBase;
//     }
//   }
//   // Now, for each step, increment cost by 1 per step
//   while (remaining > 0) {
//     const mintedAfterInitial = Math.max(0, supply - initialSupply);
//     const currentStep = Math.floor(mintedAfterInitial / step);
//     const currentCost = baseCost + currentStep;
//     // How many tokens can be minted at this cost before next step?
//     const nextStepSupply = initialSupply + (currentStep + 1) * step;
//     const tokensAtThisCost = Math.min(remaining, nextStepSupply - supply);
//     if (tokensAtThisCost <= 0) break;
//     totalCost += tokensAtThisCost * currentCost;
//     breakdown.push({ count: tokensAtThisCost, cost: currentCost });
//     remaining -= tokensAtThisCost;
//     supply += tokensAtThisCost;
//   }
//   return { totalCost, breakdown };
// }

// --- Main Dashboard Content ---
const AppContent = memo(function AppContent() {
  useEffect(() => {
    console.log('Rendering AppContent...');
  }, []);

  const [a1a, setA1A] = useState({ name: "", symbol: "", totalSupply: "", decimals: 18 });
  const [b2b, setB2B] = useState({ name: "", symbol: "", totalSupply: "", decimals: 18 });
  const [eoe, setEoe] = useState({ name: "", symbol: "", totalSupply: "", decimals: 18 });
  const [btb, setBtb] = useState({ name: "", symbol: "", totalSupply: "", decimals: 18 });

  // Restore darkMode state/effect
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    return false;
  });
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- Use DexScreener price hook for all four tokens ---
  const a1aDex = useDexScreenerTokenPrice(TOKENS.A1A.address);
  const b2bDex = useDexScreenerTokenPrice(TOKENS.B2B.address);
  const eoeDex = useDexScreenerTokenPrice(TOKENS.EHONEEH.address);
  const btbDex = useDexScreenerTokenPrice(TOKENS.BEETWOBEE.address);

  // Add lastUpdated state for each token, after DexScreener hooks
  const [a1aLastUpdated, setA1aLastUpdated] = useState<number | undefined>(undefined);
  const [b2bLastUpdated, setB2bLastUpdated] = useState<number | undefined>(undefined);
  const [eoeLastUpdated, setEoeLastUpdated] = useState<number | undefined>(undefined);
  const [btbLastUpdated, setBtbLastUpdated] = useState<number | undefined>(undefined);

  useEffect(() => { if (a1aDex.data) setA1aLastUpdated(Date.now()); }, [a1aDex.data]);
  useEffect(() => { if (b2bDex.data) setB2bLastUpdated(Date.now()); }, [b2bDex.data]);
  useEffect(() => { if (eoeDex.data) setEoeLastUpdated(Date.now()); }, [eoeDex.data]);
  useEffect(() => { if (btbDex.data) setBtbLastUpdated(Date.now()); }, [btbDex.data]);

  // Helper to extract priceUsd from DexScreener data
  function getMarketPrice(dexData: any): string | undefined {
    if (dexData && dexData.data && Array.isArray(dexData.data.pairs)) {
      const price = dexData.data.pairs.find((p: any) => p.priceUsd && !isNaN(Number(p.priceUsd)))?.priceUsd;
      if (price && !isNaN(Number(price))) return String(price);
    }
    return undefined;
  }

  // --- Loading/error state helpers ---
  function getLoadingState(dex: any) {
    if (dex.isLoading) return 'loading';
    if (dex.isError) return 'error';
    if (!dex.data) return 'nodata';
    return 'ok';
  }

  const eoeMarketPrice = getMarketPrice(eoeDex);
  const btbMarketPrice = getMarketPrice(btbDex);
  const a1aMarketPrice = getMarketPrice(a1aDex);
  const b2bMarketPrice = getMarketPrice(b2bDex);

  const { connector } = useAccount();
  // WalletConnect warning hint
  const wcHint = connector && connector.id && connector.id.toLowerCase().includes('walletconnect');

  useEffect(() => {
    async function fetchData() {
      try {
        const provider = new ethers.JsonRpcProvider("https://rpc.pulsechain.com");
        
        const a1aContract = new ethers.Contract(TOKENS.A1A.address, TOKENS.A1A.abi, provider);
        const b2bContract = new ethers.Contract(TOKENS.B2B.address, TOKENS.B2B.abi, provider);
        const eoeContract = new ethers.Contract(TOKENS.EHONEEH.address, TOKENS.EHONEEH.abi, provider);
        const btbContract = new ethers.Contract(TOKENS.BEETWOBEE.address, TOKENS.BEETWOBEE.abi, provider);

        const [a1aName, a1aSymbol, a1aTotalSupply, a1aDecimals] = await Promise.all([
          a1aContract.name(),
          a1aContract.symbol(),
          a1aContract.totalSupply(),
          a1aContract.decimals(),
        ]);
        setA1A({ name: a1aName, symbol: a1aSymbol, totalSupply: ethers.formatUnits(a1aTotalSupply, a1aDecimals), decimals: a1aDecimals });

        const [b2bName, b2bSymbol, b2bTotalSupply, b2bDecimals] = await Promise.all([
          b2bContract.name(),
          b2bContract.symbol(),
          b2bContract.totalSupply(),
          b2bContract.decimals(),
        ]);
        setB2B({ name: b2bName, symbol: b2bSymbol, totalSupply: ethers.formatUnits(b2bTotalSupply, b2bDecimals), decimals: b2bDecimals });

        const [eoeName, eoeSymbol, eoeTotalSupply, eoeDecimals] = await Promise.all([
          eoeContract.name(),
          eoeContract.symbol(),
          eoeContract.totalSupply(),
          eoeContract.decimals(),
        ]);
        setEoe({ name: eoeName, symbol: eoeSymbol, totalSupply: ethers.formatUnits(eoeTotalSupply, eoeDecimals), decimals: eoeDecimals });

        const [btbName, btbSymbol, btbTotalSupply, btbDecimals] = await Promise.all([
          btbContract.name(),
          btbContract.symbol(),
          btbContract.totalSupply(),
          btbContract.decimals(),
        ]);
        setBtb({ name: btbName, symbol: btbSymbol, totalSupply: ethers.formatUnits(btbTotalSupply, btbDecimals), decimals: btbDecimals });

      } catch (e) {
        console.error("Error loading token data", e);
      }
    }
    fetchData();
  }, [TOKENS.A1A.abi, TOKENS.B2B.abi, TOKENS.EHONEEH.abi, TOKENS.BEETWOBEE.abi]);

  // Parse totalSupply as number for calculations
  const eoeSupply = Math.floor(Number(eoe.totalSupply || '0'));
  const btbSupply = Math.floor(Number(btb.totalSupply || '0'));
  const eoeMintInfo = getMintingInfo(eoeSupply, TOKENS.EHONEEH.mintStep, 1111);
  const btbMintInfo = getMintingInfo(btbSupply, TOKENS.BEETWOBEE.mintStep, 420);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-[#181c24] via-[#232946] to-[#181c24]' : 'bg-gradient-to-br from-[#c7d0e0] via-[#b0b8c9] to-[#8a99b8]'}`}
      style={{
        background: darkMode
          ? 'linear-gradient(135deg, #181c24 0%, #232946 60%, #181c24 100%)'
          : 'linear-gradient(135deg, #c7d0e0 0%, #b0b8c9 60%, #8a99b8 100%)',
      }}
    >
      <div className="flex justify-between items-center p-4">
        <h1
          className="text-3xl font-bold text-center flex-1 select-none px-4 py-2 rounded-lg shadow-md"
          style={{
            letterSpacing: 1,
            background: darkMode ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.7)',
            color: darkMode ? '#1a202c' : '#1a202c', // Always dark text for contrast
            textShadow: darkMode ? '0 1px 8px #0002' : 'none',
            transition: 'background 0.3s, color 0.3s',
          }}
        >
          <span role="img" aria-label="sun">☀️</span> Pub Printer <span role="img" aria-label="printer">🖨️</span>
        </h1>
        <a
          href="#"
          className="ml-4 px-3 py-2 rounded-full border border-gray-300 bg-gray-200 text-gray-500 text-sm font-semibold shadow cursor-not-allowed"
          title="Feature under development"
          onClick={(e) => e.preventDefault()}
        >
          Child Tokens
        </a>
        <button
          className="ml-4 px-3 py-2 rounded-full border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-xl shadow hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle dark mode"
          onClick={() => setDarkMode(d => !d)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '🌙' : '☀️'}
        </button>
      </div>
      {wcHint && (
        <div className="max-w-xl mx-auto mb-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded text-xs text-center">
          WalletConnect users: If you see a warning or cannot interact, try refreshing, reconnecting, or use a supported browser wallet like MetaMask for best results.
        </div>
      )}
      <main className="max-w-5xl mx-auto mt-12 p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <TokenCard
            color="text-blue-800"
            title="A1A Token"
            tokenData={a1a}
            marketData={a1aDex.data}
            debugInfo={{ marketData: a1aDex.data, tokenData: a1a }}
            lastUpdated={a1aLastUpdated}
            loadingState={getLoadingState(a1aDex)}
            darkMode={darkMode}
          />
        </div>
        <div>
          <TokenCard
            color="text-green-800"
            title="B2B Token"
            tokenData={b2b}
            marketData={b2bDex.data}
            debugInfo={{ marketData: b2bDex.data, tokenData: btb }}
            lastUpdated={b2bLastUpdated}
            loadingState={getLoadingState(b2bDex)}
            darkMode={darkMode}
          />
        </div>
        <div>
          <TokenCard
            color="text-purple-800"
            title="EOE (EhOneEh)"
            tokenData={eoe}
            marketData={eoeDex.data}
            mintingInfo={{
              currentCost: eoeMintInfo.currentCost,
              remainingAtCurrentCost: eoeMintInfo.remainingAtCurrentCost,
              nextMintingStep: eoeMintInfo.nextMintingStep,
              profitability: (eoeSupply > 0 && eoeMarketPrice && a1aMarketPrice && isFinite(Number(eoeMarketPrice)) && isFinite(Number(a1aMarketPrice)))
                ? checkMintingProfitability(eoeMintInfo.currentCost, eoeMarketPrice, a1aMarketPrice).profitMargin
                : undefined,
              debug: eoeMintInfo.debug
            }}
            debugInfo={{ marketData: eoeDex.data, tokenData: eoe }}
            lastUpdated={eoeLastUpdated}
            loadingState={getLoadingState(eoeDex)}
            darkMode={darkMode}
          />
        </div>
        <div>
          <TokenCard
            color="text-yellow-700"
            title="BTB (BeeTwoBee)"
            tokenData={btb}
            marketData={btbDex.data}
            mintingInfo={{
              currentCost: btbMintInfo.currentCost,
              remainingAtCurrentCost: btbMintInfo.remainingAtCurrentCost,
              nextMintingStep: btbMintInfo.nextMintingStep,
              profitability: (btbSupply > 0 && btbMarketPrice && b2bMarketPrice && isFinite(Number(btbMarketPrice)) && isFinite(Number(b2bMarketPrice)))
                ? checkMintingProfitability(btbMintInfo.currentCost, btbMarketPrice, b2bMarketPrice).profitMargin
                : undefined,
              debug: btbMintInfo.debug
            }}
            debugInfo={{ marketData: btbDex.data, tokenData: btb }}
            lastUpdated={btbLastUpdated}
            loadingState={getLoadingState(btbDex)}
            darkMode={darkMode}
          />
        </div>
      </main>
      <footer className="mt-12 py-4 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col items-center gap-4">
            <TipJar />
            <ConnectButton />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span role="img" aria-label="printer">🖨️</span> PubPrinter v1.0
            </p>
          </div>
        </div>
        <div className="fixed bottom-4 left-4 text-xs text-gray-400 dark:text-gray-600">
          Made with 💖 by the community
        </div>
      </footer>
    </div>
  );
});

const MemoizedRainbowKitProvider = memo(function MemoizedRainbowKitProvider({ children }: { children: React.ReactNode }) {
  return (
    <RainbowKitProvider>
      {children}
    </RainbowKitProvider>
  );
});

function App() {
  // Runtime check for WalletConnect Project ID
  const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
  if (!walletConnectProjectId) {
    // Show a clear error if the env variable is missing
    const missingEnvStyle: React.CSSProperties = {
      minHeight: '100vh',
      background: '#181c24',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      padding: 32,
      textAlign: 'center',
    };
    return (
      <div style={missingEnvStyle}>
        <h1 style={{ fontSize: 32, marginBottom: 16 }}>Configuration Error</h1>
        <p style={{ fontSize: 18, marginBottom: 16 }}>
          <strong>VITE_WALLETCONNECT_PROJECT_ID</strong> is missing.<br />
          The app cannot connect to WalletConnect without this environment variable.
        </p>
        <ol style={{ textAlign: 'left', maxWidth: 480, margin: '0 auto', fontSize: 16, background: '#232946', padding: 20, borderRadius: 8 }}>
          <li>1. Go to <a href="https://cloud.walletconnect.com/sign-in" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>WalletConnect Cloud</a> and sign in.</li>
          <li>2. Create a new project and copy your <b>Project ID</b>.</li>
          <li>3. Add this line to your <code>.env</code> file:<br /><code style={{ background: '#181c24', padding: '2px 6px', borderRadius: 4 }}>VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here</code></li>
          <li>4. If deploying to Vercel, add the same variable in your Vercel project settings under <b>Environment Variables</b>.</li>
          <li>5. Restart your dev server or redeploy the app.</li>
        </ol>
        <p style={{ marginTop: 24, color: '#fbbf24' }}>After setting the variable, reload this page.</p>
      </div>
    );
  }

  return (
    <MemoizedRainbowKitProvider>
      <AppContent />
    </MemoizedRainbowKitProvider>
  );
}

export default App;

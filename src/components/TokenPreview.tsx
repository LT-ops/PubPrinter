import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { TOKENS } from '../constants/tokens';
import { useTokenData } from '../hooks/useTokenData';
import { Spinner, ErrorMsg, OpportunityBadge } from './shared';
import { getMintingInfo, checkMintingProfitability } from '../utils/minting';

interface TokenPreviewProps {
  address: string;
}

export function TokenPreview({ address }: TokenPreviewProps) {
  const [parentAddress, setParentAddress] = useState<string | null>(null);
  const [mintCost, setMintCost] = useState<number>(0);
  const [mintStep, setMintStep] = useState<number>(0);
  const [initialSupply, setInitialSupply] = useState<number>(0);
  const [isProfitable, setIsProfitable] = useState<boolean>(false);
  const [profitMargin, setProfitMargin] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Get token data using our custom hook
  const tokenData = useTokenData(address, TOKENS.EHONEEH.abi);

  // Get parent token data
  const parentTokenData = useTokenData(parentAddress ?? '', TOKENS.EHONEEH.abi);

  useEffect(() => {
    let isMounted = true;

    async function fetchParentData() {
      if (!ethers.isAddress(address)) {
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider("https://rpc.pulsechain.com");
        const contract = new ethers.Contract(address, TOKENS.EHONEEH.abi, provider);

        // Get parent address
        const parent = await contract.Parent();
        if (!isMounted) return;
        setParentAddress(parent);

        // Get minting parameters
        try {
          const [mintStepTest, initialSupplyTest] = await Promise.all([
            contract.mintStep(),
            contract.initialSupply()
          ]);
          setMintStep(Number(mintStepTest));
          setInitialSupply(Number(initialSupplyTest));

          // Calculate minting cost
          const mintInfo = getMintingInfo(
            parseInt(tokenData.totalSupply),
            Number(mintStepTest),
            Number(initialSupplyTest)
          );
          if (isMounted) {
            setMintCost(mintInfo.currentCost);
          }
        } catch (e) {
          console.error('Failed to get minting parameters:', e);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch parent data');
        }
      }
    }

    fetchParentData();
    return () => { isMounted = false; };
  }, [address, tokenData.totalSupply]);

  // Calculate profitability when we have all the data
  useEffect(() => {
    if (tokenData.marketPrice && parentTokenData.marketPrice && mintCost) {
      const profitability = checkMintingProfitability(
        mintCost,
        tokenData.marketPrice,
        parentTokenData.marketPrice
      );
      setIsProfitable(profitability.isProfitable);
      setProfitMargin(profitability.profitMargin);
    }
  }, [tokenData.marketPrice, parentTokenData.marketPrice, mintCost]);

  // Debug logs
  useEffect(() => {
    console.log('Rendering TokenPreview for address:', address);
    console.log('Token Data:', tokenData);
    console.log('Parent Token Data:', parentTokenData);
    console.log('Mint Cost:', mintCost);
    console.log('Profitability:', { isProfitable, profitMargin });
  }, [address, tokenData, parentTokenData, mintCost, isProfitable, profitMargin]);

  if (tokenData.loading) {
    return <Spinner />;
  }

  if (tokenData.error) {
    return <ErrorMsg msg={tokenData.error} />;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="text-xl font-bold mb-2">{tokenData.name} ({tokenData.symbol})</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p>Market Price: {tokenData.marketPrice ?? 'Loading...'} PLS</p>
          <p>Parent Token: {parentTokenData.symbol ?? 'Loading...'}</p>
          <p>Parent Price: {parentTokenData.marketPrice ?? 'Loading...'} PLS</p>
          <p>Mint Cost: {mintCost} PLS</p>
        </div>
        
        <div className="space-y-2">
          <OpportunityBadge isProfitable={isProfitable} profitMargin={profitMargin} />
          <p>Supply: {ethers.formatUnits(tokenData.totalSupply, tokenData.decimals)}</p>
          <p>Mint Step: {mintStep}</p>
          <p>Initial Supply: {initialSupply}</p>
        </div>
      </div>

      {/* Debug Information */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-400">Debug Info</summary>
        <div className="mt-2 text-sm text-gray-400 space-y-1">
          <p>Contract Address: {address}</p>
          <p>Parent Address: {parentAddress ?? 'None'}</p>
          <p>Decimals: {tokenData.decimals}</p>
          <p>Raw Total Supply: {tokenData.totalSupply}</p>
          {error && <p className="text-red-400">Error: {error}</p>}
        </div>
      </details>
    </div>
  );
}

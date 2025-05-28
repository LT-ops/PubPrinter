import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { TOKENS } from '../constants/tokens';
import { fetchDexscreenerPrice } from '../components/shared';

// Interface for token data
export interface TokenData {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  marketPrice?: string;
  loading: boolean;
  error: string | null;
}

// Get token data using ethers.js with auto-refresh
export function useTokenData(tokenAddress: string, abi: any) {
  const [data, setData] = useState<TokenData>({
    name: '',
    symbol: '',
    totalSupply: '0',
    decimals: 18,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    async function fetchData() {
      if (!tokenAddress || !abi) {
        if (isMounted) {
          setData(prev => ({ ...prev, loading: false, error: 'Missing token address or ABI' }));
        }
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider("https://rpc.pulsechain.com");
        const contract = new ethers.Contract(tokenAddress, abi, provider);

        const [name, symbol, totalSupply, decimals] = await Promise.all([
          contract.name(),
          contract.symbol(),
          contract.totalSupply(),
          contract.decimals(),
        ]);

        // Fetch market price from DexScreener
        const marketPrice = await fetchDexscreenerPrice(tokenAddress);

        if (isMounted) {
          setData({
            name,
            symbol,
            totalSupply: totalSupply.toString(),
            decimals,
            marketPrice,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (isMounted) {
          setData(prev => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch token data'
          }));
        }
      }
    }

    // Initial fetch
    fetchData();

    // Set up refresh interval (every 30 seconds)
    intervalId = setInterval(fetchData, 30000);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [tokenAddress, abi]);

  return data;
}

// Get parent token data for a child token
export function useParentTokenData(childContract: ethers.Contract) {
  const [data, setData] = useState<TokenData>({
    name: '',
    symbol: '',
    totalSupply: '0',
    decimals: 18,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        // First try to get the parent address from the contract
        const parentAddress = await childContract.Parent();
        
        if (!parentAddress) {
          throw new Error('No parent address found');
        }

        // Create contract instance for parent token
        let parentAbi = TOKENS.A1A.abi; // Default to standard token ABI
        const parentContract = new ethers.Contract(parentAddress, parentAbi, childContract.runner);

        const [name, symbol, totalSupply, decimals] = await Promise.all([
          parentContract.name(),
          parentContract.symbol(),
          parentContract.totalSupply(),
          parentContract.decimals(),
        ]);

        if (isMounted) {
          setData({
            name,
            symbol,
            totalSupply: ethers.formatUnits(totalSupply, decimals),
            decimals,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        console.error('Error fetching parent token data:', error);
        if (isMounted) {
          setData(prev => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch parent token data'
          }));
        }
      }
    }

    if (childContract) {
      fetchData();
    }

    return () => {
      isMounted = false;
    };
  }, [childContract]);

  return data;
}

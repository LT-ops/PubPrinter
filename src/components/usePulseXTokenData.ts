import { useEffect, useState } from 'react';
import axios from 'axios';
import { getMockTokenData } from './mockPriceData';

// PulseX Subgraph endpoint - make sure this URL is correct
const PULSEX_SUBGRAPH = 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex';

// NOTE: A1A, B2B, EOE, and BTB are now subgraph-only. All fallback to mock data and PulseX API for these tokens is deprecated and should not be used.
// This hook is only for legacy support of other tokens. For A1A, B2B, EOE, BTB, use useSubgraphTokenPrice instead.

export function usePulseXTokenData(address: string) {
  // For A1A, B2B, EOE, BTB: always return null and error
  const lowerCaseAddress = address?.toLowerCase();
  if ([
    '0xa7b295c715713487877427589a93f93bc608d240', // EOE
    '0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3', // BTB
    '0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8', // A1A
    '0x6d2dc71afa00484c48bff8160dbddb7973c37a5e'  // B2B
  ].includes(lowerCaseAddress)) {
    return { data: null, loading: false, error: 'No token data available' };
  }

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Variable to track if component is still mounted when async operations complete
    let isMounted = true;
    
    // Clear error initially
    setError(null);

    // Handle empty address
    if (!address) {
      setData(null);
      setLoading(false);
      return;
    }

    // Normalize the address to lowercase
    const normalizedAddress = address.toLowerCase();

    // Show that we're loading data
    setLoading(true);
    
    console.log(`Fetching PulseX data for token: ${normalizedAddress}`);

    // Format the query for PulseX GraphQL API
    const query = {
      query: `{
        token(id: "${normalizedAddress}") {
          id
          symbol
          name
          derivedUSD
          tradeVolumeUSD
          totalLiquidity
          totalSupply
          txCount
          pairBase {
            token0Price
            token1Price
          }
        }
      }`
    };

    // Helper function to fetch the token data - extracted for code readability
    const fetchTokenData = async () => {
      try {
        console.log(`Sending request to PulseX API for ${normalizedAddress}...`);
        const response = await axios.post(PULSEX_SUBGRAPH, query);
        console.log(`Received response from PulseX API for ${normalizedAddress}:`, response);
        
        // Only update state if component still mounted
        if (!isMounted) return;
        
        if (response.data?.data?.token) {
          console.log(`Token data received successfully for ${normalizedAddress}:`, response.data.data.token);
          setData(response.data.data.token);
          setError(null);
        } else {
          console.log(`No token data in response for ${normalizedAddress}`);
          // For BTB, EOE, B2B, A1A: do NOT use mock data, just set null
          const specialAddrs = [
            '0xa7b295c715713487877427589a93f93bc608d240', // EOE
            '0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3', // BTB
            '0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8', // A1A
            '0x6d2dc71afa00484c48bff8160dbddb7973c37a5e'  // B2B
          ];
          if (specialAddrs.includes(normalizedAddress)) {
            setData(null);
            setError('This token is subgraph-only. Use useSubgraphTokenPrice.');
            setLoading(false);
            return;
          } else {
            // Use mock data as fallback for other tokens
            const mockData = getMockTokenData(normalizedAddress);
            if (mockData) {
              console.log(`Using mock data for ${normalizedAddress}:`, mockData);
              setData(mockData);
              setError(null);
            } else {
              setData(null);
              setError('No token data available');
            }
          }
        }
      } catch (err: any) {
        console.error(`Error fetching PulseX data for ${normalizedAddress}:`, err);
        if (!isMounted) return;
        // For BTB, EOE, B2B, A1A: do NOT use mock data, just set null
        const specialAddrs = [
          '0xa7b295c715713487877427589a93f93bc608d240', // EOE
          '0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3', // BTB
          '0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8', // A1A
          '0x6d2dc71afa00484c48bff8160dbddb7973c37a5e'  // B2B
        ];
        if (specialAddrs.includes(normalizedAddress)) {
          setData(null);
          setError(err.message || 'Failed to fetch token data');
        } else {
          // Try to use mock data as fallback on error for other tokens
          const mockData = getMockTokenData(normalizedAddress);
          if (mockData) {
            console.log(`Error occurred but using mock data for ${normalizedAddress}:`, mockData);
            setData(mockData);
            setError(null);
          } else {
            setData(null);
            setError(err.message || 'Failed to fetch token data');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Execute the fetch function immediately
    fetchTokenData();
    console.log("fetchTokenData called for address:", address);
    // Removed IMMEDIATE FALLBACK: mock data is only set after API call fails for non-special tokens

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [address]);

  return { data, loading, error };
}

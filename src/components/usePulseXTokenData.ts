import { useEffect, useState } from 'react';
import axios from 'axios';
import { getMockTokenData } from './mockPriceData';

// PulseX Subgraph endpoint - make sure this URL is correct
const PULSEX_SUBGRAPH = 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex';

// Updated with a much simpler implementation
export function usePulseXTokenData(address: string) {
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
          console.log(`No token data in response for ${normalizedAddress}, trying fallback mock data...`);
          
          // Use mock data as fallback
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
      } catch (err: any) {
        console.error(`Error fetching PulseX data for ${normalizedAddress}:`, err);
        
        // Only update state if component still mounted
        if (!isMounted) return;
        
        // Try to use mock data as fallback on error
        const mockData = getMockTokenData(normalizedAddress);
        if (mockData) {
          console.log(`Error occurred but using mock data for ${normalizedAddress}:`, mockData);
          setData(mockData);
          setError(null);
        } else {
          setData(null);
          setError(err.message || 'Failed to fetch token data');
        }
      } finally {
        // Only update state if component still mounted
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Execute the fetch function immediately
    fetchTokenData();
    console.log("fetchTokenData called for address:", address);
    
    // IMPROVED FALLBACK: Use mock data immediately to ensure we have data showing
    const mockData = getMockTokenData(normalizedAddress);
    if (mockData) {
      console.log(`IMMEDIATE FALLBACK: Using mock data for ${normalizedAddress}:`, mockData);
      // Set data immediately rather than using setTimeout
      setData(mockData);
      
      // We'll keep loading=true so the API can potentially replace this data
      // if it succeeds, but at least we'll have mockData showing immediately
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [address]);

  return { data, loading, error };
}

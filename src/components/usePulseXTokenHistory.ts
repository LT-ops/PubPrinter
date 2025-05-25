import { useEffect, useState } from 'react';
import axios from 'axios';

const PULSEX_SUBGRAPH = 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex';

// Fetches daily price history for a token from PulseX subgraph
export function usePulseXTokenHistory(address: string, days: number = 30) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    // PulseX subgraph supports tokenDayDatas for daily OHLCV
    const query = {
      query: `{
        tokenDayDatas(first: ${days}, orderBy: date, orderDirection: desc, where: { token: \"${address.toLowerCase()}\" }) {
          date
          priceUSD
          totalLiquidityUSD
          dailyVolumeUSD
        }
      }`
    };
    axios.post(PULSEX_SUBGRAPH, query)
      .then(res => {
        setData(res.data.data.tokenDayDatas || []);
      })
      .catch(() => setError('Failed to fetch PulseX price history'))
      .finally(() => setLoading(false));
  }, [address, days]);

  return { data, loading, error };
}

import React, { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatNumber } from '../components/shared';

interface TokenBalanceProps {
  token: { address: string, decimals?: number };
}

export const TokenBalance: React.FC<TokenBalanceProps> = ({ token }) => {
  const { address } = useAccount();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useBalance({
    address,
    token: token.address ? (token.address as `0x${string}`) : undefined,
    chainId: 369, // PulseChain ID
  });

  if (!address) return <span className="text-gray-500">Connect wallet</span>;
  if (isLoading) return <span className="text-gray-500">Loading...</span>;
  if (!data) return <span className="text-gray-500">No data</span>;

  let formatted = '0';
  try {
    if (data.formatted != null && !isNaN(Number(data.formatted))) {
      formatted = formatNumber(Number(data.formatted));
    }
  } catch (e) {
    setError('Error formatting balance');
  }

  return (
    <span className="text-sm">
      {formatted}
      {error && <span className="text-red-500"> {error}</span>}
    </span>
  );
};

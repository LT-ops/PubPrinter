// Shared UI components and helpers for PulseChain Token Dashboard
import React from 'react';

export function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-t-2 border-gray-300 border-t-blue-500 rounded-full animate-spin align-middle mr-1" />;
}

export function ErrorMsg({ msg }: { msg: string }) {
  return <span className="text-xs text-red-500 ml-2">{msg}</span>;
}

export function OpportunityBadge() {
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold" data-tooltip-id="opportunity-tooltip">
      🚀 Opportunity
    </span>
  );
}

export function formatNumber(n: number, decimals: number = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export function getMintingCostColor(currentCost: number, marketPrice: string | undefined) {
  if (!marketPrice) return '';
  const price = parseFloat(marketPrice);
  if (isNaN(price)) return '';
  if (currentCost < price) return 'text-green-600';
  if (currentCost > price) return 'text-red-600';
  return 'text-yellow-600';
}

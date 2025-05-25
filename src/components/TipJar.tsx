import React, { useState } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';

// Use the provided wallet address
const TIP_JAR_ADDRESS = '0x3eC13D6BB18dB629941399EE12b5b3a1Ea281De6';

export default function TipJar() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('0.01');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { sendTransaction, isPending } = useSendTransaction();

  const handleTip = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSent(false);
    try {
      await sendTransaction({
        to: TIP_JAR_ADDRESS,
        value: BigInt(Math.floor(Number(amount) * 1e18)),
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send tip');
    }
  };

  return (
    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-center max-w-md mx-auto shadow">
      <div className="font-semibold text-yellow-800 mb-2 text-lg flex items-center justify-center gap-2">
        <span role="img" aria-label="sparkling heart" className="animate-pulse">💖✨</span>
        Support PubPrinter
      </div>
      <div className="text-xs text-gray-700 mb-2">
        If you enjoy using <span className="font-bold">PubPrinter</span>, consider sending a little love to help keep the project alive!<br />
        Every tip is appreciated. Thank you for your support!
      </div>
      <form className="flex flex-col items-center gap-2" onSubmit={handleTip}>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
          disabled={isPending || sent}
        />
        <span className="text-xs text-gray-500">PLS</span>
        <button
          type="submit"
          className="mt-1 px-4 py-1 rounded bg-yellow-400 text-yellow-900 font-bold hover:bg-yellow-300 disabled:opacity-60"
          disabled={!isConnected || isPending || sent || !amount || Number(amount) <= 0}
        >
          {isPending ? 'Sending...' : sent ? 'Thank you! 💖' : 'Send Tip'}
        </button>
      </form>
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
      <div className="text-xs text-gray-500 mt-2">
        PubPrinter tip jar:<br />
        <span className="font-mono select-all break-all text-xs">{TIP_JAR_ADDRESS}</span>
      </div>
    </div>
  );
}

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

const pulseChain = {
  id: 369,
  name: 'PulseChain',
  network: 'pulsechain',
  nativeCurrency: {
    name: 'Pulse',
    symbol: 'PLS',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://rpc.pulsechain.com'] },
    public: { http: ['https://rpc.pulsechain.com'] },
  },
  blockExplorers: {
    default: { name: 'PulseScan', url: 'https://scan.pulsechain.com' },
  },
  testnet: false,
};

let configInstance: ReturnType<typeof getDefaultConfig> | null = null;

export const getConfig = () => {
  if (!configInstance) {
    console.log('Initializing WalletConnect Core with getDefaultConfig');
    configInstance = getDefaultConfig({
      appName: 'PubPrinter',
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [pulseChain],
      transports: {
        [pulseChain.id]: http('https://rpc.pulsechain.com'),
      },
    });
  }
  return configInstance;
};

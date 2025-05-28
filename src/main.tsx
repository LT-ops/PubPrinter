import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ChildTokensPage from './ChildTokensPage'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiConfig } from 'wagmi';
import { getConfig } from './constants/config';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const config = getConfig();
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/child-tokens" element={<ChildTokensPage />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiConfig>
  </StrictMode>,
)

import React, { useState } from 'react';
import { ethers } from 'ethers';
import { TOKENS } from '../constants/tokens';
import { ChildTokenCard } from '../components/ChildTokenCard';
import { TokenPreview } from '../components/TokenPreview';
import { ErrorMsg } from '../components/shared';
import type { ChildTokenImport, TokenImportFormData } from '../types/import';

export function ChildTokensPage() {
  const [importedTokens, setImportedTokens] = useState<ChildTokenImport[]>([]);
  const [formData, setFormData] = useState<TokenImportFormData>({ address: '' });
  const [error, setError] = useState<string | null>(null);

  const validateAndAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    console.log('Validating token address:', formData.address);

    try {
      // Basic address validation
      if (!ethers.isAddress(formData.address)) {
        throw new Error('Invalid token address format');
      }

      console.log('Token address is valid. Checking if already imported...');

      // Check if token already imported
      if (importedTokens.some(token => token.address.toLowerCase() === formData.address.toLowerCase())) {
        throw new Error('Token already imported');
      }

      console.log('Token is not imported. Validating contract...');

      // Validate that it's a valid token contract
      const provider = new ethers.JsonRpcProvider("https://rpc.pulsechain.com");
      const contract = new ethers.Contract(formData.address, TOKENS.EHONEEH.abi, provider);

      try {
        // Check if contract has required functions
        await Promise.all([
          contract.name(),
          contract.symbol(),
          contract.totalSupply(),
          contract.decimals(),
          contract.Parent() // This is crucial - must have a parent token
        ]);
        console.log('Contract validation successful. Adding token...');
      } catch (error) {
        console.error('Contract validation failed:', error);
        throw new Error('Invalid token contract: Missing required functions');
      }

      // Add the token
      setImportedTokens(prev => {
        const newToken = {
          address: formData.address,
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description
        };
        console.log('Adding token to state:', newToken);
        return [...prev, newToken];
      });

      // Reset form
      setFormData({ address: '' });
      setError(null);
    } catch (err) {
      console.error('Error during token validation and addition:', err);
      setError(err instanceof Error ? err.message : 'Failed to import token');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Import Child Tokens</h1>
      
      {/* Import Form */}
      <form onSubmit={validateAndAddToken} className="mb-8">
        <div className="p-4 border rounded">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Token Contract Address *
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm"
                placeholder="Enter token contract address (0x...)"
                required
              />
            </label>
          </div>
          
          {/* Live Preview */}
          {formData.address && <TokenPreview address={formData.address} />}

          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Additional Information (Optional)</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Token Name
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm"
                  placeholder="Custom display name"
                />
              </label>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Token Symbol
                <input
                  type="text"
                  value={formData.symbol || ''}
                  onChange={e => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm"
                  placeholder="Custom symbol"
                />
              </label>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Description
                <textarea
                  value={formData.description || ''}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full rounded border-gray-300 shadow-sm"
                  rows={3}
                  placeholder="Add any notes or description about this token"
                />
              </label>
            </div>
          </div>

          {error && <ErrorMsg msg={error} />}
          
          <button
            type="submit"
            className="mt-4 w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Import Token
          </button>
        </div>
      </form>

      {/* Imported Tokens List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {importedTokens.map(token => (
          <ChildTokenCard key={token.address} token={token} />
        ))}
      </div>
    </div>
  );
}

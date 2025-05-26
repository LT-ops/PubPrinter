// This file provides mock price data in case the API is down
// Will be used as a fallback to make sure prices are always displayed

// Mock price data for the main tokens - UPDATED WITH CORRECT ADDRESSES FROM TOKENS.TS
export const MOCK_PRICE_DATA = {
  // A1A Token
  "0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8": {
    id: "0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8",
    symbol: "A1A",
    name: "A1A",
    derivedUSD: "0.06394282758402744",
    tradeVolumeUSD: "44367.57841677515",
    totalLiquidity: "218345.4668549641",
    totalSupply: "1006922.0",
    txCount: "28242"
  },
  
  // B2B Token
  "0x6d2dc71afa00484c48bff8160dbddb7973c37a5e": {
    id: "0x6d2dc71afa00484c48bff8160dbddb7973c37a5e",
    symbol: "B2B",
    name: "B2B",
    derivedUSD: "0.13", 
    tradeVolumeUSD: "39003.24258822425",
    totalLiquidity: "169012.78521359913",
    totalSupply: "740508.0",
    txCount: "21876"
  },
  
  // EOE Token
  "0xa7b295c715713487877427589a93f93bc608d240": {
    id: "0xa7b295c715713487877427589a93f93bc608d240",
    symbol: "EOE",
    name: "EhOneEh",
    derivedUSD: "0.41562381826259304",
    tradeVolumeUSD: "28145.78521862947",
    totalLiquidity: "95421.32451964129",
    totalSupply: "6092.620111111111",
    txCount: "9341"
  },
  
  // BTB Token
  "0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3": {
    id: "0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3",
    symbol: "BTB", 
    name: "BeeTwoBee",
    derivedUSD: "0.13",
    tradeVolumeUSD: "19082.45197532167",
    totalLiquidity: "84129.76982145669",
    totalSupply: "1883.2666666666667",
    txCount: "6429"
  }
};

// NOTE: Mock price data is now deprecated for A1A, B2B, EOE, and BTB. These tokens are subgraph-only. This file is only for legacy support of other tokens.

// Function to get mock data for a token
export function getMockTokenData(address: string) {
  if (!address) return null;
  const lowerCaseAddress = address.toLowerCase();
  // For A1A, B2B, EOE, BTB: always return null
  if ([
    '0xa7b295c715713487877427589a93f93bc608d240', // EOE
    '0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3', // BTB
    '0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8', // A1A
    '0x6d2dc71afa00484c48bff8160dbddb7973c37a5e'  // B2B
  ].includes(lowerCaseAddress)) {
    return null;
  }

  // Define a lookup map to account for case sensitivity issues
  const addressMap: Record<string, string> = {
    "0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8": "0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8",
    "0x6d2dc71afa00484c48bff8160dbddb7973c37a5e": "0x6d2dc71afa00484c48bff8160dbddb7973c37a5e",
    "0xa7b295c715713487877427589a93f93bc608d240": "0xa7b295c715713487877427589a93f93bc608d240",
    "0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3": "0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3"
  };

  // Try normalizing address before lookup
  const normalizedAddress = addressMap[lowerCaseAddress] || lowerCaseAddress;
  
  // First try direct lookup
  const mockData = MOCK_PRICE_DATA[normalizedAddress as keyof typeof MOCK_PRICE_DATA];
  
  if (mockData) {
    console.log(`Found mock data for ${lowerCaseAddress}:`, mockData);
    return mockData;
  }
  
  // Fallback to name/symbol checking if exact address lookup failed
  if (lowerCaseAddress.includes('a1a')) {
    console.log('Address contains a1a, returning A1A mock data');
    return MOCK_PRICE_DATA["0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8"];
  }
  if (lowerCaseAddress.includes('b2b')) {
    console.log('Address contains b2b, returning B2B mock data');
    return MOCK_PRICE_DATA["0x6d2dc71afa00484c48bff8160dbddb7973c37a5e"];
  }
  if (lowerCaseAddress.includes('eoe') || lowerCaseAddress.includes('ehoneeh')) {
    console.log('Address contains eoe, returning EOE mock data');
    return MOCK_PRICE_DATA["0xa7b295c715713487877427589a93f93bc608d240"];
  }
  if (lowerCaseAddress.includes('btb') || lowerCaseAddress.includes('beetwobee')) {
    console.log('Address contains btb, returning BTB mock data');
    return MOCK_PRICE_DATA["0x1df3da06c8047da659c8a5213ac2e7ded8dee7e3"];
  }
  
  console.log(`No mock data found for ${lowerCaseAddress}`);
  
  // Last resort - return first available token data
  const firstTokenKey = Object.keys(MOCK_PRICE_DATA)[0];
  console.log(`Returning first available mock data (${firstTokenKey})`);
  return MOCK_PRICE_DATA[firstTokenKey as keyof typeof MOCK_PRICE_DATA];
}

import axios from 'axios';

// This is a simple standalone script to check if the PulseX API is actually working
const PULSEX_SUBGRAPH = 'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex';

// Let's test with the EOE token address - replace with your actual token address
const TEST_ADDRESS = '0xaf414949E419a5506a1D296288322bA3efbBDa53'; // EOE token

// Direct test query without React
async function testPulseXAPI() {
  console.log('Testing PulseX API directly...');
  
  const query = {
    query: `{
      token(id: "${TEST_ADDRESS.toLowerCase()}") {
        id
        symbol
        name
        derivedUSD
        tradeVolumeUSD
        totalLiquidity
        totalSupply
        txCount
      }
    }`
  };

  try {
    const response = await axios.post(PULSEX_SUBGRAPH, query);
    console.log('PulseX API Direct Response:', response.data);
    
    if (response.data && response.data.data && response.data.data.token) {
      console.log('Token Data:', response.data.data.token);
      console.log('Price (derivedUSD):', response.data.data.token.derivedUSD);
    } else {
      console.log('No token data in response');
    }
  } catch (error) {
    console.error('Error testing PulseX API:', error);
  }
}

// Export the function for use in other files
export { testPulseXAPI };

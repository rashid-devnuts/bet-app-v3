import fs from 'fs';
import path from 'path';

// Read the markets.json file
const marketsPath = path.join(__dirname, 'src', 'constants', 'markets.json');

try {
  const marketsData = JSON.parse(fs.readFileSync(marketsPath, 'utf8'));
  
  console.log('Markets with winning calculations:');
  console.log('=====================================');
  
  const marketsWithWinning = [];
  const marketsWithoutWinning = [];
  
  marketsData.forEach(market => {
    if (market.has_winning_calculations === true) {
      marketsWithWinning.push(market.id);
      console.log(`Market ID: ${market.id} - ${market.name} (has_winning_calculations: true)`);
    } else {
      marketsWithoutWinning.push(market.id);
    }
  });
  
  console.log('\n=====================================');
  console.log(`Total markets with winning calculations: ${marketsWithWinning.length}`);
  console.log('Market IDs with winning calculations:', marketsWithWinning.sort((a, b) => a - b));
  
  console.log('\n=====================================');
  console.log(`Total markets WITHOUT winning calculations: ${marketsWithoutWinning.length}`);
  console.log('Market IDs WITHOUT winning calculations:', marketsWithoutWinning.sort((a, b) => a - b));
  
} catch (error) {
  console.error('Error reading markets.json:', error.message);
}

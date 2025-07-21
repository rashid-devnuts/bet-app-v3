const fs = require('fs');
const path = require('path');

// Read the markets.json file
const marketsPath = path.join(__dirname, 'src', 'constants', 'markets.json');

try {
  const marketsData = JSON.parse(fs.readFileSync(marketsPath, 'utf8'));
  
  const marketsWithWinning = [];
  const marketsWithoutWinning = [];
  
  // Extract markets from the nested structure
  Object.values(marketsData.markets).forEach(market => {
    if (market.has_winning_calculations === true) {
      marketsWithWinning.push(market.id);
    } else {
      marketsWithoutWinning.push(market.id);
    }
  });
  
  console.log('Markets with winning calculations (should be REMOVED from functions):');
  console.log(JSON.stringify(marketsWithWinning.sort((a, b) => a - b), null, 2));
  
  console.log('\nMarkets WITHOUT winning calculations (should KEEP functions):');
  console.log(JSON.stringify(marketsWithoutWinning.sort((a, b) => a - b), null, 2));
  
} catch (error) {
  console.error('Error reading markets.json:', error.message);
}

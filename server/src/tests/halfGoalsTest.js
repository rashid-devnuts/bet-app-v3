import BaseBetOutcomeCalculationService from'../services/baseBetOutcomeCalculation.service.js';

const service = new BaseBetOutcomeCalculationService();

// Test data for Market 28 (1st Half Goals)
const bet28 = {
  betDetails: {
    market_id: "28",
    market_name: "1st Half Goals",
    label: "Over",
    name: "0.5"
  },
  stake: 100,
  odds: 1.3
};

// Test data for Market 53 (2nd Half Goals)
const bet53 = {
  betDetails: {
    market_id: "53",
    market_name: "2nd Half Goals",
    label: "Under",
    name: "1.5"
  },
  stake: 100,
  odds: 1.8
};

// Match data with 1st half: 1-0, 2nd half: 0-1, total: 1-1
const matchData = {
  scores: [
    {
      description: "1ST_HALF",
      score: { goals: 1, participant: "home" }
    },
    {
      description: "1ST_HALF", 
      score: { goals: 0, participant: "away" }
    },
    {
      description: "2ND_HALF_ONLY",
      score: { goals: 0, participant: "home" }
    },
    {
      description: "2ND_HALF_ONLY",
      score: { goals: 1, participant: "away" }
    }
  ]
};

console.log("Testing Market 28 (1st Half Goals) - Over 0.5");
console.log("Match: 1st half 1-0, 2nd half 0-1, total 1-1");
const result28 = service.calculateHalfSpecificGoals(bet28, matchData);
console.log("Result:", JSON.stringify(result28, null, 2));

console.log("\nTesting Market 53 (2nd Half Goals) - Under 1.5");
console.log("Match: 1st half 1-0, 2nd half 0-1, total 1-1");
const result53 = service.calculateHalfSpecificGoals(bet53, matchData);
console.log("Result:", JSON.stringify(result53, null, 2));

// Test with different match data: 1st half: 0-0, 2nd half: 2-1, total: 2-1
const matchData2 = {
  scores: [
    {
      description: "1ST_HALF",
      score: { goals: 0, participant: "home" }
    },
    {
      description: "1ST_HALF", 
      score: { goals: 0, participant: "away" }
    },
    {
      description: "2ND_HALF_ONLY",
      score: { goals: 2, participant: "home" }
    },
    {
      description: "2ND_HALF_ONLY",
      score: { goals: 1, participant: "away" }
    }
  ]
};

console.log("\n\nTesting Market 28 (1st Half Goals) - Over 0.5");
console.log("Match: 1st half 0-0, 2nd half 2-1, total 2-1");
const result28_2 = service.calculateHalfSpecificGoals(bet28, matchData2);
console.log("Result:", JSON.stringify(result28_2, null, 2));

console.log("\nTesting Market 53 (2nd Half Goals) - Under 1.5");
console.log("Match: 1st half 0-0, 2nd half 2-1, total 2-1");
const result53_2 = service.calculateHalfSpecificGoals(bet53, matchData2);
console.log("Result:", JSON.stringify(result53_2, null, 2)); 
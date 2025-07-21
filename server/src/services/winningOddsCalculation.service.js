import { match } from "assert";
import {CustomError } from "../utils/customErrors.js";
import BaseBetOutcomeCalculationService from "./baseBetOutcomeCalculation.service.js";

/**
 * Service for calculating bet outcomes for markets that have winning calculations but these dont work in inplayOdds
 */
export default class WinningOddsCalculationService extends BaseBetOutcomeCalculationService {
  constructor() {
    super();
    
    

    // Market type mappings for winning calculation markets
    this.winningMarketTypes = {
      1: "FULLTIME_RESULT",           // Fulltime Result
      10: "DRAW_NO_BET",              // Draw No Bet
      14: "BOTH_TEAMS_TO_SCORE",      // Both Teams To Score
      18: "HOME_TEAM_EXACT_GOALS",    // Home Team Exact Goals
      19: "AWAY_TEAM_EXACT_GOALS",    // Away Team Exact Goals
      33: "FIRST_HALF_EXACT_GOALS",   // First Half Exact Goals
      38: "SECOND_HALF_EXACT_GOALS",  // Second Half Exact Goals
      39: "AWAY_TEAM_WIN_BOTH_HALVES", // Away Team Win Both Halves
      41: "HOME_TEAM_WIN_BOTH_HALVES", // Home Team Win Both Halves
      44: "ODD_EVEN",                 // Odd/Even
      50: "CLEAN_SHEET_HOME",         // Clean Sheet - Home
      51: "CLEAN_SHEET_AWAY"          // Clean Sheet - Away
    };
  }

  /**
   * Main method to calculate bet outcome using winning field
   * @param {Object} bet - Bet object from database
   * @param {Object} matchData - Match data with scores, state, and odds
   * @returns {Object} - Bet outcome result
   */
  async calculateBetOutcome(bet, matchData) {
    try {
      // Validate inputs
      if (!bet || !matchData) {
        throw new CustomError("Invalid bet or match data", 400, "INVALID_DATA");
      }

     
     

      // Get market information
      const marketId = bet.marketId || 
                      bet.betDetails?.market_id || 
                      this.extractMarketIdFromOdd(bet.oddId, matchData);

      if (!marketId) {
        return {
          status: "canceled",
          reason: "Market ID not found",
          payout: bet.stake, // Refund stake
        };
      }



      // Calculate outcome using winning field
      
      
      return super.calculateOutcomeFromWinningField(bet, matchData);
    } catch (error) {
      console.error(
        `[WinningOddsCalculation] Error calculating outcome for bet ${bet._id}:`,
        error
      );
      return {
        status: "error",
        reason: error.message,
        payout: 0,
      };
    }
  }

  /**
   * Calculate outcome based on market type using winning calculations
   */
  async calculateOutcomeByMarketType(bet, matchData, marketId) {
    const marketType = super.getMarketType(marketId);

    switch (marketType) {
      case "FULLTIME_RESULT":
        return this.calculateFulltimeResult(bet, matchData);

      case "DRAW_NO_BET":
        return this.calculateDrawNoBet(bet, matchData);

      case "BOTH_TEAMS_TO_SCORE":
        return this.calculateBothTeamsToScore(bet, matchData);

      case "HOME_TEAM_EXACT_GOALS":
      case "AWAY_TEAM_EXACT_GOALS":
        return this.calculateTeamExactGoals(bet, matchData);

      case "FIRST_HALF_EXACT_GOALS":
      case "SECOND_HALF_EXACT_GOALS":
        return this.calculateHalfExactGoals(bet, matchData);

      case "HOME_TEAM_WIN_BOTH_HALVES":
      case "AWAY_TEAM_WIN_BOTH_HALVES":
        return this.calculateWinBothHalves(bet, matchData);

      case "ODD_EVEN":
        return this.calculateOddEven(bet, matchData);

      case "CLEAN_SHEET_HOME":
      case "CLEAN_SHEET_AWAY":
        return this.calculateCleanSheet(bet, matchData);

      default:
        return this.calculateFromWinningField(bet, matchData);
    }
  }




  /**
   * Calculate Fulltime Result outcome using winning field
   */
  calculateFulltimeResult(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Calculate Draw No Bet outcome using winning field
   */
  calculateDrawNoBet(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Calculate Both Teams To Score outcome using winning field
   */
  calculateBothTeamsToScore(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Calculate Team Exact Goals outcome using winning field
   */
  calculateTeamExactGoals(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Calculate Half Exact Goals outcome using winning field
   */
  calculateHalfExactGoals(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Calculate Win Both Halves outcome using winning field
   */
  calculateWinBothHalves(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Calculate Odd/Even outcome using winning field
   */
  calculateOddEven(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Calculate Clean Sheet outcome using winning field
   */
  calculateCleanSheet(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Generic calculation using winning field
   */
  calculateFromWinningField(bet, matchData) {
    return super.calculateOutcomeFromWinningField(bet, matchData);
  }

  /**
   * Check if match is finished
   */


  /**
   * Extract market ID from odd ID using match data
   */
  extractMarketIdFromOdd(oddId, matchData) {
    if (!oddId || !matchData.odds) return null;

    for (const market of matchData.odds) {
      if (market.odds) {
        const foundOdd = market.odds.find(odd => odd.id === oddId);
        if (foundOdd) {
          return market.market_id;
        }
      }
    }
    return null;
  }

  /**
   * Find the selected odd in match data
   */

  /**
   * Check if market has winning calculations available
   */
  checkMarketHasWinningCalculations(marketId) {
    return super.marketsWithWinningCalculations.includes(parseInt(marketId));
  }

  /**
   * Get all supported market types
   */
  getSupportedMarkets() {
    return Object.keys(this.winningMarketTypes).map(id => ({
      id: parseInt(id),
      type: this.winningMarketTypes[id]
    }));
  }
}



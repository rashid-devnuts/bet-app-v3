import BaseBetOutcomeCalculationService from "./baseBetOutcomeCalculation.service.js";

/**
 * Comprehensive Bet Outcome Calculation Service
 *
 * This service handles calculation of bet outcomes for ALL market types including:
 *
 * CORE MARKETS:
 * - Match Result (1X2) - Market IDs: 1, 52, 117
 * - Over/Under Goals - Market IDs: 2, 26, 47
 * - Both Teams to Score (BTTS) - Market IDs: 3, 49
 * - Correct Score - Market IDs: 4, 57
 * - Asian Handicap - Market IDs: 5, 6
 *
 * EXTENDED MARKETS:
 * - Double Chance - Market IDs: 7, 13
 * - Draw No Bet - Market ID: 8
 * - Half Time Result - Market IDs: 9, 14
 * - Half Time/Full Time - Market ID: 10
 * - Player Goals (First/Last/Anytime) - Market IDs: 11, 17, 18, 247, 248
 * - Total Goals (Exact) - Market ID: 12
 * - Team Total Goals - Market IDs: 15, 16
 * - Clean Sheet - Market IDs: 19, 20
 * - Win to Nil - Market IDs: 21, 22
 * - Odd/Even Goals - Market ID: 23
 * - Highest Scoring Half - Market ID: 24
 * - Corners - Market IDs: 25, 44
 * - Cards Total - Market IDs: 27, 45
 * - Player Cards - Market IDs: 28, 66
 * - Penalties - Market ID: 29
 *
 * CALCULATION METHODS:
 * 1. For markets with has_winning_calculations=true: Uses winning field from odds
 * 2. For other markets: Calculates based on match data and bet parameters
 *
 * SUPPORTED BET TYPES:
 * - Single bets with various market types
 * - Handicap bets (Asian, European)
 * - Over/Under with different thresholds
 * - Player-specific markets
 * - Time-based markets
 * - Statistical markets (corners, cards, etc.)
 */
class BetOutcomeCalculationService extends BaseBetOutcomeCalculationService {
 
  constructor() {
    super();
  }
  async calculateBetOutcome(bet, matchData) {
    try {
      // Extract market ID from bet details
      const marketId = bet.betDetails?.market_id || bet.marketId;
      
      // Calculate outcome based on market type
      if (this.marketsWithWinningCalculations.includes(parseInt(marketId))) {
        return super.calculateOutcomeFromWinningField(bet, matchData);
      }

      const outcome = await this.calculateOutcomeByMarketType(
        bet,
        matchData,
        marketId
      );
      
      //INFO: here we will see in outcome 'won' or 'lost' and will update the bet according to that
      return outcome;
    } catch (error) {
      console.error(
        `[BetOutcomeCalculation] Error calculating outcome for bet ${bet._id}:`,
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
   * Calculate outcome based on market type
   */
  async calculateOutcomeByMarketType(bet, matchData, marketId) {
    const marketType = this.getMarketType(marketId);

    switch (marketType) {
      case "OVER_UNDER":
        return super.calculateOverUnder(bet, matchData);

      case "BOTH_TEAMS_SCORE_1ST_HALF":
      case "BOTH_TEAMS_SCORE_2ND_HALF":
        return super.calculateBothTeamsScore(bet, matchData);

      case "CORRECT_SCORE":
        return super.calculateCorrectScore(bet, matchData);

      case "ASIAN_HANDICAP":
      case "HALF_TIME_ASIAN_HANDICAP":
        return super.calculateAsianHandicap(bet, matchData);

      case "LAST_TEAM_TO_SCORE":
        return super.calculateLastTeamToScore(bet, matchData);

      case "GOALSCORER_ANYTIME":
      case "GOALSCORERS":
        return super.calculateGoalscorers(bet, matchData);

      case "PLAYER_CARDS":
        return super.calculatePlayerCards(bet, matchData);

      case "DOUBLE_CHANCE":
        return super.calculateDoubleChance(bet, matchData);

      case "HALF_TIME_RESULT":
      case "TEAM_TO_SCORE_HALF":
        return super.calculateHalfTimeResult(bet, matchData);

      case "CORNERS":
        return super.calculateCorners(bet, matchData);

      case "CARDS_TOTAL":
        return super.calculateCardsTotal(bet, matchData);

      case "TEAM_TOTAL_GOALS":
        return super.calculateTeamTotalGoals(bet, matchData);

      case "ODD_EVEN_GOALS":
        return super.calculateOddEvenGoals(bet, matchData);

      case "CLEAN_SHEET":
        return super.calculateCleanSheet(bet, matchData);

      case "GOAL_LINE":
      case "HALF_TIME_GOAL_LINE":
        return super.calculateOverUnder(bet, matchData); // Goal line is similar to over/under

      case "THREE_WAY_HANDICAP":
        return super.calculateAsianHandicap(bet, matchData); // Similar calculation

      case "RESULT_BOTH_TEAMS_SCORE":
        return super.calculateResultBothTeamsToScore(bet, matchData);

      case "HALF_TIME_GOALS":
        return super.calculateOverUnder(bet, matchData); // Similar to over/under for specific half

      case "HALF_TIME_FULL_TIME":
        return super.calculateHalfTimeFullTime(bet, matchData);

      case "PLAYER_SHOTS_ON_TARGET":
        return super.calculatePlayerShotsOnTarget(bet, matchData);
      case "PLAYER_TOTAL_SHOTS":
        return super.calculatePlayerTotalShots(bet, matchData);
      case "EXACT_TOTAL_GOALS":
        return super.calculateExactTotalGoals(bet, matchData);
      case "SECOND_HALF_GOALS_ODD_EVEN":
        return super.calculateSecondHalfGoalsOddEven(bet, matchData);
      case "FIRST_HALF_GOALS_ODD_EVEN":
        return super.calculateFirstHalfGoalsOddEven(bet, matchData);
      case "BOTH_TEAM_TO_SCORE_1ST_HALF_2ND_HALF":
        return super.calculateBothTeamsScore1stHalf2ndHalf(bet, matchData);
      case "RESULT_TOTAL_GOALS":
        return super.calculateResultTotalGoals(bet, matchData);
      case "SECOND_HALF_RESULT":
        return super.calculateSecondHalfResult(bet, matchData);
      case "HALF_TIME_RESULT_TOTAL_GOALS":
        return super.calculateHalfTimeResultTotalGoals(bet, matchData);
      default:
        return super.calculateGenericOutcome(bet, matchData);
    }
  }
}

export default BetOutcomeCalculationService;

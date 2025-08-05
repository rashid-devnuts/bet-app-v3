import NodeCache from "node-cache";
import { CustomError } from "../utils/customErrors.js";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  normalizePlayerName,
  playerNamesMatch,
} from "../utils/playerNameUtils.js";


export default class BaseBetOutcomeCalculationService {
  constructor() {
    // Cache for match results to avoid repeated API calls
    this.outcomeCache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache
    // Result mapping for common outcomes
    this.resultMappings = {
      HOME_WIN: ["1", "home", "Home", "HOME"],
      DRAW: ["X", "x", "draw", "Draw", "DRAW", "Tie", "tie", "TIE"],
      AWAY_WIN: ["2", "away", "Away", "AWAY"],
      YES: ["yes", "Yes", "YES", "1"],
      NO: ["no", "No", "NO", "0"],
      OVER: ["over", "Over", "OVER"],
      UNDER: ["under", "Under", "UNDER"],
    };

    this.typeIdMapping = {
      shotsOnTarget: 86, // Type ID for shots on target
      shotsTotal: 42, // Type ID for total shots
      goals: 14, // Type ID for goals
      corners: 34, // Type ID for corners
    };

    this.marketsWithWinningCalculations = [
      1, 10, 14, 18, 19, 33, 38, 39, 41, 44, 50, 51,
    ];
    this.extendedMarketTypes = {
      DOUBLE_CHANCE: [2], // Double Chance
      OVER_UNDER: [4, 5, 80, 81], // Match Goals, Alternative Match Goals, Goals Over/Under
      ASIAN_HANDICAP: [6], // Asian Handicap
      GOAL_LINE: [7], // Goal Line
      CORRECT_SCORE: [8], // Final Score
      THREE_WAY_HANDICAP: [9], // 3-Way Handicap
      LAST_TEAM_TO_SCORE: [11], // Last Team To Score
      ODD_EVEN_GOALS: [12], // Goals Odd/Even
      BOTH_TEAMS_SCORE_1ST_HALF: [15], // Both Teams to Score in 1st Half
      BOTH_TEAMS_SCORE_2ND_HALF: [16], // Both Teams to Score in 2nd Half
      CLEAN_SHEET: [17], // Team Clean Sheet
      TEAM_TOTAL_GOALS: [20, 21, 86], // Home Team Goals, Away Team Goals, Team Total Goals
      HALF_TIME_RESULT: [22, 23], // To Win 1st Half, To Win 2nd Half
      TEAM_TO_SCORE_HALF: [24, 25], // Team to Score in 1st/2nd Half
      HALF_TIME_ASIAN_HANDICAP: [26], // 1st Half Asian Handicap
      HALF_TIME_GOAL_LINE: [27], // 1st Half Goal Line
      HALF_TIME_GOALS: [28, 53], // 1st Half Goals, 2nd Half Goals
      HALF_TIME_FULL_TIME: [29], // Half Time/Full Time
      GOALSCORERS: [90], // Goalscorers (First/Last/Anytime)
      PLAYER_SHOTS_ON_TARGET: [267], // Player Total Shots On Target
      PLAYER_TOTAL_SHOTS: [268], // Player Total Shots
      EXACT_TOTAL_GOALS: [93], // Exact Total Goals
      SECOND_HALF_GOALS_ODD_EVEN: [124], // Second Half Goals Odd/Even
      FIRST_HALF_GOALS_ODD_EVEN: [95], // First Half Goals Odd/Even
      BOTH_TEAM_TO_SCORE_1ST_HALF_2ND_HALF: [125],
      ALTERNATIVE_MATCH_GOALS: [5], // Both Teams to Score in 1st/2nd Half
      RESULT_TOTAL_GOALS: [37], // Result/Total Goals
      RESULT_BOTH_TEAMS_SCORE: [13],
      SECOND_HALF_RESULT: [97], // Second Half Result
      HALF_TIME_RESULT_TOTAL_GOALS: [123], // Half Time Result / Total Goals
      CORNERS: [60, 67, 68, 69], // Corner markets - 2-Way Corners, Corners, Total Corners, Alternative Corners
    };

   
  }


  
  
  getMarketType(marketId) {
    const numericMarketId = parseInt(marketId);
  
    for (const [type, ids] of Object.entries(this.extendedMarketTypes)) {
      if (ids.includes(numericMarketId)) {
        return type;
      }
    }
    return "UNKNOWN";
  }


  



  /**
   * Calculate Last Team To Score outcome
   * Uses events data with type_id: 14 (goals) to find the last goal scored
   */
  calculateLastTeamToScore(bet, matchData) {
    // Check if events data is available
    if (!matchData.events || !Array.isArray(matchData.events)) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Events data not available for last team to score calculation",
      };
    }

    // Filter events to get only goals (type_id: 14)
    const goalEvents = matchData.events.filter(
      (event) => event.type_id === this.typeIdMapping.goals
    );

    if (goalEvents.length === 0) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "No goals scored in the match",
      };
    }

    // Sort goals by minute to find the last goal
    // Calculate total time including extra time for accurate ordering
    const sortedGoals = [...goalEvents].sort((a, b) => {
      const timeA = (a.minute || 0) + (a.extra_minute || 0);
      const timeB = (b.minute || 0) + (b.extra_minute || 0);
      return timeB - timeA; // Descending order to get last goal first
    });

    const lastGoal = sortedGoals[0];
    const lastScoringTeamParticipantId = lastGoal.participant_id;

    // Get team names and build participant mapping
    let homeTeam = "Home";
    let awayTeam = "Away";
    let homeParticipantId = null;
    let awayParticipantId = null;

    // Try to extract team names from match name
    const matchName = matchData.name || "";
    if (matchName.includes(" vs ")) {
      const teams = matchName.split(" vs ");
      homeTeam = teams[0]?.trim() || "Home";
      awayTeam = teams[1]?.trim() || "Away";
    }

    // Try to get participant info from participants array
    if (matchData.participants && Array.isArray(matchData.participants)) {
      if (matchData.participants[0]) {
        homeTeam = matchData.participants[0].name || homeTeam;
        homeParticipantId = matchData.participants[0].id;
      }
      if (matchData.participants[1]) {
        awayTeam = matchData.participants[1].name || awayTeam;
        awayParticipantId = matchData.participants[1].id;
      }
    }

    // Determine which team scored the last goal
    let lastScoringTeam;
    let lastScoringTeamName;

    if (lastScoringTeamParticipantId === homeParticipantId) {
      lastScoringTeam = "HOME";
      lastScoringTeamName = homeTeam;
    } else if (lastScoringTeamParticipantId === awayParticipantId) {
      lastScoringTeam = "AWAY";
      lastScoringTeamName = awayTeam;
    } else {
      // Fallback: try to determine from goal events order or lineups
      lastScoringTeam = "UNKNOWN";
      lastScoringTeamName = "Unknown";
    }

    // Parse bet selection to determine what the user bet on
    // Check multiple sources for the bet selection
    const betSelection =
      bet.betOption ||
      bet.selection ||
      bet.betDetails?.name ||
      bet.betDetails?.label ||
      "";

    // Determine if the bet is winning
    let isWinning = false;

    // Simple comparison: "1" = home team, "2" = away team
    if (betSelection === "1") {
      // User bet on home team
      isWinning = lastScoringTeam === "HOME";
    } else if (betSelection === "2") {
      // User bet on away team
      isWinning = lastScoringTeam === "AWAY";
    } else {
      // Invalid selection
      isWinning = false;
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      lastScoringTeam: lastScoringTeamName,
      lastScoringTeamType: lastScoringTeam,
      lastGoalTime: `${lastGoal.minute}${
        lastGoal.extra_minute ? "+" + lastGoal.extra_minute : ""
      }`,
      lastGoalPlayer: lastGoal.player_name,
      betSelection: betSelection,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      homeParticipantId: homeParticipantId,
      awayParticipantId: awayParticipantId,
      lastScoringParticipantId: lastScoringTeamParticipantId,
      totalGoals: goalEvents.length,
      reason: `Last team to score: ${lastScoringTeamName} (${
        lastGoal.player_name
      } at ${lastGoal.minute}${
        lastGoal.extra_minute ? "+" + lastGoal.extra_minute : ""
      })`,
    };
  }

  /**
   * Extract match scores from match data
   */
  extractMatchScores(matchData) {
    if (matchData.scores && Array.isArray(matchData.scores)) {
      // Calculate total goals by adding 1ST_HALF + 2ND_HALF_ONLY goals for each team
      let homeScore = 0;
      let awayScore = 0;

      // Get 1ST_HALF goals
      const firstHalfScores = matchData.scores.filter(
        (score) => score.description === "1ST_HALF"
      );
      firstHalfScores.forEach((score) => {
        if (score.score && score.score.goals !== undefined) {
          if (score.score.participant === "home") {
            homeScore += score.score.goals;
          } else if (score.score.participant === "away") {
            awayScore += score.score.goals;
          }
        }
      });

      // Add 2ND_HALF_ONLY goals
      const secondHalfOnlyScores = matchData.scores.filter(
        (score) => score.description === "2ND_HALF_ONLY"
      );
      secondHalfOnlyScores.forEach((score) => {
        if (score.score && score.score.goals !== undefined) {
          if (score.score.participant === "home") {
            homeScore += score.score.goals;
          } else if (score.score.participant === "away") {
            awayScore += score.score.goals;
          }
        }
      });

      return { homeScore, awayScore };
    }

    return { homeScore: 0, awayScore: 0 };
  }
  /**
   * Extract half-time scores from match data
   */
  extractHalfTimeScores(matchData) {
    if (matchData.scores && Array.isArray(matchData.scores)) {
      // Extract 1ST_HALF scores - this is the half-time result
      const firstHalfScores = matchData.scores.filter(
        (score) => score.description === "1ST_HALF"
      );

      if (firstHalfScores.length > 0) {
        let homeScore = 0;
        let awayScore = 0;

        firstHalfScores.forEach((score) => {
          if (score.score && score.score.goals !== undefined) {
            if (score.score.participant === "home") {
              homeScore = score.score.goals;
            } else if (score.score.participant === "away") {
              awayScore = score.score.goals;
            }
          }
        });

        return { homeScore, awayScore };
      }

      // Fallback: try to find legacy half time scores
      const halfTimeScore = matchData.scores.find(
        (score) =>
          score.description === "HT" || score.description === "HALFTIME"
      );

      if (halfTimeScore && halfTimeScore.score?.goals?.home !== undefined) {
        return {
          homeScore: halfTimeScore.score.goals.home || 0,
          awayScore: halfTimeScore.score.goals.away || 0,
        };
      }
    }

    return null;
  }

  /**
   * Calculate Over/Under Goals outcome
   */
  calculateOverUnder(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const totalGoals = scores.homeScore + scores.awayScore;

    // Enhanced threshold extraction - prefer betDetails.total, then extract from other fields
    let threshold;
    let betType;

    if (bet.betDetails) {
      // For market 80 and similar, use betDetails.total for threshold and betDetails.label for type
      if (bet.betDetails.total !== null && bet.betDetails.total !== undefined) {
        threshold = parseFloat(bet.betDetails.total);
      } else {
        threshold = this.extractThreshold(
          bet.betDetails.name || bet.betDetails.label || bet.betOption
        );
      }

      // Extract bet type from label (Over/Under)
      betType = this.extractOverUnderType(
        bet.betDetails.label || bet.betDetails.name || bet.betOption
      );
    } else {
      // Fallback to original logic
      threshold = this.extractThreshold(bet.betOption);
      betType = this.extractOverUnderType(bet.betOption);
    }

    let isWinning;
    if (betType === "OVER") {
      isWinning = totalGoals > threshold;
    } else if (betType === "UNDER") {
      isWinning = totalGoals < threshold;
    } else {
      // Handle exact goals
      isWinning = totalGoals === threshold;
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualGoals: totalGoals,
      threshold: threshold,
      betType: betType,
      marketId: bet.betDetails?.market_id,
      debug: {
        betDetails: bet.betDetails,
        betOption: bet.betOption,
      },
      reason: `Total goals: ${totalGoals}, Threshold: ${threshold} (${betType})`,
    };
  }

  /**
   * Calculate Both Teams to Score outcome
   */
  calculateBothTeamsScore(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const bothTeamsScored = scores.homeScore > 0 && scores.awayScore > 0;

    const originalBetSelection =
      bet.betOption ||
      bet.selection ||
      bet.betDetails?.label ||
      bet.betDetails?.name;

    const betSelection = this.normalizeBetSelection(originalBetSelection);
    const isYesBet = this.resultMappings.YES.includes(betSelection);

    const isWinning = isYesBet ? bothTeamsScored : !bothTeamsScored;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      bothTeamsScored: bothTeamsScored,
      betSelection: betSelection,
      reason: `BTTS: ${bothTeamsScored ? "Yes" : "No"}`,
    };
  }

  /**
   * Calculate Correct Score outcome
   */
  calculateCorrectScore(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const actualScore = `${scores.homeScore}-${scores.awayScore}`;

    // Normalize bet selection for comparison
    const betScore = this.normalizeScoreFormat(bet.betOption);
    const isWinning = actualScore === betScore;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualScore: actualScore,
      betScore: betScore,
      reason: `Actual score: ${actualScore}, Bet score: ${betScore}`,
    };
  }

  /**
   * Calculate Asian Handicap outcome
   */
  calculateAsianHandicap(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const handicap = this.extractHandicap(bet.betOption);
    const team = this.extractHandicapTeam(bet.betOption);

    let adjustedHomeScore = scores.homeScore;
    let adjustedAwayScore = scores.awayScore;

    // Apply handicap
    if (team === "HOME") {
      adjustedHomeScore += handicap;
    } else {
      adjustedAwayScore += handicap;
    }

    let result;
    if (adjustedHomeScore > adjustedAwayScore) {
      result = team === "HOME" ? "won" : "lost";
    } else if (adjustedHomeScore < adjustedAwayScore) {
      result = team === "AWAY" ? "won" : "lost";
    } else {
      result = "push"; // Stake refunded
    }

    const payout =
      result === "won"
        ? bet.stake * bet.odds
        : result === "push"
        ? bet.stake
        : 0;

    return {
      status: result === "push" ? "canceled" : result,
      payout: payout,
      handicap: handicap,
      team: team,
      adjustedScore: `${adjustedHomeScore}-${adjustedAwayScore}`,
      reason: `With handicap: ${adjustedHomeScore}-${adjustedAwayScore}`,
    };
  }

  /**
   * Calculate Player Goals outcome (First/Last/Anytime Goalscorer)
   */
  calculatePlayerGoals(bet, matchData) {
    // This would require detailed match events data
    // For now, we'll use the winning field from the odds if available
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Odd not found in match data",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      playerName: bet.betOption,
      reason: `Player goal bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }

  /**
   * Calculate Goalscorers outcome (First/Last/Anytime Goalscorer)
   * Uses events data with type_id: 14 (goals) to determine outcomes
   */
  calculateGoalscorers(bet, matchData) {
    // Check if events data is available
    if (!matchData.events || !Array.isArray(matchData.events)) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Events data not available for goalscorer calculation",
      };
    }

    // Filter events to get only goals (type_id: 14)
    const goalEvents = matchData.events.filter(
      (event) => event.type_id === this.typeIdMapping.goals
    );

    if (goalEvents.length === 0) {
      return {
        status: "lost",
        payout: 0,
        reason: "No goals scored in the match",
      };
    }

    // Get the bet type from betDetails.label or betOption
    const betType = bet.betDetails?.label || bet.betOption;
    const playerName = bet.betDetails?.name;

    if (!playerName) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Player name not found in bet details",
      };
    }

    let isWinning = false;
    let goalDetails = null;

    // Sort goals by minute to determine first and last
    const sortedGoals = [...goalEvents].sort((a, b) => {
      const minuteA = (a.minute || 0) + (a.extra_minute || 0);
      const minuteB = (b.minute || 0) + (b.extra_minute || 0);
      return minuteA - minuteB;
    });

    console.log(`[calculateGoalscorers] Processing ${betType} goalscorer bet for player: ${playerName}`);
    console.log(`[calculateGoalscorers] Total goals in match: ${sortedGoals.length}`);

    switch (betType.toLowerCase()) {
      case "first":
        // Check if the player scored the first goal
        const firstGoal = sortedGoals[0];
        console.log(
          "[DEBUG] First Goal Event player_name:",
          firstGoal?.player_name,
          "| Bet playerName:",
          playerName
        );
        console.log(
          "[DEBUG] Normalized Event name:",
          this.normalizePlayerName(firstGoal?.player_name),
          "| Normalized Bet name:",
          this.normalizePlayerName(playerName)
        );
        isWinning =
          firstGoal &&
          firstGoal.player_name &&
          this.playerNamesMatch(firstGoal.player_name, playerName);
        goalDetails = firstGoal;
        break;

      case "last":
        // Check if the player scored the last goal
        const lastGoal = sortedGoals[sortedGoals.length - 1];
        console.log(
          "[DEBUG] Last Goal Event player_name:",
          lastGoal?.player_name,
          "| Bet playerName:",
          playerName
        );
        console.log(
          "[DEBUG] Normalized Event name:",
          this.normalizePlayerName(lastGoal?.player_name),
          "| Normalized Bet name:",
          this.normalizePlayerName(playerName)
        );
        isWinning =
          lastGoal &&
          lastGoal.player_name &&
          this.playerNamesMatch(lastGoal.player_name, playerName);
        goalDetails = lastGoal;
        break;

      case "anytime":
        // Check if the player scored any goal during the match
        const playerGoals = sortedGoals.filter(
          (goal) =>
            goal.player_name && this.playerNamesMatch(goal.player_name, playerName)
        );
        isWinning = playerGoals.length > 0;
        goalDetails = playerGoals;
        
        console.log(`[calculateGoalscorers] Found ${playerGoals.length} goals for player ${playerName}`);
        if (playerGoals.length > 0) {
          console.log(`[calculateGoalscorers] Player goals:`, playerGoals.map(g => ({
            player_name: g.player_name,
            minute: g.minute,
            extra_minute: g.extra_minute
          })));
        }
        break;

      default:
        return {
          status: "canceled",
          payout: bet.stake,
          reason: `Unknown goalscorer bet type: ${betType}`,
        };
    }

    // If player was not found in any goals, explicitly mark as lost
    if (!isWinning) {
      console.log(`[calculateGoalscorers] Player ${playerName} not found in goal events - marking bet as LOST`);
    }

    // Prepare response with detailed information
    const response = {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      playerName: playerName,
      betType: betType,
      totalGoalsInMatch: sortedGoals.length,
      reason: `${betType} goalscorer: ${isWinning ? "Won" : "Lost"}${!isWinning ? ` - Player ${playerName} did not score` : ""}`,
      debugInfo: {
        goalEvents: sortedGoals.map(goal => ({
          player_name: goal.player_name,
          normalized_name: this.normalizePlayerName(goal.player_name),
          minute: goal.minute,
          extra_minute: goal.extra_minute
        })),
        searchedPlayer: playerName,
        normalizedSearchedPlayer: this.normalizePlayerName(playerName)
      }
    };

    return response;
  }

  /**
   * Calculate Player Cards outcome
   */
  calculatePlayerCards(bet, matchData) {
    // Similar to player goals, this requires detailed match events
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Odd not found in match data",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      playerName: bet.betOption,
      reason: `Player card bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }

  /**
   * Calculate Double Chance outcome
   * NOTE: CHECKED (WORKING) - Enhanced with improved team name matching
   */
  calculateDoubleChance(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const { homeScore, awayScore } = scores;

    let actualResult;
    if (homeScore > awayScore) {
      actualResult = "HOME_WIN";
    } else if (homeScore < awayScore) {
      actualResult = "AWAY_WIN";
    } else {
      actualResult = "DRAW";
    }

    // Get team names from match data
    const homeTeam = matchData.participants?.[0]?.name || "Home";
    const awayTeam = matchData.participants?.[1]?.name || "Away";

    // Double chance options: 1X (Home or Draw), X2 (Draw or Away), 12 (Home or Away)
    const betOption = bet.betOption.toLowerCase();
    let isWinning = false;

    console.log(`[calculateDoubleChance] Home team: "${homeTeam}", Away team: "${awayTeam}"`);
    console.log(`[calculateDoubleChance] Bet option: "${betOption}"`);

    // Check for 1X (Home or Draw) - Home team name + Draw terms
    if (
      betOption.includes("1x") ||
      (this.teamNamesMatch(betOption, homeTeam) &&
        (betOption.includes("draw") ||
          betOption.includes("tie") ||
          betOption.includes("x")))
    ) {
      isWinning = actualResult === "HOME_WIN" || actualResult === "DRAW";
    }
    // Check for X2 (Draw or Away) - Draw terms + Away team name
    else if (
      betOption.includes("x2") ||
      ((betOption.includes("draw") ||
        betOption.includes("tie") ||
        betOption.includes("x")) &&
        this.teamNamesMatch(betOption, awayTeam))
    ) {
      isWinning = actualResult === "DRAW" || actualResult === "AWAY_WIN";
    }
    // Check for 12 (Home or Away) - Both team names
    else if (
      betOption.includes("12") ||
      (this.teamNamesMatch(betOption, homeTeam) &&
        this.teamNamesMatch(betOption, awayTeam))
    ) {
      isWinning = actualResult === "HOME_WIN" || actualResult === "AWAY_WIN";
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualResult: actualResult,
      betOption: betOption,
      homeTeam: homeTeam,
      awayTeam: awayTeam,
      reason: `Double chance: ${isWinning ? "Won" : "Lost"} (${actualResult})`,
    };
  }

  /**
   * Calculate Half Time Result outcome
   */
  calculateHalfTimeResult(bet, matchData) {
    // Extract half-time scores if available
    const halfTimeScores = this.extractHalfTimeScores(matchData);

    if (!halfTimeScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Half-time scores not available",
      };
    }

    let actualResult;
    if (halfTimeScores.homeScore > halfTimeScores.awayScore) {
      actualResult = "HOME_WIN";
    } else if (halfTimeScores.homeScore < halfTimeScores.awayScore) {
      actualResult = "AWAY_WIN";
    } else {
      actualResult = "DRAW";
    }

    const betSelection = this.normalizeBetSelection(bet.betOption);
    const isWinning = this.isResultMatch(betSelection, actualResult);

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualResult: `${halfTimeScores.homeScore}-${halfTimeScores.awayScore}`,
      expectedResult: betSelection,
      reason: `Half-time result: ${halfTimeScores.homeScore}-${halfTimeScores.awayScore}`,
    };
  }

  /**
   * Calculate Corners outcome
   * Enhanced to use actual corner statistics for markets 60, 67, 68, 69
   */
  calculateCorners(bet, matchData) {
    // Extract corner statistics using the new method
    const cornerStats = this.extractCornerStats(matchData);

    // If we have corner statistics, use them for calculation
    if (cornerStats.totalCorners >= 0) {
      const marketId = bet.betDetails?.market_id || bet.marketId;

      // Handle different corner market types
      switch (parseInt(marketId)) {
        case 60: // 2-Way Corners (Over/Under)
          return this.calculateCornersOverUnder(bet, cornerStats);

        case 67: // Corners (Team-specific)
          return this.calculateTeamCorners(bet, cornerStats);

        case 68: // Total Corners (Over/Under)
          return this.calculateCornersOverUnder(bet, cornerStats);

        case 69: // Alternative Corners (Over/Under)
          return this.calculateCornersOverUnder(bet, cornerStats);

        default:
          // Generic corner calculation for other markets
          return this.calculateGenericCorners(bet, cornerStats);
      }
    }

    // Fallback to winning field if corner statistics not available
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Corner data not available",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      reason: `Corner bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }

  /**
   * Calculate Total Cards outcome
   */
  calculateCardsTotal(bet, matchData) {
    // This would require card statistics from match data
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Card data not available",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      reason: `Cards bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }

  /**
   * Calculate outcome for Total Goals markets (exact numbers)
   */
  calculateTotalGoals(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const totalGoals = scores.homeScore + scores.awayScore;

    const expectedGoals = parseInt(bet.betOption.match(/\d+/)?.[0] || 0);
    const isWinning = totalGoals === expectedGoals;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualGoals: totalGoals,
      expectedGoals: expectedGoals,
      reason: `Total goals: ${totalGoals}, Expected: ${expectedGoals}`,
    };
  }

  /**
   * Calculate outcome for Team Total Goals
   */
  calculateTeamTotalGoals(bet, matchData) {
    const scores = this.extractMatchScores(matchData);

    // Enhanced team identification - check betDetails first for market 86, then fallback to existing logic
    let teamGoals;
    let teamIdentifier = "";
    let teamName = "";

    // Check if bet description contains team name for exact goals
    if (bet.betDetails?.market_description) {
      const description = bet.betDetails.market_description.toLowerCase();
      const homeTeam = matchData.participants?.[0]?.name || "home";
      const awayTeam = matchData.participants?.[1]?.name || "away";

      console.log(
        `[calculateTeamTotalGoals] Checking team from market description: "${bet.betDetails.market_description}"`
      );
      console.log(
        `[calculateTeamTotalGoals] Home team: ${homeTeam}, Away team: ${awayTeam}`
      );

      if (description.includes(homeTeam.toLowerCase())) {
        teamGoals = scores.homeScore;
        teamName = homeTeam;
        teamIdentifier = "home";
        console.log(
          `[calculateTeamTotalGoals] Identified as home team bet: ${homeTeam} scored ${teamGoals} goals`
        );
      } else if (description.includes(awayTeam.toLowerCase())) {
        teamGoals = scores.awayScore;
        teamName = awayTeam;
        teamIdentifier = "away";
        console.log(
          `[calculateTeamTotalGoals] Identified as away team bet: ${awayTeam} scored ${teamGoals} goals`
        );
      }
    }

    // For market 86 - use betDetails.label for team identification
    if (
      !teamIdentifier &&
      bet.betDetails &&
      bet.betDetails.market_id === "86" &&
      bet.betDetails.label
    ) {
      teamIdentifier = bet.betDetails.label;

      // "1" means home team, "2" means away team
      if (teamIdentifier === "1") {
        teamGoals = scores.homeScore;
        teamName = matchData.participants?.[0]?.name || "Home";
      } else if (teamIdentifier === "2") {
        teamGoals = scores.awayScore;
        teamName = matchData.participants?.[1]?.name || "Away";
      } else {
        return {
          status: "canceled",
          payout: bet.stake,
          reason: "Unable to determine team from label",
          teamIdentifier: teamIdentifier,
        };
      }
    }

    // Fallback to existing logic for other markets
    if (!teamIdentifier) {
      const betOption = bet.betOption.toLowerCase();
      teamIdentifier = betOption;

      if (betOption.includes("home")) {
        teamGoals = scores.homeScore;
        teamName = matchData.participants?.[0]?.name || "Home";
      } else if (betOption.includes("away")) {
        teamGoals = scores.awayScore;
        teamName = matchData.participants?.[1]?.name || "Away";
      } else {
        return {
          status: "canceled",
          payout: bet.stake,
          reason: "Unable to determine team",
        };
      }
    }

    // Check if this is an exact goals bet (bet option contains number + "goal")
    const exactGoalsMatch = bet.betOption.match(/(\d+)\s*goals?/i);
    if (exactGoalsMatch) {
      const targetGoals = parseInt(exactGoalsMatch[1]);
      const isWinning = teamGoals === targetGoals;

      console.log(
        `[calculateTeamTotalGoals] Exact goals bet: ${teamName} scored ${teamGoals}, target was ${targetGoals}, winning: ${isWinning}`
      );

      return {
        status: isWinning ? "won" : "lost",
        payout: isWinning ? bet.stake * bet.odds : 0,
        teamGoals: teamGoals,
        targetGoals: targetGoals,
        teamName: teamName,
        reason: `${teamName} goals: ${teamGoals}, Target: ${targetGoals}`,
      };
    }

    // For exact goals markets (market IDs 18, 19), check exact match
    if (
      bet.betDetails?.market_id === "18" ||
      bet.betDetails?.market_id === "19"
    ) {
      const targetGoals = parseInt(bet.betOption) || 0;
      const isWinning = teamGoals === targetGoals;

      return {
        status: isWinning ? "won" : "lost",
        payout: isWinning ? bet.stake * bet.odds : 0,
        teamGoals: teamGoals,
        targetGoals: targetGoals,
        reason: `Team goals: ${teamGoals}, Target: ${targetGoals}`,
      };
    }

    // For market 86 - Team Total Goals with Over/Under logic
    if (bet.betDetails?.market_id === "86") {
      // Check if we have Over/Under information in betDetails.total
      if (bet.betDetails.total) {
        const totalText = bet.betDetails.total.toString();
        console.log(
          `[calculateTeamTotalGoals] Processing Over/Under bet: ${totalText} for team ${teamIdentifier}`
        );

        // Parse Over/Under from total field (e.g., "Over 0.5", "Under 1.5")
        const overMatch = totalText.match(/over\s+(\d+(?:\.\d+)?)/i);
        const underMatch = totalText.match(/under\s+(\d+(?:\.\d+)?)/i);

        if (overMatch) {
          const threshold = parseFloat(overMatch[1]);
          const isWinning = teamGoals > threshold;

          console.log(
            `[calculateTeamTotalGoals] Over ${threshold}: Team ${teamIdentifier} scored ${teamGoals} goals, winning: ${isWinning}`
          );

          return {
            status: isWinning ? "won" : "lost",
            payout: isWinning ? bet.stake * bet.odds : 0,
            teamGoals: teamGoals,
            threshold: threshold,
            betType: "Over",
            teamIdentifier: teamIdentifier,
            teamName: teamName,
            reason: `Team ${teamName} goals: ${teamGoals}, Over ${threshold}: ${
              isWinning ? "Won" : "Lost"
            }`,
          };
        } else if (underMatch) {
          const threshold = parseFloat(underMatch[1]);
          const isWinning = teamGoals < threshold;

          console.log(
            `[calculateTeamTotalGoals] Under ${threshold}: Team ${teamIdentifier} scored ${teamGoals} goals, winning: ${isWinning}`
          );

          return {
            status: isWinning ? "won" : "lost",
            payout: isWinning ? bet.stake * bet.odds : 0,
            teamGoals: teamGoals,
            threshold: threshold,
            betType: "Under",
            teamIdentifier: teamIdentifier,
            teamName: teamName,
            reason: `Team ${teamName} goals: ${teamGoals}, Under ${threshold}: ${
              isWinning ? "Won" : "Lost"
            }`,
          };
        } else {
          console.log(
            `[calculateTeamTotalGoals] Could not parse Over/Under from: ${totalText}`
          );
        }
      }

      // Fallback - simple team selection (bet on team scoring at least 1 goal)
      const isWinning = teamGoals > 0;

      return {
        status: isWinning ? "won" : "lost",
        payout: isWinning ? bet.stake * bet.odds : 0,
        teamGoals: teamGoals,
        teamIdentifier: teamIdentifier,
        teamName: teamName,
        reason: `Team ${teamName} goals: ${teamGoals} (simple bet)`,
      };
    }

    // Existing over/under logic for other markets
    const threshold = this.extractThreshold(bet.betOption);
    const betType = this.extractOverUnderType(bet.betOption);

    let isWinning;
    if (betType === "OVER") {
      isWinning = teamGoals > threshold;
    } else if (betType === "UNDER") {
      isWinning = teamGoals < threshold;
    } else {
      isWinning = teamGoals === threshold;
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      teamGoals: teamGoals,
      threshold: threshold,
      reason: `Team goals: ${teamGoals}, Threshold: ${threshold}`,
    };
  }

  /**
   * Calculate outcome for First/Last Goal Scorer
   */
  calculateGoalScorer(bet, matchData) {
    // This requires detailed match events which may not be available
    // Fall back to using the winning field from the odds
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Goal scorer data not available",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      playerName: bet.betOption,
      reason: `Goal scorer bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }

  /**
   * Calculate outcome for Clean Sheet markets
   */
  calculateCleanSheet(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const betOption = bet.betOption.toLowerCase();

    let hasCleanSheet = false;
    if (betOption.includes("home")) {
      hasCleanSheet = scores.awayScore === 0;
    } else if (betOption.includes("away")) {
      hasCleanSheet = scores.homeScore === 0;
    } else {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Unable to determine team for clean sheet",
      };
    }

    const betSelection = this.normalizeBetSelection(bet.betOption);
    const isYesBet =
      this.resultMappings.YES.includes(betSelection) ||
      betOption.includes("yes");
    const isWinning = isYesBet ? hasCleanSheet : !hasCleanSheet;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      hasCleanSheet: hasCleanSheet,
      reason: `Clean sheet: ${hasCleanSheet ? "Yes" : "No"}`,
    };
  }

  /**
   * Calculate outcome for Win to Nil markets
   */
  calculateWinToNil(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const betOption = bet.betOption.toLowerCase();

    let winToNil = false;
    if (betOption.includes("home")) {
      winToNil = scores.homeScore > 0 && scores.awayScore === 0;
    } else if (betOption.includes("away")) {
      winToNil = scores.awayScore > 0 && scores.homeScore === 0;
    }

    return {
      status: winToNil ? "won" : "lost",
      payout: winToNil ? bet.stake * bet.odds : 0,
      actualResult: `${scores.homeScore}-${scores.awayScore}`,
      reason: `Win to nil: ${winToNil ? "Yes" : "No"}`,
    };
  }

  /**
   * Calculate outcome for Odd/Even Goals
   */
  calculateOddEvenGoals(bet, matchData) {
    const scores = this.extractMatchScores(matchData);
    const totalGoals = scores.homeScore + scores.awayScore;

    const isOdd = totalGoals % 2 === 1;
    const betOption = bet.betOption.toLowerCase();

    let isWinning;
    if (betOption.includes("odd")) {
      isWinning = isOdd;
    } else if (betOption.includes("even")) {
      isWinning = !isOdd;
    } else {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Unable to determine odd/even selection",
      };
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      totalGoals: totalGoals,
      isOdd: isOdd,
      reason: `Total goals: ${totalGoals} (${isOdd ? "Odd" : "Even"})`,
    };
  }

  /**
   * Calculate outcome for Highest Scoring Half
   */
  calculateHighestScoringHalf(bet, matchData) {
    const fullTimeScores = this.extractMatchScores(matchData);
    const halfTimeScores = this.extractHalfTimeScores(matchData);

    if (!halfTimeScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Half-time scores not available",
      };
    }

    const firstHalfGoals = halfTimeScores.homeScore + halfTimeScores.awayScore;
    const secondHalfGoals =
      fullTimeScores.homeScore -
      halfTimeScores.homeScore +
      (fullTimeScores.awayScore - halfTimeScores.awayScore);

    let highestScoringHalf;
    if (firstHalfGoals > secondHalfGoals) {
      highestScoringHalf = "1st Half";
    } else if (secondHalfGoals > firstHalfGoals) {
      highestScoringHalf = "2nd Half";
    } else {
      highestScoringHalf = "Equal";
    }

    const betOption = bet.betOption.toLowerCase();
    let isWinning = false;

    if (betOption.includes("1st") && highestScoringHalf === "1st Half") {
      isWinning = true;
    } else if (betOption.includes("2nd") && highestScoringHalf === "2nd Half") {
      isWinning = true;
    } else if (betOption.includes("equal") && highestScoringHalf === "Equal") {
      isWinning = true;
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      firstHalfGoals: firstHalfGoals,
      secondHalfGoals: secondHalfGoals,
      highestScoringHalf: highestScoringHalf,
      reason: `Highest scoring half: ${highestScoringHalf}`,
    };
  }

  /**
   * Calculate outcome for Half Time / Full Time Double Result
   */

  /**
   * Calculate outcome for Penalty markets
   */
  calculatePenalty(bet, matchData) {
    // This requires detailed match events for penalty information
    // Fall back to using the winning field from the odds
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Penalty data not available",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      reason: `Penalty bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }

  /**
   * Calculate outcome for booking points/cards markets with handicap
   */
  calculateCardsHandicap(bet, matchData) {
    // This would require detailed card statistics
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Cards handicap data not available",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      reason: `Cards handicap bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }

  /**
   * Calculate outcome for corners handicap markets
   */
  calculateCornersHandicap(bet, matchData) {
    // This would require detailed corner statistics
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Corners handicap data not available",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      reason: `Corners handicap bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }

  /**
   * Calculate outcome for minute-based markets (goal timing, etc.)
   */
  calculateMinuteMarkets(bet, matchData) {
    // This requires detailed match events with timing
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Minute market data not available",
      };
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      reason: `Minute market bet: ${isWinning ? "Won" : "Lost"}`,
    };
  }
  /**
   * Calculate outcome for Player Shots On Target market
   * Uses betDetails.name for player name and betDetails.label for shots threshold
   */
  calculatePlayerShotsOnTarget(bet, matchData) {
    // Extract player name from betDetails
    const playerName = bet.betDetails?.name;
    const shotsThreshold = parseFloat(bet.betDetails?.label || "0.0");

    if (!playerName) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Player name not found in bet details",
      };
    }

    // Check if lineups data is available
    if (!matchData.lineups || !Array.isArray(matchData.lineups)) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Lineups data not available for player shots calculation",
      };
    }

    console.log(`[calculatePlayerShotsOnTarget] Looking for player: ${playerName}`);
    console.log(`[calculatePlayerShotsOnTarget] Normalized search name: ${this.normalizePlayerName(playerName)}`);

    // Find the player in lineups using enhanced name matching
    const player = matchData.lineups.find(
      (lineup) => this.playerNamesMatch(lineup.player_name, playerName)
    );

    if (!player) {
      console.log(`[calculatePlayerShotsOnTarget] Player ${playerName} not found in lineups - marking bet as LOST`);
      console.log(`[calculatePlayerShotsOnTarget] Available players:`, matchData.lineups.map(l => ({
        player_name: l.player_name,
        normalized_name: this.normalizePlayerName(l.player_name)
      })));

      return {
        status: "lost",
        payout: 0,
        reason: `Player ${playerName} not found in match lineups - bet lost`,
        playerName: playerName,
        normalizedPlayerName: this.normalizePlayerName(playerName),
        debugInfo: {
          searchedPlayer: playerName,
          availablePlayers: matchData.lineups.map(l => l.player_name)
        }
      };
    }

    console.log(`[calculatePlayerShotsOnTarget] Found player: ${player.player_name}`);

    // Find shots on target statistic using typeIdMapping
    const shotsOnTargetStat = player.details?.find(
      (detail) => detail.type_id === this.typeIdMapping.shotsOnTarget
    );

    if (!shotsOnTargetStat) {
      return {
        status: "lost",
        payout: 0,
        reason: `Shots on target data not available for player ${playerName} - bet lost`,
        playerName: playerName,
        foundPlayerName: player.player_name
      };
    }

    const actualShotsOnTarget = shotsOnTargetStat.data?.value || 0;

    // Compare actual shots with threshold (Over/Under logic)
    const isWinning = actualShotsOnTarget > shotsThreshold;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      playerName: playerName,
      foundPlayerName: player.player_name,
      actualShotsOnTarget: actualShotsOnTarget,
      shotsThreshold: shotsThreshold,
      reason: `Player ${player.player_name} shots on target: ${actualShotsOnTarget}, Threshold: ${shotsThreshold}`,
    };
  }

  calculatePlayerTotalShots(bet, matchData) {
    // Extract player name and threshold from bet details
    const playerName = bet.betDetails?.name;
    const shotsThreshold = parseFloat(bet.betDetails?.label || "0.0");

    if (!playerName) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Player name not found in bet details",
      };
    }

    // Check if lineups data is available
    if (!matchData.lineups || !Array.isArray(matchData.lineups)) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Lineups data not available for player shots calculation",
      };
    }

    console.log(`[calculatePlayerTotalShots] Looking for player: ${playerName}`);
    console.log(`[calculatePlayerTotalShots] Normalized search name: ${this.normalizePlayerName(playerName)}`);

    // Find the player in lineups using enhanced name matching
    const player = matchData.lineups.find(
      (lineup) => this.playerNamesMatch(lineup.player_name, playerName)
    );

    if (!player) {
      console.log(`[calculatePlayerTotalShots] Player ${playerName} not found in lineups - marking bet as LOST`);
      console.log(`[calculatePlayerTotalShots] Available players:`, matchData.lineups.map(l => ({
        player_name: l.player_name,
        normalized_name: this.normalizePlayerName(l.player_name)
      })));

      return {
        status: "lost",
        payout: 0,
        reason: `Player ${playerName} not found in match lineups - bet lost`,
        playerName: playerName,
        normalizedPlayerName: this.normalizePlayerName(playerName),
        debugInfo: {
          searchedPlayer: playerName,
          availablePlayers: matchData.lineups.map(l => l.player_name)
        }
      };
    }

    console.log(`[calculatePlayerTotalShots] Found player: ${player.player_name}`);

    // Find total shots statistic using typeIdMapping
    const shotsTotalStat = player.details?.find(
      (detail) => detail.type_id === this.typeIdMapping.shotsTotal
    );

    if (!shotsTotalStat) {
      return {
        status: "lost",
        payout: 0,
        reason: `Total shots data not available for player ${playerName} - bet lost`,
        playerName: playerName,
        foundPlayerName: player.player_name
      };
    }

    const actualShotsTotal = shotsTotalStat.data?.value || 0;

    // Compare actual shots with threshold (Over/Under logic)
    const isWinning = actualShotsTotal > shotsThreshold;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      playerName: playerName,
      foundPlayerName: player.player_name,
      actualShotsTotal: actualShotsTotal,
      shotsThreshold: shotsThreshold,
      reason: `Player ${player.player_name} total shots: ${actualShotsTotal}, Threshold: ${shotsThreshold}`,
    };
  }

  /**
   * Helper method to normalize team names for comparison
   * Handles variations like "Urawa Red Diamonds" vs "Urawa Reds"
   */
  normalizeTeamName(teamName) {
    if (!teamName) return "";
    
    return teamName
      .toLowerCase()
      .replace(/\s+/g, " ") // Normalize spaces
      .trim()
      // Remove common suffixes/variations
      .replace(/\s+(fc|cf|ac|sc|united|city|town|rovers|wanderers|albion|athletic|hotspur)$/i, "")
      // Handle specific variations
      .replace(/\s+red\s+diamonds?$/i, " reds") // "Red Diamonds" -> "Reds"
      .replace(/\s+diamonds?$/i, " reds") // "Diamonds" -> "Reds"
      .replace(/\s+whites?$/i, "") // Remove "White/Whites"
      .replace(/\s+blues?$/i, "") // Remove "Blue/Blues"
      .trim();
  }

  /**
   * Helper method to check if two team names match (with normalization)
   */
  teamNamesMatch(name1, name2) {
    if (!name1 || !name2) return false;
    
    const normalized1 = this.normalizeTeamName(name1);
    const normalized2 = this.normalizeTeamName(name2);
    
    // Exact match after normalization
    if (normalized1 === normalized2) return true;
    
    // Check if one name contains the other (for partial matches)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }
    
    // Check if they share significant keywords (at least 2 words)
    const words1 = normalized1.split(" ").filter(w => w.length > 2);
    const words2 = normalized2.split(" ").filter(w => w.length > 2);
    
    if (words1.length >= 2 && words2.length >= 2) {
      const commonWords = words1.filter(word => words2.includes(word));
      return commonWords.length >= 2;
    }
    
    return false;
  }

  /**
   * Normalize player name for comparison
   * Removes special characters, diacritics, and standardizes formatting
   */
  normalizePlayerName(playerName) {
    if (!playerName) return "";
    
    return playerName
      .toLowerCase()
      // Remove diacritics and special characters
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
      .replace(/[^a-z0-9\s]/g, "") // Remove all non-alphanumeric except spaces
      .replace(/\s+/g, " ") // Normalize multiple spaces to single space
      .trim()
      // Handle common name variations
      .replace(/\bjr\.?\b/g, "junior") // Jr. -> junior
      .replace(/\bsr\.?\b/g, "senior") // Sr. -> senior
      .replace(/\biii\b/g, "3") // III -> 3
      .replace(/\bii\b/g, "2") // II -> 2
      .replace(/\biv\b/g, "4") // IV -> 4
      .trim();
  }

  /**
   * Check if two player names match using fuzzy comparison
   * Handles variations in spelling, special characters, and formatting
   */
  playerNamesMatch(name1, name2) {
    if (!name1 || !name2) return false;
    
    const normalized1 = this.normalizePlayerName(name1);
    const normalized2 = this.normalizePlayerName(name2);
    
    console.log(`[playerNamesMatch] Comparing: "${normalized1}" vs "${normalized2}"`);
    
    // Exact match after normalization
    if (normalized1 === normalized2) {
      console.log(`[playerNamesMatch] Exact match found`);
      return true;
    }
    
    // Split names into parts (first, middle, last names)
    const parts1 = normalized1.split(" ").filter(part => part.length > 0);
    const parts2 = normalized2.split(" ").filter(part => part.length > 0);
    
    // If both names have multiple parts, check for partial matches
    if (parts1.length >= 2 && parts2.length >= 2) {
      // Check if last names match and at least one other name part matches
      const lastName1 = parts1[parts1.length - 1];
      const lastName2 = parts2[parts2.length - 1];
      
      if (lastName1 === lastName2) {
        // Last names match, check for first name or middle name match
        const otherParts1 = parts1.slice(0, -1);
        const otherParts2 = parts2.slice(0, -1);
        
        const hasCommonFirstName = otherParts1.some(part1 => 
          otherParts2.some(part2 => 
            part1 === part2 || 
            (part1.length >= 3 && part2.length >= 3 && 
             (part1.startsWith(part2) || part2.startsWith(part1)))
          )
        );
        
        if (hasCommonFirstName) {
          console.log(`[playerNamesMatch] Partial match: same last name + common first name`);
          return true;
        }
      }
      
      // Check if first names match and at least one other part matches
      if (parts1[0] === parts2[0] && parts1[0].length >= 3) {
        const hasOtherMatch = parts1.slice(1).some(part1 => 
          parts2.slice(1).some(part2 => part1 === part2)
        );
        
        if (hasOtherMatch) {
          console.log(`[playerNamesMatch] Partial match: same first name + other matching part`);
          return true;
        }
      }
    }
    
    // Check for substring matches (useful for names like "Gabriel Martinelli" vs "Martinelli")
    if (normalized1.length >= 6 && normalized2.length >= 6) {
      if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
        console.log(`[playerNamesMatch] Substring match found`);
        return true;
      }
    }
    
    // Check for similar names using Levenshtein distance for very close matches
    if (this.calculateLevenshteinDistance(normalized1, normalized2) <= 2 && 
        Math.min(normalized1.length, normalized2.length) >= 6) {
      console.log(`[playerNamesMatch] Close match found using Levenshtein distance`);
      return true;
    }
    
    console.log(`[playerNamesMatch] No match found`);
    return false;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy string matching
   */
  calculateLevenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate outcome for Half Time/Full Time market
   * Handles bets like "Tijuana - Draw" (Half Time result - Full Time result)
   */
  calculateHalfTimeFullTime(bet, matchData) {
    // Extract both half-time and full-time scores
    const halfTimeScores = this.extractHalfTimeScores(matchData);
    const fullTimeScores = this.extractMatchScores(matchData);

    if (!halfTimeScores || !fullTimeScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Score data not available",
      };
    }

    // Get team names from match data
    const homeTeam = matchData.participants?.[0]?.name || "Home";
    const awayTeam = matchData.participants?.[1]?.name || "Away";

    console.log(`[calculateHalfTimeFullTime] Home team: "${homeTeam}", Away team: "${awayTeam}"`);

    // Determine half-time result
    let halfTimeResult;
    if (halfTimeScores.homeScore > halfTimeScores.awayScore) {
      halfTimeResult = homeTeam; // Home team wins half time
    } else if (halfTimeScores.homeScore < halfTimeScores.awayScore) {
      halfTimeResult = awayTeam; // Away team wins half time
    } else {
      halfTimeResult = "Draw"; // Half time draw
    }

    // Determine full-time result
    let fullTimeResult;
    if (fullTimeScores.homeScore > fullTimeScores.awayScore) {
      fullTimeResult = homeTeam; // Home team wins full time
    } else if (fullTimeScores.homeScore < fullTimeScores.awayScore) {
      fullTimeResult = awayTeam; // Away team wins full time
    } else {
      fullTimeResult = "Draw"; // Full time draw
    }

    // Parse bet selection (e.g., "Urawa Red Diamonds - Urawa Red Diamonds")
    const betOption = bet.betOption || bet.selection || "";
    const betParts = betOption.split(" - ");

    if (betParts.length !== 2) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Invalid bet format for Half Time/Full Time",
      };
    }

    const expectedHalfTime = betParts[0].trim();
    const expectedFullTime = betParts[1].trim();

    console.log(`[calculateHalfTimeFullTime] Expected HT: "${expectedHalfTime}", Expected FT: "${expectedFullTime}"`);
    console.log(`[calculateHalfTimeFullTime] Actual HT: "${halfTimeResult}", Actual FT: "${fullTimeResult}"`);

    // Check if the bet selection matches the actual results using enhanced team matching
    let halfTimeMatch = false;
    let fullTimeMatch = false;

    // Check half-time match with improved team name matching
    if (expectedHalfTime.toLowerCase() === "draw") {
      halfTimeMatch = halfTimeResult === "Draw";
    } else if (this.teamNamesMatch(expectedHalfTime, homeTeam)) {
      halfTimeMatch = halfTimeResult === homeTeam;
    } else if (this.teamNamesMatch(expectedHalfTime, awayTeam)) {
      halfTimeMatch = halfTimeResult === awayTeam;
    }

    // Check full-time match with improved team name matching
    if (expectedFullTime.toLowerCase() === "draw") {
      fullTimeMatch = fullTimeResult === "Draw";
    } else if (this.teamNamesMatch(expectedFullTime, homeTeam)) {
      fullTimeMatch = fullTimeResult === homeTeam;
    } else if (this.teamNamesMatch(expectedFullTime, awayTeam)) {
      fullTimeMatch = fullTimeResult === awayTeam;
    }

    console.log(`[calculateHalfTimeFullTime] Half time match: ${halfTimeMatch}, Full time match: ${fullTimeMatch}`);

    const isWinning = halfTimeMatch && fullTimeMatch;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      reason: `Half Time/Full Time: HT: ${halfTimeResult}, FT: ${fullTimeResult}, Expected: ${expectedHalfTime} - ${expectedFullTime}`,
      actualResult: `${halfTimeResult} - ${fullTimeResult}`,
      expectedResult: betOption,
      teamMatchingDebug: {
        homeTeam,
        awayTeam,
        expectedHalfTime,
        expectedFullTime,
        halfTimeMatch,
        fullTimeMatch,
        normalizedHome: this.normalizeTeamName(homeTeam),
        normalizedAway: this.normalizeTeamName(awayTeam),
        normalizedExpectedHT: this.normalizeTeamName(expectedHalfTime),
        normalizedExpectedFT: this.normalizeTeamName(expectedFullTime),
      }
    };
  }

  calculateExactTotalGoals(bet, matchData) {
    // Extract the number from the label (e.g., "5 Goals" -> 5)
    const exactTotalGoals = parseInt(
      (bet.betDetails?.label || "").match(/\d+/)?.[0] || 0
    );
    const matchScores = this.extractMatchScores(matchData);
    const totalGoals = matchScores.homeScore + matchScores.awayScore;
    const isWinning = totalGoals === exactTotalGoals;
    return {
      status: isWinning ? "won" : "lost",
    };
  }
  calculateSecondHalfGoalsOddEven(bet, matchData) {
    const matchScores = this.extractSecondHalfScores(matchData);
    const totalGoals = matchScores.homeScore + matchScores.awayScore;
    const isWinning = totalGoals % 2 === 0;
    return {
      status: isWinning ? "won" : "lost",
    };
  }
  calculateFirstHalfGoalsOddEven(bet, matchData) {
    const matchScores = this.extractFirstHalfScores(matchData);
    const totalGoals = matchScores.homeScore + matchScores.awayScore;
    const isWinning = totalGoals % 2 === 0;
    return {
      status: isWinning ? "won" : "lost",
    };
  }


  /**
   * Calculate outcome for Result/Both Teams To Score (market_id: 13)
   * This market combines match result (home/draw/away) with both teams to score (yes/no)
   * betDetails.label and betDetails.name contain combinations like:
   * "Home/Yes", "Home/No", "Draw/Yes", "Draw/No", "Away/Yes", "Away/No"
   */
  calculateResultBothTeamsToScore(bet, matchData) {
    // Extract scores
    const scores = this.extractMatchScores(matchData);
    const { homeScore, awayScore } = scores;

    // Determine actual match result
    let actualResult;
    if (homeScore > awayScore) {
      actualResult = "Home";
    } else if (homeScore < awayScore) {
      actualResult = "Away";
    } else {
      actualResult = "Draw";
    }

    // Determine if both teams scored
    const bothTeamsScored = homeScore > 0 && awayScore > 0;
    const actualBTTS = bothTeamsScored ? "Yes" : "No";

    // Parse bet selection from betDetails (prefer betDetails.label, fallback to betDetails.name)
    const betSelection =
      bet.betDetails?.label ||
      bet.betDetails?.name ||
      bet.betOption ||
      bet.selection ||
      "";

    // Split the bet selection (e.g., "Away/No" -> ["Away", "No"])
    const betParts = betSelection.split("/");

    if (betParts.length !== 2) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Invalid bet format for Result/Both Teams To Score",
      };
    }

    const betResult = betParts[0].trim();
    const betBTTS = betParts[1].trim();

    // Check if both result and BTTS match
    const resultMatch = actualResult === betResult;
    const bttsMatch = actualBTTS === betBTTS;
    const isWinning = resultMatch && bttsMatch;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualResult: actualResult,
      actualBTTS: actualBTTS,
      betResult: betResult,
      betBTTS: betBTTS,
      bothTeamsScored: bothTeamsScored,
      homeScore: homeScore,
      awayScore: awayScore,
      betSelection: betSelection,
      reason: `Result: ${actualResult}, BTTS: ${actualBTTS}, Bet: ${betResult}/${betBTTS}`,
    };
  }

  /**
   * Calculate outcome using the winning field from odds
   */
  calculateOutcomeFromWinningField(bet, matchData) {
    const selectedOdd = this.findSelectedOdd(bet, matchData);
   
    
    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Odd not found in match data",
      };
    }

    // For inplay bets where we created a synthetic odd with winning: null,
    // we need to fall back to manual calculation
    if (selectedOdd.winning === null && bet.inplay) {
      console.log(
        `[calculateOutcomeFromWinningField] Inplay bet with null winning field, falling back to manual calculation`
      );

      // Determine the correct market type from bet details
      const marketId = bet.betDetails?.market_id || bet.marketId;

      // Check if this is actually a team goals market based on description
      if (
        bet.betDetails?.market_description
          ?.toLowerCase()
          .includes("exact goals") ||
        bet.betDetails?.market_description
          ?.toLowerCase()
          .includes("team goals") ||
        bet.betDetails?.market_description
          ?.toLowerCase()
          .includes("total goals")
      ) {
        console.log(
          `[calculateOutcomeFromWinningField] Detected team goals market, using team total goals calculation`
        );
        return this.calculateTeamTotalGoals(bet, matchData);
      }

      // Fall back to market type calculation
      return this.calculateOutcomeByMarketType(bet, matchData, marketId);
    }

    const isWinning = selectedOdd.winning === true;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      reason: `Winning field calculation: ${isWinning ? "Won" : "Lost"}`,
      winningField: selectedOdd.winning,
    };
  }




  extractFirstHalfScores(matchData) {
    if (matchData.scores && Array.isArray(matchData.scores)) {
      // Extract 1ST_HALF scores - this is the half-time result
      const firstHalfScores = matchData.scores.filter(
        (score) => score.description === "1ST_HALF"
      );

      if (firstHalfScores.length > 0) {
        let homeScore = 0;
        let awayScore = 0;

        firstHalfScores.forEach((score) => {
          if (score.score && score.score.goals !== undefined) {
            if (score.score.participant === "home") {
              homeScore = score.score.goals;
            } else if (score.score.participant === "away") {
              awayScore = score.score.goals;
            }
          }
        });

        return { homeScore, awayScore };
      }

      // Fallback: try to find legacy half time scores
      const halfTimeScore = matchData.scores.find(
        (score) =>
          score.description === "HT" || score.description === "HALFTIME"
      );

      if (halfTimeScore && halfTimeScore.score?.goals?.home !== undefined) {
        return {
          homeScore: halfTimeScore.score.goals.home || 0,
          awayScore: halfTimeScore.score.goals.away || 0,
        };
      }
    }

    return null;
  }

  /**
   * Calculate Both Teams to Score in 1st Half outcome (Market 15)
   */
  calculateBothTeamsScore1stHalf(bet, matchData) {
    const firstHalfScores = this.extractFirstHalfScores(matchData);
    
    if (!firstHalfScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "First half scores not available",
      };
    }

    // Check if both teams scored in the first half
    const bothTeamsScored1stHalf = firstHalfScores.homeScore > 0 && firstHalfScores.awayScore > 0;

    // Get bet selection from betDetails
    const originalBetSelection = bet.betDetails?.label || bet.betDetails?.name || bet.betOption;
    const betSelection = this.normalizeBetSelection(originalBetSelection);
    const isYesBet = this.resultMappings.YES.includes(betSelection);

    const isWinning = isYesBet ? bothTeamsScored1stHalf : !bothTeamsScored1stHalf;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      bothTeamsScored1stHalf: bothTeamsScored1stHalf,
      firstHalfHomeScore: firstHalfScores.homeScore,
      firstHalfAwayScore: firstHalfScores.awayScore,
      betSelection: betSelection,
      reason: `Both Teams to Score in 1st Half: ${bothTeamsScored1stHalf ? "Yes" : "No"} (${firstHalfScores.homeScore}-${firstHalfScores.awayScore})`,
    };
  }

  /**
   * Calculate Both Teams to Score in 2nd Half outcome (Market 16)
   */
  calculateBothTeamsScore2ndHalf(bet, matchData) {
    const secondHalfScores = this.extractSecondHalfScores(matchData);
    
    if (!secondHalfScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Second half scores not available",
      };
    }

    // Check if both teams scored in the second half
    const bothTeamsScored2ndHalf = secondHalfScores.homeScore > 0 && secondHalfScores.awayScore > 0;

    // Get bet selection from betDetails
    const originalBetSelection = bet.betDetails?.label || bet.betDetails?.name || bet.betOption;
    const betSelection = this.normalizeBetSelection(originalBetSelection);
    const isYesBet = this.resultMappings.YES.includes(betSelection);

    const isWinning = isYesBet ? bothTeamsScored2ndHalf : !bothTeamsScored2ndHalf;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      bothTeamsScored2ndHalf: bothTeamsScored2ndHalf,
      secondHalfHomeScore: secondHalfScores.homeScore,
      secondHalfAwayScore: secondHalfScores.awayScore,
      betSelection: betSelection,
      reason: `Both Teams to Score in 2nd Half: ${bothTeamsScored2ndHalf ? "Yes" : "No"} (${secondHalfScores.homeScore}-${secondHalfScores.awayScore})`,
    };
  }

  /**
   * Calculate Both Teams to Score in 1st Half AND 2nd Half outcome
   * This is for a different market that requires both conditions
   */
  calculateBothTeamsScore1stHalf2ndHalf(bet, matchData) {
    const firstHalfScores = this.extractFirstHalfScores(matchData);
    const secondHalfScores = this.extractSecondHalfScores(matchData);
    
    if (!firstHalfScores || !secondHalfScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Half-time scores not available",
      };
    }

    const bothTeamsScored1stHalf = firstHalfScores.homeScore > 0 && firstHalfScores.awayScore > 0;
    const bothTeamsScored2ndHalf = secondHalfScores.homeScore > 0 && secondHalfScores.awayScore > 0;
    
    // Both conditions must be true
    const isWinning = bothTeamsScored1stHalf && bothTeamsScored2ndHalf;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      bothTeamsScored1stHalf: bothTeamsScored1stHalf,
      bothTeamsScored2ndHalf: bothTeamsScored2ndHalf,
      firstHalfScore: `${firstHalfScores.homeScore}-${firstHalfScores.awayScore}`,
      secondHalfScore: `${secondHalfScores.homeScore}-${secondHalfScores.awayScore}`,
      reason: `Both Teams to Score in 1st AND 2nd Half: 1st(${bothTeamsScored1stHalf ? "Yes" : "No"}) 2nd(${bothTeamsScored2ndHalf ? "Yes" : "No"})`,
    };
  }
  /**
   * Extract second half scores from match data
   */
  extractSecondHalfScores(matchData) {
    if (matchData.scores && Array.isArray(matchData.scores)) {
      let homeScore = 0;
      let awayScore = 0;

      // Only sum 2ND_HALF_ONLY goals
      const secondHalfOnlyScores = matchData.scores.filter(
        (score) => score.description === "2ND_HALF_ONLY"
      );
      secondHalfOnlyScores.forEach((score) => {
        if (score.score && score.score.goals !== undefined) {
          if (score.score.participant === "home") {
            homeScore += score.score.goals;
          } else if (score.score.participant === "away") {
            awayScore += score.score.goals;
          }
        }
      });

      return { homeScore, awayScore };
    }
    return { homeScore: 0, awayScore: 0 };
  }

  /**
   * Extract market ID from odd ID using match data
   */
  extractMarketIdFromOdd(oddId, matchData) {
    if (matchData.odds && Array.isArray(matchData.odds)) {
      const odd = matchData.odds.find((o) => o.id == oddId);
      return odd ? odd.market_id : null;
    }
    return null;
  }

  /**
   * Find the selected odd in match data
   */
  findSelectedOdd(bet, matchData) {
    console.log(`[findSelectedOdd] Looking for odd ID: ${bet.oddId}`);
    console.log(`[findSelectedOdd] Bet is inplay: ${bet.inplay}`);

    // For inplay bets, we might not find the exact odd ID in final match data
    // because live odds can have different IDs than post-match odds
    // In this case, we should use the bet details to calculate the outcome directly

    // Handle standard matchData.odds format
    if (matchData.odds && Array.isArray(matchData.odds)) {
      console.log(
        `[findSelectedOdd] Searching in matchData.odds (${matchData.odds.length} odds)`
      );
      const found = matchData.odds.find((odd) => odd.id == (bet.oddId));
      if (found) {
        console.log(`[findSelectedOdd] Found odd in matchData.odds:`, found);
        return found;
      }
    }
    console.log(`[findSelectedOdd] Odd not found anywhere in match data`);
    return null;
  }

  /**
   * Normalize bet selection for comparison
   */
  normalizeBetSelection(selection) {
    if (!selection) return "";
    const normalized = selection.toString().toLowerCase().trim();

    if (this.resultMappings.HOME_WIN.includes(normalized)) return "HOME_WIN";
    if (this.resultMappings.DRAW.includes(normalized)) return "DRAW";
    if (this.resultMappings.AWAY_WIN.includes(normalized)) return "AWAY_WIN";
    if (this.resultMappings.YES.includes(normalized)) return "YES";
    if (this.resultMappings.NO.includes(normalized)) return "NO";
    if (this.resultMappings.OVER.includes(normalized)) return "OVER";
    if (this.resultMappings.UNDER.includes(normalized)) return "UNDER";

    return normalized;
  }

  /**
   * Check if result matches bet selection
   */
  isResultMatch(betSelection, actualResult) {
    return betSelection === actualResult;
  }

  /**
   * Enhanced threshold extraction for complex bet options
   */
  extractThreshold(betOption) {
    // Handle various threshold formats
    const thresholdPatterns = [
      /(\d+\.?\d*)\+/, // e.g., "2.5+"
      /over\s*(\d+\.?\d*)/i, // e.g., "Over 2.5"
      /under\s*(\d+\.?\d*)/i, // e.g., "Under 2.5"
      /(\d+\.?\d*)\s*goals?/i, // e.g., "2.5 goals"
      /(\d+\.?\d*)/, // Generic number
    ];

    for (const pattern of thresholdPatterns) {
      const match = betOption.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return 2.5; // Default threshold
  }

  /**
   * Enhanced handicap extraction
   */
  extractHandicap(betOption) {
    const handicapPatterns = [
      /([-+]?\d+\.?\d*)\s*ah/i, // Asian Handicap format
      /([-+]?\d+\.?\d*)\s*handicap/i,
      /\(([+-]?\d+\.?\d*)\)/, // Handicap in parentheses
      /([-+]?\d+\.?\d*)/, // Generic signed number
    ];

    for (const pattern of handicapPatterns) {
      const match = betOption.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }

    return 0;
  }

  /**
   * Enhanced team extraction from bet options
   */
  extractTeam(betOption) {
    const normalized = betOption.toLowerCase();

    if (
      normalized.includes("home") ||
      (normalized.includes("1") && !normalized.includes("12"))
    ) {
      return "HOME";
    }
    if (
      normalized.includes("away") ||
      (normalized.includes("2") && !normalized.includes("12"))
    ) {
      return "AWAY";
    }
    if (normalized.includes("both") || normalized.includes("either")) {
      return "BOTH";
    }

    return "UNKNOWN";
  }

  /**
   * Enhanced validation for complex bet structures
   */
  validateComplexBet(bet, matchData) {
    // Validate required fields based on market type
    const marketType = this.getMarketType(bet.marketId);

    const validationRules = {
      ASIAN_HANDICAP: ["handicap"],
      OVER_UNDER: ["threshold"],
      PLAYER_GOALS: ["playerName"],
      CORRECT_SCORE: ["scoreFormat"],
    };

    const requiredFields = validationRules[marketType];
    if (requiredFields) {
      for (const field of requiredFields) {
        if (!this.validateBetField(bet, field)) {
          return {
            isValid: false,
            reason: `Missing or invalid ${field} for ${marketType} market`,
          };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Validate specific bet field
   */
  validateBetField(bet, fieldType) {
    switch (fieldType) {
      case "handicap":
        return bet.betOption && /[-+]?\d+\.?\d*/.test(bet.betOption);
      case "threshold":
        return bet.betOption && /\d+\.?\d*/.test(bet.betOption);
      case "playerName":
        return bet.betOption && bet.betOption.length > 0;
      case "scoreFormat":
        return bet.betOption && /\d+[-:]\d+/.test(bet.betOption);
      default:
        return true;
    }
  }

  /**
   * Batch calculate outcomes for multiple bets
   */
  async calculateBatchOutcomes(bets, matchDataMap) {
    const results = [];

    for (const bet of bets) {
      try {
        const matchData = matchDataMap[bet.matchId];
        if (matchData) {
          const outcome = await this.calculateBetOutcome(bet, matchData);
          results.push(outcome);
        } else {
          results.push({
            betId: bet._id,
            status: "error",
            reason: "Match data not available",
            payout: 0,
          });
        }
      } catch (error) {
        results.push({
          betId: bet._id,
          status: "error",
          reason: error.message,
          payout: 0,
        });
      }
    }

    return results;
  }

  /**
   * Calculate outcome for unknown or generic market types using winning field
   */
  calculateGenericOutcome(bet, matchData) {
    // For unknown market types, try to use the winning field from odds
    const selectedOdd = this.findSelectedOdd(bet, matchData);

    if (!selectedOdd) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Odd not found in match data",
      };
    }

    // If winning field is available, use it
    if (selectedOdd.hasOwnProperty("winning")) {
      const isWinning = selectedOdd.winning === true;
      return {
        status: isWinning ? "won" : "lost",
        payout: isWinning ? bet.stake * bet.odds : 0,
        reason: `Generic calculation using winning field: ${
          isWinning ? "Won" : "Lost"
        }`,
        winningField: selectedOdd.winning,
      };
    }

    // If no winning field, return canceled with refund
    return {
      status: "canceled",
      payout: bet.stake,
      reason: "Unable to calculate outcome for this market type",
    };
  }

  /**
   * Calculate outcome for Result/Total Goals (market_id: 37)
   * This market combines match result (home/draw/away) and total goals (over/under)
   * betDetails.name: "1" | "2" | "Draw" (result)
   * betDetails.label: "Over" | "Under" (goals)
   * betDetails.total: number (threshold, e.g. 2.5)
   */
  calculateResultTotalGoals(bet, matchData) {
    // Extract scores
    const scores = this.extractMatchScores(matchData);
    const { homeScore, awayScore } = scores;
    const totalGoals = homeScore + awayScore;

    // Determine actual result
    let actualResult;
    if (homeScore > awayScore) actualResult = "1";
    else if (homeScore < awayScore) actualResult = "2";
    else actualResult = "Draw";

    // Determine actual over/under
    const threshold = bet.betDetails?.total;
    const actualOU = totalGoals > threshold ? "Over" : "Under";

    // Compare with bet
    const betResult = bet.betDetails?.name;
    const betOU = bet.betDetails?.label;

    const isWinning = betResult === actualResult && betOU === actualOU;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualResult,
      actualOU,
      threshold,
      totalGoals,
      betResult,
      betOU,
      reason: `Result: ${actualResult}, Goals: ${totalGoals} (${actualOU}), Bet: ${betResult} & ${betOU}`,
    };
  }

  /**
   * Check if match is finished
   */
  isMatchFinished(matchData) {
    if (!matchData || !matchData.state) {
      console.log(`[isMatchFinished] No match data or state available`);
      return false;
    }

    console.log(`[isMatchFinished] Checking match state:`, {
      id: matchData.state.id,
      name: matchData.state.name,
    });

    // Check by state ID first (more reliable)
    if (matchData.state.id === 5) {
      console.log(`[isMatchFinished] Match finished - state ID is 5`);
      return true;
    }

    // Fallback to state name checking
    const matchState = matchData.state.name?.toLowerCase();
    const finishedStates = [
      "finished",
      "ended",
      "ft",
      "fulltime",
      "full time", // Add "full time" with space
      "completed",
      "closed",
    ];

    const isFinished = finishedStates.includes(matchState);
    console.log(
      `[isMatchFinished] State name check - matchState: "${matchState}", isFinished: ${isFinished}`
    );

    return isFinished;
  }

  /**
   * Helper methods for extracting bet option components
   */
  extractOverUnderType(betOption) {
    const normalized = betOption.toLowerCase();
    if (normalized.includes("over")) return "OVER";
    if (normalized.includes("under")) return "UNDER";
    return "EXACT";
  }

  extractHandicapTeam(betOption) {
    const normalized = betOption.toLowerCase();
    if (normalized.includes("home") || normalized.includes("1")) return "HOME";
    if (normalized.includes("away") || normalized.includes("2")) return "AWAY";
    return "UNKNOWN";
  }

  normalizeScoreFormat(betOption) {
    // Convert various score formats to "X-Y" format
    return betOption.replace(/[^\d-]/g, "").replace(/:/g, "-");
  }

  /**
   * Calculate outcome for Second Half Result (market_id: 97)
   * This market determines the winner based only on goals scored in the second half
   * betDetails.label and betDetails.name contain: "Home", "Draw", "Away"
   */
  calculateSecondHalfResult(bet, matchData) {
    // Extract second half scores only
    const secondHalfScores = this.extractSecondHalfScores(matchData);

    if (!secondHalfScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Second half scores not available",
      };
    }

    const { homeScore, awayScore } = secondHalfScores;

    // Determine actual second half result
    let actualResult;
    if (homeScore > awayScore) {
      actualResult = "Home";
    } else if (homeScore < awayScore) {
      actualResult = "Away";
    } else {
      actualResult = "Draw";
    }

    // Get bet selection from betDetails (prefer betDetails.label, fallback to betDetails.name)
    const betSelection =
      bet.betDetails?.label ||
      bet.betDetails?.name ||
      bet.betOption ||
      bet.selection ||
      "";

    // Check if the bet selection matches the actual second half result
    const isWinning = actualResult === betSelection;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualResult: actualResult,
      betSelection: betSelection,
      secondHalfHomeScore: homeScore,
      secondHalfAwayScore: awayScore,
      reason: `Second Half Result: ${actualResult}, Bet: ${betSelection}`,
    };
  }

  /**
   * Calculate outcome for Half Time Result / Total Goals (market_id: 123)
   * This market combines half-time result with total goals over/under
   * betDetails.label contains combinations like: "Home/Over", "Away/Under", "Draw/Over", etc.
   * betDetails.name contains the threshold value (e.g., "1.5", "2.5")
   */
  calculateHalfTimeResultTotalGoals(bet, matchData) {
    // Extract half-time scores
    const halfTimeScores = this.extractHalfTimeScores(matchData);
    if (!halfTimeScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Half-time scores not available",
      };
    }

    // Extract full match scores for total goals
    const fullMatchScores = this.extractMatchScores(matchData);
    const totalGoals = fullMatchScores.homeScore + fullMatchScores.awayScore;

    // Determine actual half-time result
    let actualHalfTimeResult;
    if (halfTimeScores.homeScore > halfTimeScores.awayScore) {
      actualHalfTimeResult = "Home";
    } else if (halfTimeScores.homeScore < halfTimeScores.awayScore) {
      actualHalfTimeResult = "Away";
    } else {
      actualHalfTimeResult = "Draw";
    }

    // Get threshold from betDetails.name and parse bet selection from betDetails.label
    const threshold = parseFloat(bet.betDetails?.name);
    const betSelection =
      bet.betDetails?.label || bet.betOption || bet.selection || "";

    // Split the bet selection (e.g., "DC United/Under" -> ["DC United", "Under"])
    const betParts = betSelection.split("/");

    if (betParts.length !== 2) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Invalid bet format for Half Time Result / Total Goals",
      };
    }

    const betHalfTimeResult = betParts[0].trim();
    const betTotalGoals = betParts[1].trim();

    // Determine actual over/under for total goals
    const actualTotalGoals = totalGoals > threshold ? "Over" : "Under";

    // Map team names to standard format
    // Get team names from match data
    const homeTeam = matchData.participants?.[0]?.name || "Home";
    const awayTeam = matchData.participants?.[1]?.name || "Away";

    // Normalize bet half-time result to match actual result format
    let normalizedBetHalfTimeResult;
    if (betHalfTimeResult.toLowerCase() === "draw") {
      normalizedBetHalfTimeResult = "Draw";
    } else if (betHalfTimeResult.toLowerCase() === homeTeam.toLowerCase()) {
      normalizedBetHalfTimeResult = "Home";
    } else if (betHalfTimeResult.toLowerCase() === awayTeam.toLowerCase()) {
      normalizedBetHalfTimeResult = "Away";
    } else {
      normalizedBetHalfTimeResult = betHalfTimeResult;
    }

    // Check if both half-time result and total goals match
    const halfTimeMatch = actualHalfTimeResult === normalizedBetHalfTimeResult;
    const totalGoalsMatch = actualTotalGoals === betTotalGoals;
    const isWinning = halfTimeMatch && totalGoalsMatch;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualHalfTimeResult: actualHalfTimeResult,
      actualTotalGoals: actualTotalGoals,
      betHalfTimeResult: normalizedBetHalfTimeResult,
      reason: `Half Time: ${actualHalfTimeResult}, Total Goals: ${totalGoals} (${actualTotalGoals}), Bet: ${normalizedBetHalfTimeResult}/${betTotalGoals}`,
    };
  }

  /**
   * Extract corner statistics from match data
   * Uses statistics array with type_id: 34 for corners
   */
  extractCornerStats(matchData) {
    if (!matchData.statistics || !Array.isArray(matchData.statistics)) {
      return { homeCorners: 0, awayCorners: 0, totalCorners: 0 };
    }

    // Filter statistics to get only corners (type_id: 34)
    const cornerStats = matchData.statistics.filter(
      (stat) => stat.type_id === this.typeIdMapping.corners
    );

    let homeCorners = 0;
    let awayCorners = 0;

    cornerStats.forEach((stat) => {
      if (stat.data && stat.data.value !== undefined) {
        if (stat.location === "home") {
          homeCorners = stat.data.value;
        } else if (stat.location === "away") {
          awayCorners = stat.data.value;
        }
      }
    });

    return {
      homeCorners: homeCorners,
      awayCorners: awayCorners,
      totalCorners: homeCorners + awayCorners,
    };
  }

  /**
   * Calculate Corners Over/Under outcome (Markets 60, 68, 69)
   */
  calculateCornersOverUnder(bet, cornerStats) {
    const marketId = parseInt(bet.betDetails?.market_id || bet.marketId);

    // Handle different market types
    if (marketId === 68) {
      // Market 68: Total Corners - handle both range bets and Over/Under bets
      const betLabel =
        bet.betDetails?.label || bet.betDetails?.name || bet.betOption || "";

      // Check if it's a range bet (e.g., "6 - 8", "10-14")
      if (betLabel.match(/\d+\s*-\s*\d+/)) {
        return this.calculateCornersRange(bet, cornerStats);
      }

      // Check if it's an Over/Under bet (e.g., "Over 14", "Under 10.5")
      if (betLabel.match(/over|under/i)) {
        // Extract threshold from label (e.g., "Over 14" -> 14)
        const thresholdMatch = betLabel.match(
          /(?:over|under)\s+(\d+(?:\.\d+)?)/i
        );
        if (!thresholdMatch) {
          return {
            status: "canceled",
            payout: bet.stake,
            reason: "Unable to parse Over/Under threshold from bet label",
          };
        }

        const threshold = parseFloat(thresholdMatch[1]);
        const betType = betLabel.toLowerCase().includes("over")
          ? "OVER"
          : "UNDER";

        let isWinning;
        if (betType === "OVER") {
          isWinning = cornerStats.totalCorners > threshold;
        } else {
          isWinning = cornerStats.totalCorners < threshold;
        }

        console.log(
          `[calculateCornersOverUnder] Market 68 Over/Under: ${betType} ${threshold}, actual: ${cornerStats.totalCorners}, winning: ${isWinning}`
        );

        return {
          status: isWinning ? "won" : "lost",
          payout: isWinning ? bet.stake * bet.odds : 0,
          actualCorners: cornerStats.totalCorners,
          homeCorners: cornerStats.homeCorners,
          awayCorners: cornerStats.awayCorners,
          threshold: threshold,
          betType: betType,
          marketId: marketId,
          betLabel: betLabel,
          reason: `Total corners: ${
            cornerStats.totalCorners
          }, ${betType} ${threshold}: ${isWinning ? "Won" : "Lost"}`,
        };
      }

      // Fallback to range calculation if neither pattern is found
      return this.calculateCornersRange(bet, cornerStats);
    }

    if (marketId === 69) {
      // Market 69: Alternative Corners - handle exact bets
      const betLabel =
        bet.betDetails?.label?.toLowerCase() ||
        bet.betOption?.toLowerCase() ||
        "";
      if (betLabel.includes("exactly")) {
        return this.calculateCornersExact(bet, cornerStats);
      }
    }

    // Standard Over/Under logic for markets 60, 67, and other Over/Under variants
    let threshold;
    let betType;

    if (bet.betDetails) {
      // For corner markets, use betDetails.total for threshold if available
      if (bet.betDetails.total !== null && bet.betDetails.total !== undefined) {
        threshold = parseFloat(bet.betDetails.total);
      } else {
        // Extract from name field (e.g., "9.5", "10")
        threshold =
          parseFloat(bet.betDetails.name) ||
          this.extractThreshold(bet.betDetails.label || bet.betOption);
      }

      // Extract bet type from label (Over/Under)
      betType = this.extractOverUnderType(
        bet.betDetails.label || bet.betDetails.name || bet.betOption
      );
    } else {
      // Fallback to original logic
      threshold = this.extractThreshold(bet.betOption);
      betType = this.extractOverUnderType(bet.betOption);
    }

    let isWinning;
    if (betType === "OVER") {
      isWinning = cornerStats.totalCorners > threshold;
    } else if (betType === "UNDER") {
      isWinning = cornerStats.totalCorners < threshold;
    } else {
      // Handle exact corners
      isWinning = cornerStats.totalCorners === threshold;
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualCorners: cornerStats.totalCorners,
      homeCorners: cornerStats.homeCorners,
      awayCorners: cornerStats.awayCorners,
      threshold: threshold,
      betType: betType,
      marketId: marketId,
      reason: `Total corners: ${cornerStats.totalCorners}, Threshold: ${threshold} (${betType})`,
    };
  }

  /**
   * Calculate Corners Range outcome (Market 68 - Total Corners)
   * Handles range bets like "6 - 8", "9 - 11", etc.
   */
  calculateCornersRange(bet, cornerStats) {
    const rangeString =
      bet.betDetails?.label || bet.betDetails?.name || bet.betOption || "";

    // Parse range from string like "6 - 8"
    const rangeMatch = rangeString.match(/(\d+)\s*-\s*(\d+)/);

    if (!rangeMatch) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Unable to parse corner range from bet option",
      };
    }

    const minCorners = parseInt(rangeMatch[1]);
    const maxCorners = parseInt(rangeMatch[2]);

    // Check if actual corners fall within the range (inclusive)
    const isWinning =
      cornerStats.totalCorners >= minCorners &&
      cornerStats.totalCorners <= maxCorners;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualCorners: cornerStats.totalCorners,
      homeCorners: cornerStats.homeCorners,
      awayCorners: cornerStats.awayCorners,
      minCorners: minCorners,
      maxCorners: maxCorners,
      rangeString: rangeString,
      marketId: 68,
      reason: `Total corners: ${cornerStats.totalCorners}, Range: ${minCorners}-${maxCorners}`,
    };
  }

  /**
   * Calculate Corners Exact outcome (Market 69 - Alternative Corners)
   * Handles exact bets like "Exactly 12"
   */
  calculateCornersExact(bet, cornerStats) {
    // Extract exact number from betDetails.name or betDetails.total
    let exactCorners;

    if (bet.betDetails?.total !== null && bet.betDetails?.total !== undefined) {
      exactCorners = parseInt(bet.betDetails.total);
    } else if (bet.betDetails?.name) {
      exactCorners = parseInt(bet.betDetails.name);
    } else {
      // Try to extract from betOption
      const numberMatch = (bet.betOption || "").match(/(\d+)/);
      exactCorners = numberMatch ? parseInt(numberMatch[1]) : 0;
    }

    // Check if actual corners match exactly
    const isWinning = cornerStats.totalCorners === exactCorners;

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      actualCorners: cornerStats.totalCorners,
      homeCorners: cornerStats.homeCorners,
      awayCorners: cornerStats.awayCorners,
      exactCorners: exactCorners,
      marketId: 69,
      reason: `Total corners: ${cornerStats.totalCorners}, Expected exactly: ${exactCorners}`,
    };
  }

  /**
   * Calculate Team Corners outcome (Market 67)
   */
  calculateTeamCorners(bet, cornerStats) {
    // Market 67 is actually total corners Over/Under, not team-specific
    // The bet data shows it's "Over 10" for total corners, not individual team corners
    const marketId = parseInt(bet.betDetails?.market_id || bet.marketId);

    if (marketId === 67) {
      // This is actually total corners Over/Under, similar to other markets
      let threshold;
      let betType;

      if (bet.betDetails) {
        // Use betDetails.total for threshold if available
        if (
          bet.betDetails.total !== null &&
          bet.betDetails.total !== undefined
        ) {
          threshold = parseFloat(bet.betDetails.total);
        } else if (bet.betDetails.name) {
          // Extract from name field (e.g., "10")
          threshold = parseFloat(bet.betDetails.name);
        } else {
          threshold = this.extractThreshold(
            bet.betDetails.label || bet.betOption
          );
        }

        // Extract bet type from label (Over/Under)
        betType = this.extractOverUnderType(
          bet.betDetails.label || bet.betOption
        );
      } else {
        // Fallback to original logic
        threshold = this.extractThreshold(bet.betOption);
        betType = this.extractOverUnderType(bet.betOption);
      }

      let isWinning;
      if (betType === "OVER") {
        isWinning = cornerStats.totalCorners > threshold;
      } else if (betType === "UNDER") {
        isWinning = cornerStats.totalCorners < threshold;
      } else {
        // Exact match
        isWinning = cornerStats.totalCorners === threshold;
      }

      return {
        status: isWinning ? "won" : "lost",
        payout: isWinning ? bet.stake * bet.odds : 0,
        actualCorners: cornerStats.totalCorners,
        homeCorners: cornerStats.homeCorners,
        awayCorners: cornerStats.awayCorners,
        threshold: threshold,
        betType: betType,
        marketId: marketId,
        reason: `Total corners: ${cornerStats.totalCorners}, Threshold: ${threshold} (${betType})`,
      };
    }

    // Original team-specific logic for other corner markets
    const betOption = bet.betOption?.toLowerCase() || "";
    const betLabel = bet.betDetails?.label?.toLowerCase() || "";

    let teamCorners;
    let teamName = "";

    // Check if it's for home team (1) or away team (2)
    if (betLabel === "1" || betOption.includes("home")) {
      teamCorners = cornerStats.homeCorners;
      teamName = "Home";
    } else if (betLabel === "2" || betOption.includes("away")) {
      teamCorners = cornerStats.awayCorners;
      teamName = "Away";
    } else {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "Unable to determine team for corner bet",
      };
    }

    // For team corner bets, could be Over/Under or exact
    const threshold = this.extractThreshold(
      bet.betOption || bet.betDetails?.name || "0.5"
    );
    const betType = this.extractOverUnderType(
      bet.betOption || bet.betDetails?.name || "over"
    );

    let isWinning;
    if (betType === "OVER") {
      isWinning = teamCorners > threshold;
    } else if (betType === "UNDER") {
      isWinning = teamCorners < threshold;
    } else {
      // Exact match
      isWinning = teamCorners === threshold;
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      teamCorners: teamCorners,
      teamName: teamName,
      totalCorners: cornerStats.totalCorners,
      homeCorners: cornerStats.homeCorners,
      awayCorners: cornerStats.awayCorners,
      threshold: threshold,
      betType: betType,
      reason: `${teamName} corners: ${teamCorners}, Threshold: ${threshold} (${betType})`,
    };
  }

  /**
   * Calculate Half-Specific Goals outcome (Market 28: 1st Half Goals, Market 53: 2nd Half Goals)
   * This handles Over/Under bets for goals scored in a specific half
   */
  calculateHalfSpecificGoals(bet, matchData) {
    const marketId = parseInt(bet.betDetails?.market_id);
    
    // Determine which half to calculate for
    let halfScores;
    let halfName;
    
    if (marketId === 28) {
      // 1st Half Goals
      halfScores = this.extractFirstHalfScores(matchData);
      halfName = "1st Half";
    } else if (marketId === 53) {
      // 2nd Half Goals
      halfScores = this.extractSecondHalfScores(matchData);
      halfName = "2nd Half";
    } else {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: `Unsupported market ID for half-specific goals: ${marketId}`,
      };
    }

    if (!halfScores) {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: `${halfName} scores not available`,
      };
    }

    // Calculate total goals for the specific half
    const totalGoals = halfScores.homeScore + halfScores.awayScore;

    // Extract threshold and bet type directly from betDetails
    let threshold;
    let betType;

    if (bet.betDetails) {
      threshold = parseFloat(bet.betDetails.name); // e.g., "1.5", "0.5"
      betType = this.normalizeBetSelection(bet.betDetails.label); // e.g., "Under", "Over"
    } else {
      return {
        status: "canceled",
        payout: bet.stake,
        reason: "betDetails not available for half-specific goals calculation",
      };
    }

    // Determine if bet is winning
    let isWinning;
    if (betType === "OVER") {
      isWinning = totalGoals > threshold;
    } else if (betType === "UNDER") {
      isWinning = totalGoals < threshold;
    } else {
      // Exact match (though unlikely for half goals)
      isWinning = totalGoals === threshold;
    }

    return {
      status: isWinning ? "won" : "lost",
      payout: isWinning ? bet.stake * bet.odds : 0,
      totalGoals: totalGoals,
      homeGoals: halfScores.homeScore,
      awayGoals: halfScores.awayScore,
      threshold: threshold,
      betType: betType,
      halfName: halfName,
      marketId: marketId,
      reason: `${halfName} goals: ${totalGoals} (${halfScores.homeScore}-${halfScores.awayScore}), Threshold: ${threshold} (${betType})`,
    };
  }
}



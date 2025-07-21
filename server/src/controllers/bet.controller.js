import BetService from "../services/bet.service.js";
import { CustomError } from "../utils/customErrors.js";
import FixtureOptimizationService from "../services/fixture.service.js";

class BetController {
  async placeBet(req, res, next) {
    console.log("Placing bet with data:", req.body);
    try {
      const { matchId, oddId, stake, betOption } = req.body;
      const userId = req.user._id; 

      // Validate inputs
      if (!matchId || !oddId || !stake || !betOption) {
        throw new CustomError(
          "Missing required fields: matchId, oddId, stake, betOption",
          400,
          "INVALID_INPUT"
        );
      }
      if (isNaN(stake) || stake <= 0) {
        throw new CustomError(
          "Stake must be a positive number",
          400,
          "INVALID_STAKE"
        );
      }

      // Check if the match is live
      const isLive = FixtureOptimizationService.liveFixturesService.isMatchLive(matchId);
      console.log(`Match ${matchId} is live: ${isLive}`);

      const result = await BetService.placeBet(userId, matchId, oddId, stake, betOption, isLive);
      res.status(201).json({
        success: true,
        bet: result.bet,
        user: result.user,
        message: "Bet placed successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async checkBetOutcome(req, res, next) {
    try {
      const { betId } = req.params;

      // Validate betId
      if (!betId || !mongoose.isValidObjectId(betId)) {
        throw new CustomError("Invalid bet ID", 400, "INVALID_BET_ID");
      }

      const result = await BetService.checkBetOutcome(betId);
      res.status(200).json({
        success: true,
        data: result,
        message: "Bet outcome checked",
      });
    } catch (error) {
      next(error);
    }
  }

  async checkPendingBets(req, res, next) {
    try {
      const results = await BetService.checkPendingBets();
      res.status(200).json({
        success: true,
        data: results,
        message: "Pending bets processed",
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserBets(req, res, next) {
    try {
      const userId = req.user._id;
      const bets = await BetService.getUserBets(userId);
      console.log(`Fetched bets for user ${userId}:`, bets);
      
      res.status(200).json({
        success: true,
        data: bets,
        message: "Fetched user bets successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllBets(req, res, next) {
    try {
      const groupedBets = await BetService.getAllBets();
      res.status(200).json({
        success: true,
        data: groupedBets,
        message: "Fetched all bets grouped by user successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async getBetsByUserId(req, res, next) {
    try {
      const { userId } = req.params;
      console.log(`[BetController.getBetsByUserId] Requesting bets for user ID: ${userId}`);
      
      const bets = await BetService.getBetsByUserId(userId);
      console.log(`[BetController.getBetsByUserId] Fetched ${bets.length} bets for user ${userId}`);
      
      res.status(200).json({
        success: true,
        data: bets,
        message: "Fetched user bets successfully",
      });
    } catch (error) {
      console.error(`[BetController.getBetsByUserId] Error:`, error);
      next(error);
    }
  }
}

export default new BetController();


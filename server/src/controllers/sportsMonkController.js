import sportsMonksService from "../services/SportsMonks.service.js";
import { asyncHandler } from "../utils/customErrors.js";

export const getLeagues = asyncHandler(async (req, res) => {
  const leagues = await sportsMonksService.getLeagues();
  res.status(200).json({
    success: true,
    message: "Leagues fetched successfully",
    data: leagues,
    timestamp: new Date().toISOString(),
  });
});

export const getMatches = asyncHandler(async (req, res) => {
  const { leagueId } = req.params;
  const matches = await sportsMonksService.getMatches(leagueId);
  res.status(200).json({
    success: true,
    message: "Matches fetched successfully",
    data: matches,
    timestamp: new Date().toISOString(),
  });
});

export const getMarkets = asyncHandler(async (req, res) => {
  const { matchId } = req.params;
  const markets = await sportsMonksService.getMarkets(matchId);
  res.status(200).json({
    success: true,
    message: "Markets fetched successfully",
    data: markets,
    timestamp: new Date().toISOString(),
  });
});

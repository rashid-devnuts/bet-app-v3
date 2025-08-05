import { asyncHandler } from "../utils/customErrors.js";

// Helper function to get services with proper error handling
function getServices() {
  console.log('[Controller] Accessing global services...');

  if (!global.fixtureOptimizationService) {
    console.error('[Controller] ERROR: global.fixtureOptimizationService is undefined!');
    throw new Error('FixtureOptimizationService not initialized');
  }

  if (!global.liveFixturesService) {
    console.error('[Controller] ERROR: global.liveFixturesService is undefined!');
    throw new Error('LiveFixturesService not initialized');
  }

  console.log('[Controller] global.fixtureOptimizationService:', typeof global.fixtureOptimizationService);
  console.log('[Controller] global.liveFixturesService:', typeof global.liveFixturesService);

  return {
    fixtureOptimizationService: global.fixtureOptimizationService,
    liveFixturesService: global.liveFixturesService
  };
}

console.log('[Controller] Module loaded successfully');

// Get optimized fixtures with pagination and filtering

export const getOptimizedFixtures = asyncHandler(async (req, res) => {
  const { fixtureOptimizationService } = getServices();
  
  const {
    page = 1,
    limit = 50,
    leagues,
    dateFrom,
    dateTo,
    states,
    includeOdds = "true",
    priority,
  } = req.query;

  // Default dateFrom = today, dateTo = 20 days later if not provided
  let _dateFrom = dateFrom;
  let _dateTo = dateTo;
  if (!dateFrom || !dateTo) {
    const today = new Date();
    _dateFrom = today.toISOString().split("T")[0];
    const future = new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000);
    _dateTo = future.toISOString().split("T")[0];
  }

  // Parse query parameters
  const options = {
    page: parseInt(page),
    leagues: leagues ? leagues.split(",").map((id) => parseInt(id)) : [],
    dateFrom: _dateFrom,
    dateTo: _dateTo,
    states: states ? states.split(",").map((id) => parseInt(id)) : [1],
    includeOdds: true,
    priority,
    per_page:50
  };

  const fixtures = await fixtureOptimizationService.getOptimizedFixtures();

  res.status(200).json({
    success: true,
    message: "Optimized fixtures fetched successfully",
    data: fixtures,
    pagination: {
      page: options.page,
      limit: options.limit,
      total: fixtures.length,
    },
    filters: {
      leagues: options.leagues,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      states: options.states,
      includeOdds: options.includeOdds,
      priority: options.priority,
    },
    cached: true, // Will be false if data is fresh from API
    timestamp: new Date().toISOString(),
  });
});

// Get today's fixtures (optimized for homepage)
export const getTodaysFixtures = asyncHandler(async (req, res) => {
  const { fixtureOptimizationService } = getServices();
  
  const { leagues } = req.query;
  const leagueIds = leagues ? leagues.split(",").map((id) => parseInt(id)) : [];

  const fixtures = await fixtureOptimizationService.getTodaysFixtures(
    leagueIds
  );
  res.status(200).json({
    success: true,
    message: "Today's fixtures fetched successfully",
    data: fixtures,
    count: fixtures.length,
    timestamp: new Date().toISOString(),
  });
});

// Get upcoming fixtures
export const getUpcomingFixtures = asyncHandler(async (req, res) => {
  const { fixtureOptimizationService } = getServices();
  
  const fixtures = await fixtureOptimizationService.getUpcomingFixtures();

  res.status(200).json({
    success: true,
    message: "Upcoming fixtures fetched successfully",
    data: fixtures,
    count: fixtures.length,

    timestamp: new Date().toISOString(),
  });
});

// Get popular leagues (cached)
export const getPopularLeagues = asyncHandler(async (req, res) => {
  const { fixtureOptimizationService } = getServices();
  
  const { limit = 10 } = req.query;
  const parsedLimit = Math.min(parseInt(limit), 25); // Max 25 leagues

  const leagues = await fixtureOptimizationService.getPopularLeagues(
    parsedLimit
  );

  res.status(200).json({
    success: true,
    message: "Popular leagues fetched successfully",
    data: leagues,
    count: leagues.length,
    requested_limit: parsedLimit,
    timestamp: new Date().toISOString(),
  });
});

// Get homepage data (optimized for homepage display)
export const getHomepageFixtures = asyncHandler(async (req, res) => {
  const { fixtureOptimizationService } = getServices();
  
  // Check cache first
  const cacheKey = "homepage_data";
  const cached = fixtureOptimizationService.fixtureCache.get(cacheKey);
  
  let homepageData;
  let isFromCache = false;
  
  if (cached) {
    console.log("📦 Serving homepage data from cache");
    homepageData = cached;
    isFromCache = true;
  } else {
    console.log("🔄 No cache found, fetching fresh homepage data");
    homepageData = await fixtureOptimizationService.getHomepageData();
    isFromCache = false;
  }

  res.status(200).json({
    success: true,
    message: "Homepage fixtures fetched successfully",
    data: {
      top_picks: homepageData.top_picks || [],
      football_daily: homepageData.football_daily || [],
      // in_play: homepageData.in_play || [], //TODO: Skip for now
    },
    stats: {
      top_picks_count: homepageData.top_picks?.length || 0,
      football_daily_leagues: homepageData.football_daily?.length || 0,
      total_daily_matches:
        homepageData.football_daily?.reduce(
          (sum, league) => sum + league.match_count,
          0
        ) || 0,
    },
    cache_info: {
      cached: isFromCache,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    },
    timestamp: new Date().toISOString(),
  });
});

// Get specific match by ID with all details
export const getMatchById = asyncHandler(async (req, res) => {
  const { fixtureOptimizationService } = getServices();
  
  const { matchId } = req.params;
  const {
    includeOdds = "true",
    includeLeague = "true",
    includeParticipants = "true",
  } = req.query;

  // Validate match ID
  if (!matchId || isNaN(parseInt(matchId))) {
    return res.status(400).json({
      success: false,
      message: "Valid match ID is required",
      error: "INVALID_MATCH_ID",
    });
  }

  const options = {
    includeOdds: includeOdds === "true",
    includeLeague: includeLeague === "true",
    includeParticipants: includeParticipants === "true",
  };

  const match = await fixtureOptimizationService.getMatchById(
    parseInt(matchId),
    options
  );

  res.status(200).json({
    success: true,
    message: "Match details fetched successfully",
    data: match,
    options: {
      includeOdds: options.includeOdds,
      includeLeague: options.includeLeague,
      includeParticipants: options.includeParticipants,
    },
    stats: {
      odds_count:
        match.odds && Array.isArray(match.odds)
          ? match.odds.length
          : Object.keys(match.odds || {}).length,
      markets_count: match.odds_by_market
        ? Object.keys(match.odds_by_market).length
        : 0,
      participants_count: match.participants ? match.participants.length : 0,
      has_league_info: !!match.league,
      classification_stats: match.odds_classification?.stats || null,
      match_status: {
        isStarted: match.isStarted || false,
        starting_at: match.starting_at,
        has_prematch_odds: Object.keys(match.odds || {}).length > 0,
        note: match.isStarted ? "Use /fixtures/:id/inplay-odds for live odds" : "Pre-match odds available"
      }
    },
    timestamp: new Date().toISOString(),
  });
});

// Get matches by league ID
export const getMatchesByLeague = asyncHandler(async (req, res) => {
  const { fixtureOptimizationService } = getServices();
  
  const { leagueId } = req.params;
  const { fixtures, league } =
    await fixtureOptimizationService.getMatchesByLeague(leagueId);

  res.status(200).json({
    success: true,
    message: `Matches for league ${leagueId} fetched successfully`,
    data: fixtures,
    league: league,
    count: fixtures.length,
    timestamp: new Date().toISOString(),
  });
});

export const getLiveMatchesFromCache = async (req, res) => {
  const { liveFixturesService } = getServices();
  
  console.log("🎯 getLiveMatchesFromCache controller called");
  
  console.log("📊 Getting live matches from cache...");
  const liveMatches = await liveFixturesService.getLiveMatchesFromCache();
  
  console.log(`📊 Found ${liveMatches.length} live match groups`);
  
  // Add live odds to each match and filter out matches with no odds
  liveMatches.forEach(group => {
    group.matches = group.matches.map(match => {
      const odds = liveFixturesService.getLiveOdds(match.id);
      match.odds = liveFixturesService.extractMainOdds(odds);
      return match;
    })
    // .filter(match => {
     
    //   return match.odds && (match.odds.home || match.odds.draw || match.odds.away);
    // });
  });
  
  // Remove league groups with no matches
  const filteredLiveMatches = liveMatches.filter(group => group.matches.length > 0);
  
  // LIMIT TO ONLY ONE LIVE MATCH - API CALL OPTIMIZATION
  if (filteredLiveMatches.length > 0) {
    // Take only the first league group
    const firstLeagueGroup = filteredLiveMatches[0];
    
    // If the first league has multiple matches, take only the first match
    if (firstLeagueGroup.matches && firstLeagueGroup.matches.length > 1) {
      firstLeagueGroup.matches = [firstLeagueGroup.matches[0]];
      console.log(`📊 [API OPTIMIZATION] Limited to 1 match from ${firstLeagueGroup.matches.length + 1} matches in league ${firstLeagueGroup.league?.name || firstLeagueGroup.league?.id}`);
    }
    
    // Return only the first league group with limited matches
    const limitedLiveMatches = [firstLeagueGroup];
    console.log(`📊 [API OPTIMIZATION] Returning only 1 live match to limit API calls`);
    res.json(limitedLiveMatches);
  } else {
    res.json([]);
  }
};




// Update league popularity status (single or multiple)
export const updateLeaguePopularity = asyncHandler(async (req, res) => {
  const { fixtureOptimizationService } = getServices();
  
  const { leagues } = req.body;

  if (!leagues || !Array.isArray(leagues)) {
    return res.status(400).json({
      success: false,
      message: "Leagues array is required",
      error: "INVALID_REQUEST"
    });
  }

  try {
    const results = await fixtureOptimizationService.updateLeaguePopularity(leagues);
    
    res.status(200).json({
      success: true,
      message: "League popularity updated successfully",
      data: results,
      updated_count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating league popularity:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update league popularity",
      error: error.message
    });
  }
});

export const getAllLiveOddsMap = asyncHandler(async (req, res) => {
  const { liveFixturesService } = getServices();
  
  const oddsMap = liveFixturesService.getAllLiveOddsMap();
  res.json(oddsMap);
});




export const getInplayOdds = async (req, res, next) => {
  try {
    console.log(`[getInplayOdds] Request for match ID: ${req.params.id}`);
    
    const { liveFixturesService } = getServices();
    
    const { id } = req.params;
    console.log(`[getInplayOdds] Fetching live odds for match: ${id}`);
    
    // Check if the match is actually live before fetching odds
    const isLive = liveFixturesService.isMatchLive(id);
    console.log(`[getInplayOdds] Match ${id} is live: ${isLive}`);
    
    if (!isLive) {
      return res.status(404).json({
        success: false,
        message: "Match is not live",
        error: "MATCH_NOT_LIVE"
      });
    }
    
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 15000); // 15 second timeout
    });
    
    // Always fetch fresh odds for live matches (no caching at controller level)
    const liveOddsResult = await Promise.race([
      liveFixturesService.ensureLiveOdds(id),
      timeoutPromise
    ]);
    
    console.log(`[getInplayOdds] Successfully fetched odds for match ${id}:`, {
      hasBettingData: !!(liveOddsResult && liveOddsResult.betting_data),
      bettingDataLength: liveOddsResult?.betting_data?.length || 0,
      source: liveOddsResult?.source || 'unknown',
      timestamp: new Date().toISOString()
    });
    
    // Return both betting_data and odds_classification with timestamp
    res.json({ 
      data: {
        betting_data: liveOddsResult.betting_data || [],
        odds_classification: liveOddsResult.odds_classification || {
          categories: [{ id: "all", label: "All", odds_count: 0 }],
          classified_odds: {},
          stats: { total_categories: 0, total_odds: 0 },
        },
        fetched_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(`[getInplayOdds] Error for match ${req.params.id}:`, error);
    
    // Handle timeout errors specifically
    if (error.message === 'Request timeout') {
      return res.status(408).json({
        success: false,
        message: "Request timeout - odds fetch took too long",
        error: "REQUEST_TIMEOUT"
      });
    }
    
    next(error);
  }
};

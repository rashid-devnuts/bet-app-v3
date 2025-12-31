import express from 'express';
import axios from '../../config/axios-proxy.js';
import { filterMatchesByAllowedLeagues, getLeagueFilterStats } from '../../utils/leagueFilter.js';
const router = express.Router();

// In-memory cache for live matches
let ALL_FOOTBALL_CACHE = {
  data: null,
  lastUpdated: null,
  isRefreshing: false
};

// Cache duration: 30 seconds for live matches (to allow frequent updates)
const CACHE_DURATION = 30 * 1000; // 30 seconds in milliseconds

// Function to fetch data with retry logic
async function fetchWithRetry(url, headers, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} - Fetching live matches from Unibet API...`);
      
      const response = await axios.get(url, {
        headers,
        timeout: 12000
      });
      
      if (response.status === 200) {
        console.log(`✅ Successfully fetched data on attempt ${attempt}`);
        return response.data;
      }
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Function to refresh cache
async function refreshAllFootballCache() {
  if (ALL_FOOTBALL_CACHE.isRefreshing) {
    console.log('🔄 Cache refresh already in progress, skipping...');
    return;
  }

  ALL_FOOTBALL_CACHE.isRefreshing = true;
  
  try {
    const url = `${ALL_FOOTBALL_API_URL}?includeParticipants=true&useCombined=true&ncid=${Date.now()}`;
    const data = await fetchWithRetry(url, ALL_FOOTBALL_HEADERS);
    
    const { allMatches, liveMatches, upcomingMatches } = extractFootballMatches(data);
    
    // Fetch live odds
    console.log('🎲 Fetching live odds to enrich match data...');
    const liveOddsData = await fetchLiveOdds();
    console.log('🎲 Kambi API response:', liveOddsData ? 'Success' : 'Failed');
    
    const oddsMap = extractLiveOdds(liveOddsData);
    console.log('🎲 Extracted odds map:', Object.keys(oddsMap).length, 'matches');
    
    // Merge live odds with live matches
    const enrichedLiveMatches = mergeLiveOddsWithMatches(liveMatches, oddsMap);
    console.log('🎲 Enriched matches:', enrichedLiveMatches.filter(m => m.liveOdds).length, 'with odds');
    
    ALL_FOOTBALL_CACHE.data = {
      success: true,
      matches: enrichedLiveMatches,
      allMatches: allMatches,
      upcomingMatches: upcomingMatches,
      totalMatches: enrichedLiveMatches.length,
      totalAllMatches: allMatches.length,
      lastUpdated: new Date().toISOString(),
      source: 'unibet-all-football-api',
      debug: {
        totalEventsFound: allMatches.length,
        liveEventsWithOdds: enrichedLiveMatches.length,
        upcomingEventsWithOdds: upcomingMatches.length
      }
    };
    
    ALL_FOOTBALL_CACHE.lastUpdated = new Date();
    console.log(`✅ Cache refreshed successfully: ${enrichedLiveMatches.length} live matches, ${upcomingMatches.length} upcoming matches`);
    
  } catch (error) {
    console.error('❌ Failed to refresh cache:', error.message);
    // Don't update cache on error, keep existing data
  } finally {
    ALL_FOOTBALL_CACHE.isRefreshing = false;
  }
}

// Function to ensure cache is warm
async function ensureAllFootballCacheWarm() {
  const now = new Date();
  const isCacheExpired = !ALL_FOOTBALL_CACHE.lastUpdated || 
                        (now.getTime() - ALL_FOOTBALL_CACHE.lastUpdated.getTime()) > CACHE_DURATION;
  
  if (!ALL_FOOTBALL_CACHE.data || isCacheExpired) {
    console.log('🔄 Cache is empty or expired, refreshing...');
    await refreshAllFootballCache();
  }
}

// Configuration matching the working unibet-api
const ALL_FOOTBALL_API_URL = 'https://www.unibet.com.au/sportsbook-feeds/views/filter/football/all/matches';
const ALL_FOOTBALL_HEADERS = {
  'accept': '*/*',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'en-US,en;q=0.9',
  'cookie': 'INGRESSCOOKIE_SPORTSBOOK_FEEDS=f3d49df9fd1f30ee455fda88a4c1e692|e6f03e039bb9fba9ad84e4dd980ef8c9; kwp-a-b-testing-fallback-id=9d145c34-651b-4e3f-bca2-2383f698e11b; sp=22d55880-9d33-4693-a3c2-352105c84f44; fp_token_7c6a6574-f011-4c9a-abdd-9894a102ccef=0Kr+dgJ/YQ+v/8u8PqxfCG+PLSQixICn92Wlrn6d4/4=; OptanonAlertBoxClosed=2025-06-16T06:18:41.300Z; __spdt=5dea1d36965d41bf8f16516f631e2210; _tgpc=17e8f544-79d0-5a3a-b0bd-92e2d8aafabf; _gcl_au=1.1.403931822.1750054723; _ga=GA1.1.133975116.1750054723; isReturningUser=true; clientId=polopoly_desktop; timezone=Asia/Karachi; INGRESSCOOKIE_APIGATEWAY=8f4b414a59c8b183628f926f7dfa58b4|cfa05ea48f7ba1e9a8f8d10007d08d5e; _tguatd=eyJzYyI6Ind3dy51bmliZXQuY29tIiwiZnRzIjoid3d3LnVuaWJldC5jb20ifQ==; _tgidts=eyJzaCI6ImQ0MWQ4Y2Q5OGYwMGIyMDRlOTgwMDk5OGVjZjg0MjdlIiwiY2kiOiJhNzNiODIzNS1jZDBlLTU2YWEtYmNlYS0xZWUyOGI4NDRjNjQiLCJzaSI6ImNjMDIyYmYzLTRkYTQtNWVjMC04YWJmLTI5YjdhMzIyMWM1NSJ9; _sp_ses.8ccc=*; _tglksd=eyJzIjoiY2MwMjJiZjMtNGRhNC01ZWMwLThhYmYtMjliN2EzMjIxYzU1Iiwic3QiOjE3NTQ5OTQ4OTE0MjAsInNvZCI6Ind3dy51bmliZXQuY29tIiwic29kdCI6MTc1MzM0NDk2NDUzOCwic29kcyI6ImMiLCJzb2RzdCI6MTc1NDk5NDg5MzY4NH0=; INGRESSCOOKIE_CMS=c41e492595a9d6dfade02052f30b60b3|52b57b1639bb8e648ac62eed802c09a2; OptanonConsent=isGpcEnabled=0&datestamp=Tue+Aug+12+2025+16%3A12%3A17+GMT%2B0500+(Pakistan+Standard+Time)&version=202401.2.0&browserGpcFlag=0&isIABGlobal=false&hosts=&genVendors=V5%3A0%2C&consentId=f581b4fc-c6a6-47cf-bd5b-c8aa71ce4db2&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0004%3A1%2CC0003%3A1%2CC0005%3A1&geolocation=PK%3BPB&AwaitingReconsent=false; _tgsid=eyJscGQiOiJ7XCJscHVcIjpcImh0dHBzOi8vd3d3LnVuaWJldC5jb20uYXUlMkZcIixcImxwdFwiOlwiT25saW5lJTIwR2FtYmxpbmclMjB3aXRoJTIwVW5pYmV0JTIwQXVzdHJhbGlhJTIwJTdDJTIwU3BvcnRzJTIwJTdDJTIwUmFjaW5nXCIsXCJscHJcIjpcImh0dHBzOi8vd3d3LnVuaWJldC5jb21cIn0iLCJwcyI6ImRiOGEzODEwLTEzNWMtNDMzNS1iOWU2LWJhNzdhN2I1NGM0ZiIsInB2YyI6IjIwIiwic2MiOiJjYzAyMmJmMy00ZGE0LTVlYzAtOGFiZi0yOWI3YTMyMjE1NSIsImVjIjoiNTAiLCJwdiI6IjEiLCJ0aW0iOiJjYzAyMmJmMy00ZGE0LTVlYzAtOGFiZi0yOWI3YTMyMjE1NSI6MTc1NDk5NDg5NDQ0NjotMX0=; _rdt_uuid=1750054722175.41b1a1ba-700c-4766-b2ed-58dd52a8f247; _sp_id.8ccc=7c67de03-e49c-4218-be1f-aaeaafa2158a.1750054660.7.1754997653.1754983786.e26593e7-062e-4f66-8298-802d479056b7.cf96a64c-844c-40c7-a9aa-8b531466bbec.4f38ed8d-63bf-4ab1-9f04-385eff01cc82.1754994891553.20; _ga_G1L15CCMLL=GS2.1.s1754994892$o12$g1$t1754997654$j59$l0$h0; INGRESSCOOKIE_UGRACING=68b5eb9bf37ff89ac2d1c331821a0a7f|f4136ac0333d3542dbf7e23c5af0d348',
  'priority': 'u=1, i',
  'referer': 'https://www.unibet.com.au/betting/sports/filter/football/all/matches',
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
};

// Live Odds API Configuration (Kambi API)
const LIVE_ODDS_API_URL = 'https://oc-offering-api.kambicdn.com/offering/v2018/ubau/event/live/open.json';
const LIVE_ODDS_HEADERS = {
  'accept': 'application/json, text/javascript, */*; q=0.01',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  'origin': 'https://www.unibet.com.au',
  'pragma': 'no-cache',
  'priority': 'u=1, i',
  'referer': 'https://www.unibet.com.au/',
  'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'cross-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
};

// In-memory cache for live odds
let LIVE_ODDS_CACHE = {
  data: null,
  lastUpdated: null,
  isRefreshing: false
};

// Function to fetch live odds from Kambi API
async function fetchLiveOdds() {
  try {
    const url = `${LIVE_ODDS_API_URL}?lang=en_AU&market=AU&client_id=2&channel_id=1&ncid=${Date.now()}`;
    console.log('🎲 Fetching live odds from Kambi API...');
    
    const response = await axios.get(url, {
      headers: LIVE_ODDS_HEADERS,
      timeout: 10000
    });
    
    if (response.status === 200 && response.data) {
      console.log(`✅ Successfully fetched live odds data:`, {
        hasLiveEvents: !!response.data.liveEvents,
        totalEvents: response.data.liveEvents?.length || 0,
        footballEvents: response.data.liveEvents?.filter(e => e.event?.sport === 'FOOTBALL').length || 0
      });
      return response.data;
    }
  } catch (error) {
    console.error('❌ Failed to fetch live odds:', error.message);
    return null;
  }
}

// Function to extract only 1X2 odds from Kambi API response (for frequent updates)
function extractLiveOdds(kambiData) {
  const oddsMap = {};
  
  if (kambiData && kambiData.liveEvents && Array.isArray(kambiData.liveEvents)) {
    kambiData.liveEvents.forEach(liveEvent => {
      // Only process football matches
      if (liveEvent.event && liveEvent.event.sport === 'FOOTBALL') {
        const eventId = liveEvent.event.id;
        
        const matchData = {
          betOfferId: null,
          outcomes: []
        };
        
        // Extract main bet offer (1X2 odds) only
        if (liveEvent.mainBetOffer && liveEvent.mainBetOffer.outcomes) {
          const outcomes = liveEvent.mainBetOffer.outcomes;
          
          matchData.betOfferId = liveEvent.mainBetOffer.id;
          matchData.outcomes = outcomes.map(outcome => ({
            id: outcome.id,
            label: outcome.label,
            type: outcome.type,
            odds: outcome.odds,
            oddsFractional: outcome.oddsFractional,
            oddsAmerican: outcome.oddsAmerican,
            participant: outcome.participant,
            status: outcome.status,
            changedDate: outcome.changedDate
          }));
        }
        
        oddsMap[eventId] = matchData;
      }
    });
  }
  
  console.log(`📊 Extracted odds for ${Object.keys(oddsMap).length} football matches`);
  return oddsMap;
}

// Function to extract live data (time, score) from Kambi API response (for less frequent updates)
function extractLiveData(kambiData) {
  const liveDataMap = {};
  
  if (kambiData && kambiData.liveEvents && Array.isArray(kambiData.liveEvents)) {
    kambiData.liveEvents.forEach(liveEvent => {
      // Only process football matches
      if (liveEvent.event && liveEvent.event.sport === 'FOOTBALL') {
        const eventId = liveEvent.event.id;
        
        // Extract live data (score, time, etc.) only
        if (liveEvent.liveData) {
          liveDataMap[eventId] = {
            eventId: liveEvent.liveData.eventId,
            matchClock: liveEvent.liveData.matchClock,
            score: liveEvent.liveData.score,
            statistics: liveEvent.liveData.statistics
          };
        }
      }
    });
  }
  
  console.log(`📊 Extracted live data for ${Object.keys(liveDataMap).length} football matches`);
  return liveDataMap;
}

// Function to merge live odds with match data
function mergeLiveOddsWithMatches(matches, oddsMap, liveDataMap = {}) {
  if (!oddsMap || Object.keys(oddsMap).length === 0) {
    console.log('⚠️ No live odds data to merge');
    return matches;
  }
  
  console.log('🔗 Merging odds and live data with matches:', {
    totalMatches: matches.length,
    totalOdds: Object.keys(oddsMap).length,
    totalLiveData: Object.keys(liveDataMap).length,
    matchIds: matches.map(m => m.id),
    oddsIds: Object.keys(oddsMap),
    liveDataIds: Object.keys(liveDataMap)
  });
  
  const enrichedMatches = matches.map(match => {
    const matchOdds = oddsMap[match.id];
    const matchLiveData = liveDataMap[match.id];
    
    const enrichedMatch = { ...match };
    
    if (matchOdds) {
      enrichedMatch.liveOdds = {
        betOfferId: matchOdds.betOfferId,
        outcomes: matchOdds.outcomes
      };
    } else {
      console.log(`❌ No odds found for match ${match.id}`);
    }
    
    if (matchLiveData) {
      console.log(`✅ Found live data for match ${match.id}:`, matchLiveData);
      enrichedMatch.kambiLiveData = matchLiveData;
    } else {
      console.log(`❌ No live data found for match ${match.id}`);
    }
    
    return enrichedMatch;
  });
  
  const matchesWithOdds = enrichedMatches.filter(m => m.liveOdds).length;
  const matchesWithLiveData = enrichedMatches.filter(m => m.kambiLiveData).length;
  console.log(`✨ Enriched ${matchesWithOdds} out of ${matches.length} matches with live odds`);
  console.log(`✨ Enriched ${matchesWithLiveData} out of ${matches.length} matches with live data`);
  
  return enrichedMatches;
}

// Test endpoint to check Kambi API directly
router.get('/test-kambi', async (req, res) => {
  try {
    console.log('🧪 Testing Kambi API directly...');
    const liveOddsData = await fetchLiveOdds();
    const oddsMap = extractLiveOdds(liveOddsData);
    
    res.json({
      success: true,
      kambiData: liveOddsData,
      oddsMap: oddsMap,
      totalMatches: Object.keys(oddsMap).length
    });
  } catch (error) {
    console.error('❌ Kambi API test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/v2/live-matches
router.get('/', async (req, res) => {
  try {
    // Check if force refresh is requested
    const forceRefresh = req.query.force === 'true';
    
    // Always fetch fresh data for now (simplified approach)
    console.log('🔄 Fetching fresh live matches data...');
    const url = `${ALL_FOOTBALL_API_URL}?includeParticipants=true&useCombined=true&ncid=${Date.now()}`;
    const data = await fetchWithRetry(url, ALL_FOOTBALL_HEADERS);
    const { allMatches, liveMatches, upcomingMatches } = extractFootballMatches(data);
    
    // Fetch live odds and live data
    console.log('🎲 Fetching live odds and live data...');
    const liveOddsData = await fetchLiveOdds();
    const oddsMap = extractLiveOdds(liveOddsData);
    const liveDataMap = extractLiveData(liveOddsData);
    
    // Merge live odds and live data with live matches
    const enrichedLiveMatches = mergeLiveOddsWithMatches(liveMatches, oddsMap, liveDataMap);
    
    const responseData = {
      success: true,
      matches: enrichedLiveMatches,
      allMatches: allMatches,
      upcomingMatches: upcomingMatches,
      totalMatches: enrichedLiveMatches.length,
      totalAllMatches: allMatches.length,
      lastUpdated: new Date().toISOString(),
      source: 'unibet-all-football-api',
      debug: {
        totalEventsFound: allMatches.length,
        liveEventsWithOdds: enrichedLiveMatches.length,
        upcomingEventsWithOdds: upcomingMatches.length,
        kambiLiveDataCount: Object.keys(liveDataMap).length
      }
    };
    
    // Update cache with fresh data
    ALL_FOOTBALL_CACHE.data = responseData;
    ALL_FOOTBALL_CACHE.lastUpdated = new Date();
    
    res.json(responseData);
  } catch (error) {
    console.error('❌ Error fetching live matches:', error);
    
    // If we have cached data, serve it even if it's stale
    if (ALL_FOOTBALL_CACHE.data) {
      console.log('📦 Serving stale cached data due to API error');
      res.json({
        ...ALL_FOOTBALL_CACHE.data,
        warning: 'Serving cached data due to API error',
        cacheAge: Math.floor((new Date().getTime() - ALL_FOOTBALL_CACHE.lastUpdated.getTime()) / 1000 / 60) + ' minutes old'
      });
    } else {
      // No cached data available, return error
      res.status(500).json({
        success: false,
        error: 'Failed to fetch live matches',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

// POST /api/v2/live-matches/refresh - Manual cache refresh
router.post('/refresh', async (req, res) => {
  try {
    console.log('🔄 Manual cache refresh requested...');
    
    // Clear cache and fetch fresh data
    ALL_FOOTBALL_CACHE.data = null;
    
    // Fetch fresh data
    const url = `${ALL_FOOTBALL_API_URL}?includeParticipants=true&useCombined=true&ncid=${Date.now()}`;
    const data = await fetchWithRetry(url, ALL_FOOTBALL_HEADERS);
    const { allMatches, liveMatches, upcomingMatches } = extractFootballMatches(data);
    
    // Fetch live odds and live data
    const liveOddsData = await fetchLiveOdds();
    const oddsMap = extractLiveOdds(liveOddsData);
    const liveDataMap = extractLiveData(liveOddsData);
    
    // Merge live odds and live data with live matches
    const enrichedLiveMatches = mergeLiveOddsWithMatches(liveMatches, oddsMap, liveDataMap);
    
    const responseData = {
      success: true,
      matches: enrichedLiveMatches,
      allMatches: allMatches,
      upcomingMatches: upcomingMatches,
      totalMatches: enrichedLiveMatches.length,
      totalAllMatches: allMatches.length,
      lastUpdated: new Date().toISOString(),
      source: 'unibet-all-football-api'
    };
    
    // Update cache with fresh data
    ALL_FOOTBALL_CACHE.data = responseData;
    ALL_FOOTBALL_CACHE.lastUpdated = new Date();
    
    res.json({
      success: true,
      message: 'Cache refreshed successfully',
      data: responseData,
      lastUpdated: ALL_FOOTBALL_CACHE.lastUpdated
    });
  } catch (error) {
    console.error('❌ Manual cache refresh failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh cache',
      message: error.message
    });
  }
});

// GET /api/v2/live-matches/status - Cache status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    cache: {
      hasData: !!ALL_FOOTBALL_CACHE.data,
      lastUpdated: ALL_FOOTBALL_CACHE.lastUpdated,
      isRefreshing: ALL_FOOTBALL_CACHE.isRefreshing,
      cacheAge: ALL_FOOTBALL_CACHE.lastUpdated ? 
        Math.floor((new Date().getTime() - ALL_FOOTBALL_CACHE.lastUpdated.getTime()) / 1000 / 60) : null,
      totalMatches: ALL_FOOTBALL_CACHE.data?.totalMatches || 0,
      liveMatches: ALL_FOOTBALL_CACHE.data?.matches?.length || 0
    }
  });
});

// Helper function to extract football matches (matching working unibet-api)
function extractFootballMatches(data) {
  const allMatches = [];
  const liveMatches = [];
  const upcomingMatches = [];
  
  if (data && data.layout && data.layout.sections) {
    const mainSection = data.layout.sections.find(s => s.position === 'MAIN');
    if (mainSection && mainSection.widgets) {
      const tournamentWidget = mainSection.widgets.find(w => w.widgetType === 'TOURNAMENT');
      if (tournamentWidget && tournamentWidget.matches && tournamentWidget.matches.groups) {
        // Process each group (which represents a league/competition)
        tournamentWidget.matches.groups.forEach(group => {
          if (group.subGroups) {
            group.subGroups.forEach(subGroup => {
              // Check if this subGroup has events directly
              if (subGroup.events) {
                const parentName = subGroup.parentName || 'Football';
                
                // Process events in this league
                subGroup.events.forEach(eventData => {
                  const event = eventData.event;
                  
                  // Only process football matches
                  if (event.sport !== 'FOOTBALL') {
                    return; // Skip non-football events
                  }
                  
                  const processedEvent = {
                    id: event.id,
                    name: event.name,
                    englishName: event.englishName,
                    homeName: event.homeName,
                    awayName: event.awayName,
                    start: event.start,
                    state: event.state,
                    sport: event.sport,
                    groupId: event.groupId,
                    group: event.group,
                    participants: event.participants,
                    nonLiveBoCount: event.nonLiveBoCount,
                    liveBoCount: event.liveBoCount,
                    tags: event.tags,
                    path: event.path,
                    parentName: parentName,
                    leagueName: subGroup.name,
                    mainBetOffer: eventData.mainBetOffer,
                    betOffers: eventData.betOffers,
                    liveData: event.liveData ? {
                      score: event.liveData.score || '0-0',
                      period: event.liveData.period || '1st Half',
                      minute: event.liveData.minute || '0'
                    } : null
                  };

                  allMatches.push(processedEvent);

                  // Categorize by state - include all STARTED matches regardless of odds availability
                  const hasBettingOdds = (eventData.mainBetOffer && eventData.mainBetOffer.outcomes && eventData.mainBetOffer.outcomes.length > 0) ||
                                        (eventData.betOffers && eventData.betOffers.length > 0);
                  
                  if (event.state === 'STARTED') {
                    // Include all live matches, even if odds are suspended (e.g., after 90 minutes)
                    liveMatches.push(processedEvent);
                  } else if (event.state === 'NOT_STARTED' && hasBettingOdds) {
                    // Only include upcoming matches that have betting odds
                    upcomingMatches.push(processedEvent);
                  }
                });
              }
              
              // Check if this subGroup has nested subGroups with events
              if (subGroup.subGroups) {
                subGroup.subGroups.forEach(nestedSubGroup => {
                  if (nestedSubGroup.events) {
                    const parentName = nestedSubGroup.parentName || subGroup.parentName || 'Football';
                    
                    // Process events in this nested league
                    nestedSubGroup.events.forEach(eventData => {
                      const event = eventData.event;
                      
                      // Only process football matches
                      if (event.sport !== 'FOOTBALL') {
                        return; // Skip non-football events
                      }
                      
                      const processedEvent = {
                        id: event.id,
                        name: event.name,
                        englishName: event.englishName,
                        homeName: event.homeName,
                        awayName: event.awayName,
                        start: event.start,
                        state: event.state,
                        sport: event.sport,
                        groupId: event.groupId,
                        group: event.group,
                        participants: event.participants,
                        nonLiveBoCount: event.nonLiveBoCount,
                        liveBoCount: event.liveBoCount,
                        tags: event.tags,
                        path: event.path,
                        parentName: parentName,
                        leagueName: nestedSubGroup.name,
                        mainBetOffer: eventData.mainBetOffer,
                        betOffers: eventData.betOffers,
                        liveData: event.liveData ? {
                          score: event.liveData.score || '0-0',
                          period: event.liveData.period || '1st Half',
                          minute: event.liveData.minute || '0'
                        } : null
                      };

                      allMatches.push(processedEvent);

                      // Categorize by state - include all STARTED matches regardless of odds availability
                      const hasBettingOdds = (eventData.mainBetOffer && eventData.mainBetOffer.outcomes && eventData.mainBetOffer.outcomes.length > 0) ||
                                            (eventData.betOffers && eventData.betOffers.length > 0);
                      
                      if (event.state === 'STARTED') {
                        // Include all live matches, even if odds are suspended (e.g., after 90 minutes)
                        liveMatches.push(processedEvent);
                      } else if (event.state === 'NOT_STARTED' && hasBettingOdds) {
                        // Only include upcoming matches that have betting odds
                        upcomingMatches.push(processedEvent);
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    }
  }
  
  // Apply league filtering based on CSV file
  console.log('🔍 Applying league filtering...');
  const stats = getLeagueFilterStats();
  console.log(`📊 Total allowed leagues: ${stats.totalAllowedLeagues}`);
  
  const filteredAllMatches = filterMatchesByAllowedLeagues(allMatches);
  const filteredLiveMatches = filterMatchesByAllowedLeagues(liveMatches);
  const filteredUpcomingMatches = filterMatchesByAllowedLeagues(upcomingMatches);
  
  console.log(`✅ League filtering complete:`);
  console.log(`   - All matches: ${allMatches.length} → ${filteredAllMatches.length}`);
  console.log(`   - Live matches: ${liveMatches.length} → ${filteredLiveMatches.length}`);
  console.log(`   - Upcoming matches: ${upcomingMatches.length} → ${filteredUpcomingMatches.length}`);

  // Filter upcoming matches to only show matches within next 24 hours
  const now = new Date();
  const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  const upcomingMatchesWithin24Hours = filteredUpcomingMatches.filter(match => {
    // Use start field (from event.start) or starting_at if available
    const matchStartTimeStr = match.start || match.starting_at;
    
    if (!matchStartTimeStr) {
      return false; // Exclude matches without start time
    }
    
    const matchStartTime = new Date(matchStartTimeStr);
    
    // Check if date is valid
    if (isNaN(matchStartTime.getTime())) {
      console.warn(`⚠️ Invalid start time for match ${match.id}: ${matchStartTimeStr}`);
      return false;
    }
    
    // Only include matches that start within the next 24 hours (from now)
    const isWithin24Hours = matchStartTime >= now && matchStartTime <= twentyFourHoursLater;
    
    return isWithin24Hours;
  });
  
  console.log(`⏰ Time filtering for upcoming matches:`);
  console.log(`   - Before 24h filter: ${filteredUpcomingMatches.length}`);
  console.log(`   - After 24h filter: ${upcomingMatchesWithin24Hours.length}`);
  console.log(`   - Current time: ${now.toISOString()}`);
  console.log(`   - 24 hours later: ${twentyFourHoursLater.toISOString()}`);

  return { 
    allMatches: filteredAllMatches, 
    liveMatches: filteredLiveMatches, 
    upcomingMatches: upcomingMatchesWithin24Hours 
  };
}

// Export extractFootballMatches for use in other services
export { extractFootballMatches };

// Initialize cache on startup (one-time only)
console.log('🚀 Initializing live matches cache...');
refreshAllFootballCache().then(() => {
  console.log('✅ Live matches cache initialized');
}).catch(error => {
  console.error('❌ Failed to initialize cache:', error.message);
});

// ✅ DISABLED: Automatic cache refresh - was making Unibet API calls from server every 30 seconds
// Frontend now calls Next.js API routes directly, so server-side auto-refresh is not needed
// This prevents unnecessary Unibet API calls from the backend
/*
setInterval(() => {
  console.log('⏰ Scheduled cache refresh...');
  refreshAllFootballCache();
}, CACHE_DURATION);
*/
console.log('⚠️ [DISABLED] Automatic cache refresh - frontend handles this via Next.js API routes');

export default router;
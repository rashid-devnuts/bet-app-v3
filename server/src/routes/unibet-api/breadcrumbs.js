import express from 'express';
// ✅ CHANGED: Use DB instead of CSV
import LeagueMapping from '../../models/LeagueMapping.js';

const router = express.Router();

// Load DB data into memory cache
let leagueMappingWithUrls = new Map();

// Load league mappings from database (ID -> URL mapping)
async function loadLeagueMappingWithUrls() {
  try {
    console.log('📥 Loading league mappings from database...');
    
    const mappings = await LeagueMapping.find({}).lean();
    
    leagueMappingWithUrls.clear();
    
    mappings.forEach(mapping => {
      if (mapping.unibetId && mapping.unibetUrl) {
        // Store Unibet_ID as key and Unibet_URL as value - Direct mapping!
        leagueMappingWithUrls.set(mapping.unibetId, mapping.unibetUrl.trim());
      }
    });
    
    console.log(`✅ Loaded ${leagueMappingWithUrls.size} league URLs from database`);
  } catch (error) {
    console.error('❌ Error loading league mappings from database:', error);
  }
}

// ✅ Get league URL from cache (with DB reload if needed)
async function getLeagueUrl(leagueId) {
  // First check in-memory cache
  let leagueUrl = leagueMappingWithUrls.get(leagueId);
  
  if (leagueUrl) {
    return leagueUrl;
  }
  
  // ✅ FALLBACK: Reload from DB if not in cache
  console.log(`⚠️ League ID ${leagueId} not in cache, reloading from database...`);
  await loadLeagueMappingWithUrls();
  
  // Check cache again after reload
  leagueUrl = leagueMappingWithUrls.get(leagueId);
  if (leagueUrl) {
    return leagueUrl;
  }
  
  // ✅ FALLBACK: Try direct DB query
  try {
    const mapping = await LeagueMapping.findOne({ unibetId: leagueId }).lean();
    if (mapping && mapping.unibetUrl) {
      leagueMappingWithUrls.set(leagueId, mapping.unibetUrl);
      return mapping.unibetUrl;
    }
  } catch (error) {
    console.error(`❌ Error querying DB for league ${leagueId}:`, error);
  }
  
  return null;
}

// Initialize DB data on startup
loadLeagueMappingWithUrls();

// GET /api/unibet-api/breadcrumbs/:leagueId - Get breadcrumbs data for a specific league
router.get('/:leagueId', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const leagueIdInt = parseInt(leagueId);
    console.log(`🔍 Fetching breadcrumbs for league ID: ${leagueId}`);
    
    // ✅ FIX: Use getLeagueUrl() which downloads from Cloudinary
    const leagueUrl = await getLeagueUrl(leagueIdInt);
    
    if (!leagueUrl) {
      console.error(`❌ League ID ${leagueId} not found in league_mapping_with_urls.csv`);
      return res.status(404).json({
        success: false,
        error: 'League URL not found',
        message: `League ID ${leagueId} not found in URL mapping`
      });
    }
    
    console.log(`🌐 Direct mapping: League ID ${leagueId} -> URL: ${leagueUrl}`);
    
    // Convert webpage URL to matches API URL
    // From: https://www.unibet.com.au/betting/sports/filter/football/spain/la_liga_2
    // To: https://www.unibet.com.au/sportsbook-feeds/views/filter/football/spain/la_liga_2/all/matches?includeParticipants=true&useCombined=true&ncid=1234567890
    const urlParts = leagueUrl.split('/');
    
    // Find the index of 'filter' to get the correct path
    const filterIndex = urlParts.findIndex(part => part === 'filter');
    if (filterIndex === -1) {
      throw new Error('Invalid league URL format - no "filter" found');
    }
    
    // Get everything after 'filter' (sport/league or sport/country/league)
    const matchesPath = urlParts.slice(filterIndex + 1).join('/');
    const unibetApiUrl = `https://www.unibet.com.au/sportsbook-feeds/views/filter/${matchesPath}/all/matches?includeParticipants=true&useCombined=true&ncid=${Date.now()}`;
    console.log(`🚀 Calling Unibet Matches API: ${unibetApiUrl}`);
    
    const response = await fetch(unibetApiUrl, {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'referer': leagueUrl,
        'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Unibet API responded with status: ${response.status}`);
    }
    
    const matchesData = await response.json();
    console.log(`✅ Successfully fetched matches data for league ID ${leagueId}`);
    
    // Return the data with league info
    res.json({
      success: true,
      data: {
        league: {
          id: parseInt(leagueId),
          url: leagueUrl
        },
        matches: matchesData,
        apiUrl: unibetApiUrl
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching breadcrumbs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch breadcrumbs',
      message: error.message
    });
  }
});

// GET /api/unibet-api/breadcrumbs - Get all available leagues (for debugging)
router.get('/', async (req, res) => {
  try {
    const availableLeagues = Array.from(leagueMappingWithUrls.entries()).map(([id, url]) => ({
      id,
      url
    }));
    
    res.json({
      success: true,
      data: availableLeagues,
      total: availableLeagues.length
    });
  } catch (error) {
    console.error('❌ Error fetching available leagues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available leagues',
      message: error.message
    });
  }
});

export default router;

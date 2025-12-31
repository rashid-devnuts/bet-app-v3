import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Load CSV data into memory
let leagueMappingWithUrls = new Map();
let lastCsvModified = null; // ✅ Track CSV file modification time

// Load league_mapping_with_urls.csv (ID -> URL mapping) - Now with Unibet_ID column
function loadLeagueMappingWithUrls() {
  try {
    const csvPath = path.join(__dirname, '../../../../league_mapping_with_urls.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.warn('⚠️ league_mapping_with_urls.csv not found');
      return;
    }
    
    // ✅ Track file modification time
    const stats = fs.statSync(csvPath);
    lastCsvModified = stats.mtime;
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Skip header line
    const dataLines = lines.slice(1);
    
    leagueMappingWithUrls.clear();
    
    dataLines.forEach(line => {
      if (!line.trim()) return;
      const [unibetId, unibetUrl, unibetName, fotmobUrl, fotmobName, matchType, country] = line.split(',');
      if (unibetId && unibetUrl) {
        // Store Unibet_ID as key and Unibet_URL as value - Direct mapping!
        const id = parseInt(unibetId);
        leagueMappingWithUrls.set(id, unibetUrl.trim());
      }
    });
    
    console.log(`✅ Loaded ${leagueMappingWithUrls.size} league URLs from league_mapping_with_urls.csv`);
  } catch (error) {
    console.error('❌ Error loading league_mapping_with_urls.csv:', error);
  }
}

// ✅ NEW: Check if CSV file was modified and reload if needed
function checkAndReloadCsv() {
  try {
    const csvPath = path.join(__dirname, '../../../../league_mapping_with_urls.csv');
    if (!fs.existsSync(csvPath)) return false;
    
    const stats = fs.statSync(csvPath);
    if (!lastCsvModified || stats.mtime > lastCsvModified) {
      console.log('📝 CSV file was modified, reloading...');
      loadLeagueMappingWithUrls();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error checking CSV file:', error);
    return false;
  }
}

// ✅ NEW: Get league URL with fallback (checks file directly if not in cache)
function getLeagueUrl(leagueId) {
  // First check in-memory cache
  let leagueUrl = leagueMappingWithUrls.get(leagueId);
  
  if (leagueUrl) {
    return leagueUrl;
  }
  
  // ✅ FALLBACK: Check if CSV was updated and reload
  checkAndReloadCsv();
  
  // Check cache again after reload
  leagueUrl = leagueMappingWithUrls.get(leagueId);
  if (leagueUrl) {
    return leagueUrl;
  }
  
  // ✅ FINAL FALLBACK: Read CSV file directly (in case cache is still stale)
  try {
    const csvPath = path.join(__dirname, '../../../../league_mapping_with_urls.csv');
    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const dataLines = lines.slice(1);
      
      for (const line of dataLines) {
        if (!line.trim()) continue;
        const [unibetId, unibetUrl] = line.split(',');
        if (unibetId && parseInt(unibetId) === leagueId && unibetUrl) {
          const url = unibetUrl.trim();
          // Update cache for next time
          leagueMappingWithUrls.set(leagueId, url);
          console.log(`✅ Found league ${leagueId} in CSV file (cache was stale)`);
          return url;
        }
      }
    }
  } catch (error) {
    console.error('❌ Error reading CSV file directly:', error);
  }
  
  return null;
}

// Initialize CSV data on startup
loadLeagueMappingWithUrls();

// ✅ NEW: Watch for CSV file changes
const csvPath = path.join(__dirname, '../../../../league_mapping_with_urls.csv');
if (fs.existsSync(csvPath)) {
  fs.watchFile(csvPath, { interval: 2000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log('📝 league_mapping_with_urls.csv changed, reloading...');
      loadLeagueMappingWithUrls();
    }
  });
  console.log('👀 Watching league_mapping_with_urls.csv for changes...');
}

// GET /api/unibet-api/breadcrumbs/:leagueId - Get breadcrumbs data for a specific league
router.get('/:leagueId', async (req, res) => {
  try {
    const { leagueId } = req.params;
    const leagueIdInt = parseInt(leagueId);
    console.log(`🔍 Fetching breadcrumbs for league ID: ${leagueId}`);
    
    // ✅ FIX: Use getLeagueUrl() which has fallback logic
    const leagueUrl = getLeagueUrl(leagueIdInt);
    
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

// ✅ CHANGED: Use DB instead of CSV
import LeagueMapping from '../models/LeagueMapping.js';

// Cache for league mapping data
let leagueMappingCache = null;

/**
 * Load league mapping from MongoDB database
 * @returns {Object} - Object with allowed league names and IDs
 */
export async function loadLeagueMapping() {
  if (leagueMappingCache) {
    return leagueMappingCache;
  }

  try {
    console.log('📥 Loading league mapping from database...');
    
    // Fetch all league mappings from DB
    const mappings = await LeagueMapping.find({}).lean();
    
    const allowedLeagueNames = new Set();
    const allowedLeagueIds = new Set();
    
    mappings.forEach(mapping => {
      if (mapping.unibetName && mapping.unibetName.trim()) {
        // Add both exact name and cleaned name variations
        allowedLeagueNames.add(mapping.unibetName.trim());
        allowedLeagueNames.add(mapping.unibetName.trim().toLowerCase());
        
        // Also add Fotmob name for matching
        if (mapping.fotmobName && mapping.fotmobName.trim()) {
          allowedLeagueNames.add(mapping.fotmobName.trim());
          allowedLeagueNames.add(mapping.fotmobName.trim().toLowerCase());
        }
      }
      
      if (mapping.unibetId) {
        allowedLeagueIds.add(String(mapping.unibetId));
      }
    });

    // ✅ FIX: Count unique league IDs, not names (multiple leagues can have same name)
    leagueMappingCache = {
      allowedLeagueNames,
      allowedLeagueIds,
      totalLeagues: allowedLeagueIds.size
    };

    console.log(`📊 Database Stats:`);
    console.log(`   - Total mappings in DB: ${mappings.length}`);
    console.log(`   - Unique league IDs found: ${allowedLeagueIds.size}`);
    console.log(`   - Unique league name variations: ${allowedLeagueNames.size}`);
    console.log(`   - Sample IDs:`, Array.from(allowedLeagueIds).slice(0, 10));
    console.log(`✅ Loaded ${leagueMappingCache.totalLeagues} allowed leagues from database`);
    console.log(`📋 Sample leagues:`, Array.from(allowedLeagueNames).slice(0, 10));
    
    return leagueMappingCache;
  } catch (error) {
    console.error('❌ Error loading league mapping from database:', error.message);
    return { allowedLeagueNames: new Set(), allowedLeagueIds: new Set() };
  }
}

/**
 * Check if a league ID is in the allowed list
 * @param {string|number} leagueId - The Unibet league ID to check
 * @returns {boolean} - Whether the league is allowed
 */
export async function isLeagueAllowed(leagueId) {
  if (!leagueId) {
    return false;
  }

  const { allowedLeagueIds } = await loadLeagueMapping();
  
  // Convert to string for comparison
  const leagueIdStr = String(leagueId);
  
  // Check exact match
  if (allowedLeagueIds.has(leagueIdStr)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a league name is in the allowed list (legacy function for backward compatibility)
 * @param {string} leagueName - The league name to check
 * @returns {boolean} - Whether the league is allowed
 */
export async function isLeagueNameAllowed(leagueName) {
  if (!leagueName || typeof leagueName !== 'string') {
    return false;
  }

  const { allowedLeagueNames } = await loadLeagueMapping();
  
  // Check exact match
  if (allowedLeagueNames.has(leagueName)) {
    return true;
  }
  
  // Check case-insensitive match
  if (allowedLeagueNames.has(leagueName.toLowerCase())) {
    return true;
  }
  
  // Check if any allowed league name contains this league name (partial match)
  for (const allowedName of allowedLeagueNames) {
    if (allowedName.toLowerCase().includes(leagueName.toLowerCase()) || 
        leagueName.toLowerCase().includes(allowedName.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter matches to only include those from allowed leagues
 * @param {Array} matches - Array of match objects
 * @returns {Array} - Filtered array of matches
 */
export async function filterMatchesByAllowedLeagues(matches) {
  if (!Array.isArray(matches)) {
    return [];
  }

  const { allowedLeagueIds } = await loadLeagueMapping();
  
  const filteredMatches = matches.filter(match => {
    // ONLY use groupId field (Unibet league ID) - STRICT METHOD
    if (match.groupId && isLeagueAllowed(match.groupId)) {
      return true;
    }
    
    return false;
  });

  console.log(`🔍 League filtering: ${matches.length} total matches → ${filteredMatches.length} allowed matches`);
  
  return filteredMatches;
}

/**
 * Get statistics about league filtering
 * @returns {Object} - Statistics about the league mapping
 */
export async function getLeagueFilterStats() {
  const mapping = await loadLeagueMapping();
  return {
    totalAllowedLeagues: mapping.totalLeagues || 0,
    allowedLeagueNames: Array.from(mapping.allowedLeagueNames || []),
    allowedLeagueIds: Array.from(mapping.allowedLeagueIds || [])
  };
}

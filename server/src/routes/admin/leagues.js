import express from 'express';
import { loadLeagueMapping } from '../../utils/leagueFilter.js';
import League from '../../models/League.js';
// ✅ REMOVED: CSV import - now using DB
// import { downloadLeagueMappingClean } from '../../utils/cloudinaryCsvLoader.js';
import LeagueMapping from '../../models/LeagueMapping.js';

const router = express.Router();

/**
 * Parse CSV line properly handling quoted fields with commas
 * @param {string} line - CSV line to parse
 * @returns {string[]} - Array of parsed fields
 */
function parseCsvLine(line) {
  const fields = [];
  let currentField = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      fields.push(currentField.trim().replace(/^"|"$/g, ''));
      currentField = '';
    } else {
      currentField += char;
    }
  }
  // Add the last field
  if (currentField.trim() || fields.length > 0) {
    fields.push(currentField.trim().replace(/^"|"$/g, ''));
  }
  
  // Ensure we have at least 6 fields (pad with empty strings if needed)
  while (fields.length < 6) {
    fields.push('');
  }
  
  return fields;
}

// GET /api/admin/leagues - Get all leagues from database
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching leagues from database...');
    
    // ✅ CHANGED: Load from database instead of CSV
    const mappings = await LeagueMapping.find({}).lean();
    
    console.log(`📊 Total mappings in DB: ${mappings.length}`);
    
    // Get popular leagues from database
    const popularLeaguesInDb = await League.find({}).lean();
    const popularLeaguesMap = new Map(
      popularLeaguesInDb.map((league) => [league.leagueId, league])
    );

    const leagues = [];
    const seenIds = new Set(); // ✅ ADD: Track seen IDs to detect duplicates
    let skippedCount = 0;
    let errorCount = 0;
    let duplicateCount = 0; // ✅ ADD: Track duplicates
    
    mappings.forEach((mapping, index) => {
      try {
        // ✅ CHANGED: Use DB mapping data directly
        const unibetId = String(mapping.unibetId);
        const unibetName = mapping.unibetName || '';
        const fotmobId = String(mapping.fotmobId);
        const fotmobName = mapping.fotmobName || '';
        const matchType = mapping.matchType || '';
        const country = mapping.country || '';
        
        // ✅ ADD: Log first few mappings for debugging
        if (index < 5) {
          console.log(`📋 Mapping ${index + 1}: UnibetID=${unibetId}, Name=${unibetName}, FotmobID=${fotmobId}`);
        }
        
        // Skip if essential fields are missing
        if (!unibetId || !unibetName || !fotmobId) {
          console.warn(`⚠️ Mapping ${index + 1}: Skipping - Missing essential fields (Unibet ID: ${unibetId}, Name: ${unibetName}, Fotmob ID: ${fotmobId})`);
          skippedCount++;
          return;
        }
        
        const leagueId = parseInt(unibetId);
        if (isNaN(leagueId)) {
          console.warn(`⚠️ Mapping ${index + 1}: Skipping - Invalid Unibet ID: ${unibetId}`);
          skippedCount++;
          return;
        }
        
        // ✅ ADD: Check for duplicates
        if (seenIds.has(leagueId)) {
          console.warn(`⚠️ Mapping ${index + 1}: Skipping - Duplicate Unibet ID: ${leagueId} (${unibetName})`);
          duplicateCount++;
          return;
        }
        seenIds.add(leagueId);
        
        // ✅ FIX: Normalize country name - trim and ensure consistent casing
        const normalizedCountry = country?.trim() || 'Other';
        
        // Check if this league is marked as popular in database
        const dbLeague = popularLeaguesMap.get(leagueId);
        
        leagues.push({
          id: leagueId, // Use Unibet ID as the league ID
          unibetId: unibetId,
          name: unibetName,
          fotmobId: fotmobId,
          fotmobName: fotmobName,
          matchType: matchType || '',
          country: {
            name: normalizedCountry,
            official_name: normalizedCountry,
            image: null // No country images in DB
          },
          image_path: null, // No league images in DB
          isPopular: dbLeague ? dbLeague.isPopular : false, // Get from database or default to false
          popularOrder: dbLeague?.order || 0, // Get from database or default to 0
          short_code: null // No short codes in DB
        });
      } catch (error) {
        console.error(`❌ Mapping ${index + 1}: Error processing - ${error.message}`);
        errorCount++;
      }
    });

    console.log(`✅ Loaded ${leagues.length} unique leagues from database`);
    console.log(`⚠️ Skipped ${skippedCount} invalid mappings`);
    console.log(`🔄 Found ${duplicateCount} duplicate league IDs`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Expected: ${mappings.length}, Got: ${leagues.length}, Skipped: ${skippedCount + duplicateCount + errorCount}`);
    
    // ✅ ADD: Log unique IDs count
    const uniqueIds = new Set(leagues.map(l => l.id));
    console.log(`📊 Unique league IDs: ${uniqueIds.size}`);
    if (uniqueIds.size !== leagues.length) {
      console.warn(`⚠️ WARNING: Found ${leagues.length - uniqueIds.size} duplicate league IDs in final array!`);
    }

    res.json({
      success: true,
      data: leagues,
      total: leagues.length,
      skipped: skippedCount,
      duplicates: duplicateCount, // ✅ ADD: Include duplicates in response
      errors: errorCount,
      expected: mappings.length
    });

  } catch (error) {
    console.error('❌ Error fetching leagues from database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leagues from database',
      message: error.message
    });
  }
});

// GET /api/admin/leagues/popular - Get popular leagues (placeholder for now)
router.get('/popular', async (req, res) => {
  try {
    console.log('📋 Fetching popular leagues...');
    
    // For now, return empty popular leagues
    // This can be extended later to store popular leagues in database
    res.json({
      success: true,
      data: [],
      total: 0
    });

  } catch (error) {
    console.error('❌ Error fetching popular leagues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular leagues',
      message: error.message
    });
  }
});

// POST /api/admin/leagues/popular - Update popular leagues
router.post('/popular', async (req, res) => {
  try {
    console.log('📋 Updating popular leagues...');
    console.log('📊 Leagues to update:', req.body.leagues);
    
    const { leagues } = req.body;
    
    if (!Array.isArray(leagues)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid leagues data format'
      });
    }
    
    // Clear all existing popular leagues
    await League.deleteMany({});
    
    // Insert new popular leagues
    const leaguesToInsert = leagues.map(league => ({
      leagueId: league.leagueId,
      name: league.name,
      isPopular: league.isPopular,
      order: league.order || 0
    }));
    
    if (leaguesToInsert.length > 0) {
      await League.insertMany(leaguesToInsert);
    }
    
    console.log(`✅ Updated ${leaguesToInsert.length} popular leagues in database`);
    
    res.json({
      success: true,
      message: 'Popular leagues updated successfully',
      data: leaguesToInsert
    });

  } catch (error) {
    console.error('❌ Error updating popular leagues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update popular leagues',
      message: error.message
    });
  }
});

// GET /api/admin/leagues/mapping - Get league mapping for frontend (Unibet→Fotmob + filtering data)
router.get('/mapping', async (req, res) => {
  try {
    console.log('📋 Fetching league mapping for frontend from database...');
    
    // ✅ CHANGED: Load from database instead of CSV (using static import from top)
    const mappings = await LeagueMapping.find({}).lean();
    
    console.log(`📊 Total mappings in DB: ${mappings.length}`);
    
    // Build mapping objects
    const unibetToFotmobMapping = {};
    const allowedLeagueIds = [];
    const allowedLeagueNames = [];
    
    mappings.forEach(mapping => {
      const unibetId = String(mapping.unibetId);
      const fotmobId = String(mapping.fotmobId);
      const unibetName = mapping.unibetName || '';
      const fotmobName = mapping.fotmobName || '';
      
      // Add to Unibet→Fotmob mapping (for icons)
      if (unibetId && fotmobId) {
        unibetToFotmobMapping[unibetId] = fotmobId;
      }
      
      // Add to allowed league IDs (for filtering)
      if (unibetId) {
        allowedLeagueIds.push(unibetId);
      }
      
      // Add to allowed league names (for filtering)
      if (unibetName) {
        allowedLeagueNames.push(unibetName);
        allowedLeagueNames.push(unibetName.toLowerCase());
        
        // Also add Fotmob name for matching
        if (fotmobName) {
          allowedLeagueNames.push(fotmobName);
          allowedLeagueNames.push(fotmobName.toLowerCase());
        }
      }
    });

    console.log(`✅ Built mapping: ${Object.keys(unibetToFotmobMapping).length} leagues`);
    console.log(`✅ Allowed league IDs: ${allowedLeagueIds.length}`);
    console.log(`✅ Allowed league names: ${allowedLeagueNames.length}`);

    res.json({
      success: true,
      data: {
        unibetToFotmobMapping,
        allowedLeagueIds,
        allowedLeagueNames,
        totalLeagues: allowedLeagueIds.length
      },
      timestamp: new Date().toISOString(),
      cacheHint: 'Cache this response for 1 hour' // Frontend can cache
    });

  } catch (error) {
    console.error('❌ Error fetching league mapping from database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch league mapping',
      message: error.message
    });
  }
});

export default router;

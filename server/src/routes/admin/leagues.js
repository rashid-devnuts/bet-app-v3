import express from 'express';
import { loadLeagueMapping } from '../../utils/leagueFilter.js';
import League from '../../models/League.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GET /api/admin/leagues - Get all leagues from CSV file
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching leagues from CSV file...');
    console.log('📁 Current directory:', __dirname);
    
    // Load the CSV data
    const csvPath = path.join(__dirname, '../../unibet-calc/league_mapping_clean.csv');
    console.log('📁 CSV path:', csvPath);
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found at:', csvPath);
      return res.status(404).json({
        success: false,
        error: 'CSV file not found',
        path: csvPath
      });
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Skip header line
    const dataLines = lines.slice(1);
    
    // Get popular leagues from database
    const popularLeaguesInDb = await League.find({}).lean();
    const popularLeaguesMap = new Map(
      popularLeaguesInDb.map((league) => [league.leagueId, league])
    );

    const leagues = dataLines.map((line, index) => {
      if (!line.trim()) return null;
      
      // ✅ FIX: Properly parse CSV with quoted values
      // Strip quotes from each field and trim whitespace
      const fields = line.split(',').map(field => field.replace(/^"|"$/g, '').trim());
      const [unibetId, unibetName, fotmobId, fotmobName, matchType, country] = fields;
      const leagueId = parseInt(unibetId) || index + 1;
      
      // ✅ FIX: Normalize country name - trim and ensure consistent casing
      const normalizedCountry = country?.trim() || 'Other';
      
      // Check if this league is marked as popular in database
      const dbLeague = popularLeaguesMap.get(leagueId);
      
      return {
        id: leagueId, // Use Unibet ID as the league ID
        unibetId: unibetId?.trim(),
        name: unibetName?.trim(),
        fotmobId: fotmobId?.trim(),
        fotmobName: fotmobName?.trim(),
        matchType: matchType?.trim(),
        country: {
          name: normalizedCountry,
          official_name: normalizedCountry,
          image: null // No country images in CSV
        },
        image_path: null, // No league images in CSV
        isPopular: dbLeague ? dbLeague.isPopular : false, // Get from database or default to false
        popularOrder: dbLeague?.order || 0, // Get from database or default to 0
        short_code: null // No short codes in CSV
      };
    }).filter(league => league !== null);

    console.log(`✅ Loaded ${leagues.length} leagues from CSV`);

    res.json({
      success: true,
      data: leagues,
      total: leagues.length
    });

  } catch (error) {
    console.error('❌ Error fetching leagues from CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leagues from CSV',
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

export default router;

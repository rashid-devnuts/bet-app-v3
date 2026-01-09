import "dotenv/config";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/database.js';
import LeagueMapping from '../models/LeagueMapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sync league mappings from CSV to MongoDB
 * Only saves properly mapped leagues (with valid Fotmob ID)
 */
async function syncLeagueMappingsToDB() {
    try {
        console.log('🔄 Starting league mapping sync from CSV to DB...');
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        // Read CSV file
        const csvPath = path.join(__dirname, '../unibet-calc/league_mapping_clean.csv');
        
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }
        
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').slice(1); // Skip header
        
        console.log(`📄 Found ${lines.length} lines in CSV`);
        
        let saved = 0;
        let skipped = 0;
        let errors = 0;
        const skippedReasons = {
            invalidFotmobId: 0,
            duplicate: 0,
            missingFields: 0
        };
        
        for (const line of lines) {
            if (!line.trim()) {
                skipped++;
                continue;
            }
            
            try {
                // Parse CSV line (handle quoted values)
                const fields = line.split(',').map(f => f.trim().replace(/^"|"$/g, ''));
                const [unibetId, unibetName, fotmobId, fotmobName, matchType, country] = fields;
                
                // ✅ VALIDATION: Only save if properly mapped (has valid Fotmob ID)
                if (!unibetId || !fotmobId || !unibetName || !fotmobName) {
                    skippedReasons.missingFields++;
                    skipped++;
                    console.log(`⚠️ Skipping - Missing fields: ${unibetId || 'NO_ID'} → ${fotmobId || 'NO_FOTMOB_ID'}`);
                    continue;
                }
                
                // Validate Fotmob ID is a number
                const fotmobIdNum = parseInt(fotmobId);
                if (isNaN(fotmobIdNum) || fotmobIdNum <= 0) {
                    skippedReasons.invalidFotmobId++;
                    skipped++;
                    console.log(`⚠️ Skipping - Invalid Fotmob ID: ${unibetId} → ${fotmobId}`);
                    continue;
                }
                
                const unibetIdNum = parseInt(unibetId);
                if (isNaN(unibetIdNum) || unibetIdNum <= 0) {
                    skippedReasons.missingFields++;
                    skipped++;
                    console.log(`⚠️ Skipping - Invalid Unibet ID: ${unibetId}`);
                    continue;
                }
                
                // Check if already exists
                const existing = await LeagueMapping.findOne({
                    $or: [
                        { unibetId: unibetIdNum },
                        { fotmobId: fotmobIdNum }
                    ]
                });
                
                if (existing) {
                    skippedReasons.duplicate++;
                    skipped++;
                    console.log(`⚠️ Skipping - Already exists: ${unibetId} → ${fotmobId}`);
                    continue;
                }
                
                // ✅ Construct Unibet URL
                let unibetUrl = '';
                try {
                    const baseUrl = 'https://www.unibet.com.au/betting/sports/filter/football';
                    
                    // Normalize to slug format
                    const normalizeToSlug = (str) => {
                        if (!str) return '';
                        return str
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/[''"]/g, '')
                            .replace(/[^a-z0-9\s-]/g, '')
                            .replace(/\s+/g, '_')
                            .replace(/_+/g, '_')
                            .replace(/^_+|_+$/g, '')
                            .trim();
                    };
                    
                    // For international leagues (no country or country is "International")
                    if (!country || country === 'International' || country === 'Unknown') {
                        const leagueSlug = normalizeToSlug(unibetName);
                        unibetUrl = `${baseUrl}/${leagueSlug}`;
                    } else {
                        const countrySlug = normalizeToSlug(country);
                        const leagueSlug = normalizeToSlug(unibetName);
                        
                        // If country and league name are the same, use only league slug
                        if (countrySlug === leagueSlug) {
                            unibetUrl = `${baseUrl}/${leagueSlug}`;
                        } else {
                            unibetUrl = `${baseUrl}/${countrySlug}/${leagueSlug}`;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Could not construct Unibet URL for ${unibetName}: ${error.message}`);
                }
                
                // Create mapping
                const leagueMapping = new LeagueMapping({
                    unibetId: unibetIdNum,
                    unibetName: unibetName,
                    fotmobId: fotmobIdNum,
                    fotmobName: fotmobName,
                    matchType: matchType || 'Different Name',
                    country: country || '',
                    unibetUrl: unibetUrl,
                    fotmobUrl: `https://www.fotmob.com/leagues/${fotmobIdNum}`
                });
                
                await leagueMapping.save();
                saved++;
                console.log(`✅ Saved: ${unibetName} (${unibetId} → ${fotmobId})`);
                
            } catch (error) {
                errors++;
                if (error.code === 11000) {
                    skippedReasons.duplicate++;
                    console.log(`⚠️ Duplicate key error: ${error.message}`);
                } else {
                    console.error(`❌ Error processing line: ${error.message}`);
                    console.error(`   Line: ${line.substring(0, 100)}...`);
                }
            }
        }
        
        console.log('\n📊 Sync Summary:');
        console.log(`   ✅ Saved: ${saved}`);
        console.log(`   ⚠️ Skipped: ${skipped}`);
        console.log(`      - Missing fields: ${skippedReasons.missingFields}`);
        console.log(`      - Invalid Fotmob ID: ${skippedReasons.invalidFotmobId}`);
        console.log(`      - Duplicates: ${skippedReasons.duplicate}`);
        console.log(`   ❌ Errors: ${errors}`);
        
        // Get total count from DB
        const totalInDB = await LeagueMapping.countDocuments();
        console.log(`\n📈 Total leagues in DB: ${totalInDB}`);
        
        console.log('\n✅ Sync completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

// Run sync
syncLeagueMappingsToDB();

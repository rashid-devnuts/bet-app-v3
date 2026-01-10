import "dotenv/config";
import connectDB from '../config/database.js';
import LeagueMapping from '../models/LeagueMapping.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Remove Club Friendly Matches from database and CSV files
 */
async function removeClubFriendlyMatches() {
    try {
        console.log('🔄 Starting removal of Club Friendly Matches...');
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        // Find Club Friendly Matches in database
        const clubFriendlyLeagues = await LeagueMapping.find({
            $or: [
                { unibetName: /Club Friendly/i },
                { unibetName: /club friendly/i },
                { unibetId: 1000093393 } // Known Unibet ID for Club Friendly Matches
            ]
        });
        
        console.log(`📋 Found ${clubFriendlyLeagues.length} Club Friendly Matches in database`);
        
        let dbDeleted = 0;
        if (clubFriendlyLeagues.length > 0) {
            for (const league of clubFriendlyLeagues) {
                console.log(`🗑️  Deleting from DB: ${league.unibetName} (Unibet ID: ${league.unibetId})`);
                await LeagueMapping.deleteOne({ _id: league._id });
                dbDeleted++;
            }
            console.log(`✅ Deleted ${dbDeleted} records from database`);
        } else {
            console.log('ℹ️  No Club Friendly Matches found in database');
        }
        
        // Remove from CSV files
        const csvFiles = [
            path.join(__dirname, '../unibet-calc/league_mapping_with_urls.csv'),
            path.join(__dirname, '../unibet-calc/league_mapping_clean.csv'),
            path.join(__dirname, '../unibet-calc/league_mapping_clean_test.csv')
        ];
        
        let csvUpdated = 0;
        for (const csvPath of csvFiles) {
            if (!fs.existsSync(csvPath)) {
                console.log(`⚠️  CSV file not found: ${csvPath}`);
                continue;
            }
            
            try {
                let csvContent = fs.readFileSync(csvPath, 'utf-8');
                const lines = csvContent.split('\n');
                const header = lines[0];
                const dataLines = lines.slice(1);
                
                const originalCount = dataLines.length;
                
                // Filter out Club Friendly Matches
                const filteredLines = dataLines.filter(line => {
                    if (!line.trim()) return true; // Keep empty lines
                    
                    // Check if line contains Club Friendly Matches
                    const lowerLine = line.toLowerCase();
                    if (lowerLine.includes('club friendly') || line.includes('1000093393')) {
                        console.log(`🗑️  Removing from ${path.basename(csvPath)}: ${line.substring(0, 100)}...`);
                        return false;
                    }
                    return true;
                });
                
                const newCsvContent = [header, ...filteredLines].join('\n');
                fs.writeFileSync(csvPath, newCsvContent, 'utf-8');
                
                const removedCount = originalCount - filteredLines.length;
                if (removedCount > 0) {
                    csvUpdated++;
                    console.log(`✅ Updated ${path.basename(csvPath)}: Removed ${removedCount} line(s)`);
                } else {
                    console.log(`ℹ️  No changes needed in ${path.basename(csvPath)}`);
                }
            } catch (error) {
                console.error(`❌ Error updating ${csvPath}:`, error.message);
            }
        }
        
        console.log('\n✅ Removal complete!');
        console.log(`📊 Summary:`);
        console.log(`   - Database: ${dbDeleted} records deleted`);
        console.log(`   - CSV files: ${csvUpdated} files updated`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Removal failed:', error);
        process.exit(1);
    }
}

// Run removal
removeClubFriendlyMatches();

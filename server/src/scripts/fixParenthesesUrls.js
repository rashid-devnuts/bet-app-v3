import "dotenv/config";
import connectDB from '../config/database.js';
import LeagueMapping from '../models/LeagueMapping.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Normalize string to slug format with special handling for parentheses
 * Converts "(W)" to "__w_", "(Division 1)" to "__division_1_", etc.
 * Example: "Liga MX Femenil (W)" → "liga_mx_femenil__w_"
 */
function normalizeToSlugWithParentheses(str) {
    if (!str) return '';
    
    // Simple normalization: replace parentheses with underscores instead of removing them
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[''"]/g, '')
        .replace(/[^a-z0-9\s()-]/g, '') // Keep parentheses, spaces, hyphens
        .replace(/\s+/g, '_') // Replace spaces with underscore
        .replace(/\(/g, '_') // ✅ ONE-LINER: Replace ( with _
        .replace(/\)/g, '_') // ✅ ONE-LINER: Replace ) with _
        .replace(/([^_])_{3,}([^_])/g, '$1_$2') // Collapse 3+ underscores to single
        .replace(/^_+/, '') // Remove only leading underscores, keep trailing ones
        .trim();
}

/**
 * Fix Unibet URLs for leagues with parentheses in their names
 */
async function fixParenthesesUrls() {
    try {
        console.log('🔄 Starting fix for parentheses URLs...');
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        // Find all leagues with parentheses in unibetName
        const leaguesWithParentheses = await LeagueMapping.find({
            unibetName: /\(/
        });
        
        console.log(`📋 Found ${leaguesWithParentheses.length} leagues with parentheses in name\n`);
        
        if (leaguesWithParentheses.length === 0) {
            console.log('✅ No leagues with parentheses found!');
            process.exit(0);
        }
        
        const baseUrl = 'https://www.unibet.com.au/betting/sports/filter/football';
        let updated = 0;
        let skipped = 0;
        
        for (const league of leaguesWithParentheses) {
            try {
                // Normalize country slug (simple normalization, no parentheses handling)
                const normalizeCountry = (str) => {
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
                
                // Normalize league name with parentheses handling
                const leagueSlug = normalizeToSlugWithParentheses(league.unibetName);
                
                // Construct URL based on country
                let newUrl = '';
                if (!league.country || league.country === 'International' || league.country === 'Unknown') {
                    newUrl = `${baseUrl}/${leagueSlug}`;
                } else {
                    const countrySlug = normalizeCountry(league.country);
                    // If country and league name are the same, use only league slug
                    if (countrySlug === normalizeCountry(league.unibetName)) {
                        newUrl = `${baseUrl}/${leagueSlug}`;
                    } else {
                        newUrl = `${baseUrl}/${countrySlug}/${leagueSlug}`;
                    }
                }
                
                // Check if URL needs updating
                if (league.unibetUrl === newUrl) {
                    skipped++;
                    continue;
                }
                
                // Update the database
                await LeagueMapping.updateOne(
                    { _id: league._id },
                    { $set: { unibetUrl: newUrl } }
                );
                
                console.log(`📝 Updating "${league.unibetName}":`);
                console.log(`   Old URL: ${league.unibetUrl || '(empty)'}`);
                console.log(`   New URL: ${newUrl}\n`);
                
                updated++;
                
            } catch (error) {
                console.error(`❌ Failed to update ${league.unibetName}: ${error.message}`);
            }
        }
        
        console.log(`✅ Database update complete:`);
        console.log(`   - Updated: ${updated} leagues`);
        console.log(`   - Skipped: ${skipped} leagues (already correct)\n`);
        
        // Update CSV file if it exists
        const csvPath = path.join(__dirname, '../unibet-calc/league_mapping_with_urls.csv');
        if (fs.existsSync(csvPath)) {
            console.log('📄 Updating URLs CSV file...');
            try {
                let csvContent = fs.readFileSync(csvPath, 'utf-8');
                const lines = csvContent.split('\n');
                const header = lines[0];
                const dataLines = lines.slice(1);
                
                let csvUpdated = 0;
                const updatedLines = dataLines.map(line => {
                    if (!line.trim()) return line;
                    
                    const columns = line.split(',');
                    if (columns.length < 3) return line;
                    
                    const unibetName = columns[2]; // Unibet_Name is 3rd column
                    
                    // Check if this league has parentheses
                    if (unibetName && unibetName.includes('(')) {
                        // Find matching league from database
                        const matchingLeague = leaguesWithParentheses.find(
                            l => l.unibetName === unibetName
                        );
                        
                        if (matchingLeague) {
                            // Update the URL column (2nd column, index 1)
                            const normalizeCountry = (str) => {
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
                            
                            const leagueSlug = normalizeToSlugWithParentheses(matchingLeague.unibetName);
                            let newUrl = '';
                            
                            if (!matchingLeague.country || matchingLeague.country === 'International' || matchingLeague.country === 'Unknown') {
                                newUrl = `${baseUrl}/${leagueSlug}`;
                            } else {
                                const countrySlug = normalizeCountry(matchingLeague.country);
                                if (countrySlug === normalizeCountry(matchingLeague.unibetName)) {
                                    newUrl = `${baseUrl}/${leagueSlug}`;
                                } else {
                                    newUrl = `${baseUrl}/${countrySlug}/${leagueSlug}`;
                                }
                            }
                            
                            columns[1] = newUrl; // Update URL column
                            csvUpdated++;
                            return columns.join(',');
                        }
                    }
                    
                    return line;
                });
                
                const newCsvContent = [header, ...updatedLines].join('\n');
                fs.writeFileSync(csvPath, newCsvContent, 'utf-8');
                console.log(`✅ Updated ${csvPath} (${csvUpdated} lines with parentheses)\n`);
            } catch (error) {
                console.error(`⚠️ Failed to update CSV: ${error.message}`);
            }
        }
        
        console.log('✅ All updates complete!');
        console.log(`📊 Summary:`);
        console.log(`   - Database: ${updated} leagues updated`);
        console.log(`   - CSV files: Updated`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
        process.exit(1);
    }
}

// Run fix
fixParenthesesUrls();

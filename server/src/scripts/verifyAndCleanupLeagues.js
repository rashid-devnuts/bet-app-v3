import "dotenv/config";
import connectDB from '../config/database.js';
import LeagueMapping from '../models/LeagueMapping.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Escape CSV field (add quotes if contains comma, quote, or newline)
 */
function escapeCSVField(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Parse CSV line properly handling quoted fields and commas in values
 */
function parseCSVLine(line) {
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            fields.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    fields.push(currentField.trim());
    return fields;
}

/**
 * Verify and cleanup leagues across DB, clean CSV, and URLs CSV
 */
async function verifyAndCleanupLeagues() {
    try {
        console.log('🔄 Starting verification and cleanup...');
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        const cleanCsvPath = path.join(__dirname, '../unibet-calc/league_mapping_clean.csv');
        const urlsCsvPath = path.join(__dirname, '../unibet-calc/league_mapping_with_urls.csv');
        
        // 1. Load all data from three sources
        console.log('\n📥 Loading data from all sources...');
        
        // Load from DB
        const dbLeagues = await LeagueMapping.find({}).lean();
        const dbMap = new Map();
        dbLeagues.forEach(league => {
            dbMap.set(String(league.unibetId), league);
        });
        console.log(`   - Database: ${dbMap.size} leagues`);
        
        // Load from clean CSV
        const cleanCsvMap = new Map();
        if (fs.existsSync(cleanCsvPath)) {
            const cleanContent = fs.readFileSync(cleanCsvPath, 'utf-8');
            const cleanLines = cleanContent.split('\n').filter(line => line.trim() !== '');
            cleanLines.slice(1).forEach(line => {
                const fields = parseCSVLine(line);
                if (fields[0] && fields[0].trim()) {
                    cleanCsvMap.set(fields[0].trim(), {
                        unibetId: fields[0].trim(),
                        unibetName: fields[1] || '',
                        fotmobId: fields[2] || '',
                        fotmobName: fields[3] || '',
                        matchType: fields[4] || '',
                        country: fields[5] || '',
                        isVerified: fields[6] || 'false'
                    });
                }
            });
        }
        console.log(`   - Clean CSV: ${cleanCsvMap.size} leagues`);
        
        // Load from URLs CSV (handle both formats)
        const urlsCsvMap = new Map();
        if (fs.existsSync(urlsCsvPath)) {
            const urlsContent = fs.readFileSync(urlsCsvPath, 'utf-8');
            const urlsLines = urlsContent.split('\n').filter(line => line.trim() !== '');
            
            const isOldFormat = urlsLines.length > 1 && urlsLines[1].trim() === ',Is_Verified';
            
            if (isOldFormat) {
                // Old format: convert to new format
                console.log('   ⚠️  URLs CSV is in old format, converting...');
                for (let i = 2; i < urlsLines.length; i += 2) {
                    const dataLine = urlsLines[i];
                    const isVerifiedLine = urlsLines[i + 1] || ',true';
                    if (dataLine && dataLine.trim() && dataLine.includes('http')) {
                        const fields = parseCSVLine(dataLine);
                        const isVerified = isVerifiedLine.trim().replace(/^,/, '') || 'true';
                        if (fields[0] && fields[0].trim()) {
                            urlsCsvMap.set(fields[0].trim(), {
                                unibetId: fields[0].trim(),
                                unibetUrl: fields[1] || '',
                                unibetName: fields[2] || '',
                                fotmobUrl: fields[3] || '',
                                fotmobName: fields[4] || '',
                                matchType: fields[5] || '',
                                country: fields[6] || '',
                                isVerified: isVerified
                            });
                        }
                    }
                }
            } else {
                // New format
                urlsLines.slice(1).forEach(line => {
                    if (line.trim() && line.includes('http')) {
                        const fields = parseCSVLine(line);
                        if (fields[0] && fields[0].trim()) {
                            urlsCsvMap.set(fields[0].trim(), {
                                unibetId: fields[0].trim(),
                                unibetUrl: fields[1] || '',
                                unibetName: fields[2] || '',
                                fotmobUrl: fields[3] || '',
                                fotmobName: fields[4] || '',
                                matchType: fields[5] || '',
                                country: fields[6] || '',
                                isVerified: fields[7] || 'false'
                            });
                        }
                    }
                });
            }
        }
        console.log(`   - URLs CSV: ${urlsCsvMap.size} leagues`);
        
        // 2. Find differences
        console.log('\n🔍 Analyzing differences...');
        
        const allUnibetIds = new Set([
            ...dbMap.keys(),
            ...cleanCsvMap.keys(),
            ...urlsCsvMap.keys()
        ]);
        
        const missingInDb = [];
        const missingInClean = [];
        const missingInUrls = [];
        const extraInClean = [];
        const extraInUrls = [];
        
        for (const unibetId of allUnibetIds) {
            const inDb = dbMap.has(unibetId);
            const inClean = cleanCsvMap.has(unibetId);
            const inUrls = urlsCsvMap.has(unibetId);
            
            if (!inDb && inClean) missingInDb.push(unibetId);
            if (!inDb && inUrls) missingInDb.push(unibetId);
            if (inDb && !inClean) missingInClean.push(unibetId);
            if (inDb && !inUrls) missingInUrls.push(unibetId);
            if (inClean && !inDb) extraInClean.push(unibetId);
            if (inUrls && !inDb) extraInUrls.push(unibetId);
        }
        
        // 3. Report findings
        console.log('\n📊 Findings:');
        console.log(`   - Missing in DB: ${missingInDb.length}`);
        if (missingInDb.length > 0) {
            console.log(`     IDs: ${missingInDb.slice(0, 10).join(', ')}${missingInDb.length > 10 ? '...' : ''}`);
        }
        
        console.log(`   - Missing in Clean CSV: ${missingInClean.length}`);
        if (missingInClean.length > 0) {
            console.log(`     IDs: ${missingInClean.slice(0, 10).join(', ')}${missingInClean.length > 10 ? '...' : ''}`);
        }
        
        console.log(`   - Missing in URLs CSV: ${missingInUrls.length}`);
        if (missingInUrls.length > 0) {
            console.log(`     IDs: ${missingInUrls.slice(0, 10).join(', ')}${missingInUrls.length > 10 ? '...' : ''}`);
        }
        
        console.log(`   - Extra in Clean CSV (not in DB): ${extraInClean.length}`);
        if (extraInClean.length > 0) {
            console.log(`     IDs: ${extraInClean.slice(0, 10).join(', ')}${extraInClean.length > 10 ? '...' : ''}`);
        }
        
        console.log(`   - Extra in URLs CSV (not in DB): ${extraInUrls.length}`);
        if (extraInUrls.length > 0) {
            console.log(`     IDs: ${extraInUrls.slice(0, 10).join(', ')}${extraInUrls.length > 10 ? '...' : ''}`);
        }
        
        // 4. Fix URLs CSV format and remove extras
        console.log('\n🔧 Fixing URLs CSV...');
        
        if (fs.existsSync(urlsCsvPath)) {
            const headerLine = 'Unibet_ID,Unibet_URL,Unibet_Name,Fotmob_URL,Fotmob_Name,Match_Type,Country/Region,Is_Verified';
            const dataLines = [];
            
            // Only include entries that exist in DB
            for (const [unibetId, league] of dbMap.entries()) {
                const urlsEntry = urlsCsvMap.get(unibetId);
                if (urlsEntry) {
                    const fields = [
                        escapeCSVField(unibetId),
                        escapeCSVField(urlsEntry.unibetUrl),
                        escapeCSVField(urlsEntry.unibetName),
                        escapeCSVField(urlsEntry.fotmobUrl),
                        escapeCSVField(urlsEntry.fotmobName),
                        escapeCSVField(urlsEntry.matchType),
                        escapeCSVField(urlsEntry.country),
                        escapeCSVField(urlsEntry.isVerified)
                    ];
                    dataLines.push(fields.join(','));
                } else {
                    // Create entry from DB data
                    const unibetUrl = league.unibetUrl || '';
                    const fotmobUrl = league.fotmobUrl || `https://www.fotmob.com/leagues/${league.fotmobId}`;
                    const fields = [
                        escapeCSVField(unibetId),
                        escapeCSVField(unibetUrl),
                        escapeCSVField(league.unibetName),
                        escapeCSVField(fotmobUrl),
                        escapeCSVField(league.fotmobName),
                        escapeCSVField(league.matchType),
                        escapeCSVField(league.country || 'International'),
                        escapeCSVField(league.isVerified ? 'true' : 'false')
                    ];
                    dataLines.push(fields.join(','));
                }
            }
            
            // Sort by Unibet ID
            dataLines.sort((a, b) => {
                const idA = parseCSVLine(a)[0];
                const idB = parseCSVLine(b)[0];
                return idA.localeCompare(idB);
            });
            
            const newContent = [headerLine, ...dataLines].join('\n') + '\n';
            fs.writeFileSync(urlsCsvPath, newContent, 'utf-8');
            console.log(`   ✅ URLs CSV fixed: ${dataLines.length} entries (removed ${urlsCsvMap.size - dataLines.length} extras)`);
        }
        
        // 5. Fix Clean CSV - remove extras
        console.log('\n🔧 Fixing Clean CSV...');
        
        if (fs.existsSync(cleanCsvPath)) {
            const headerLine = 'Unibet_ID,Unibet_Name,Fotmob_ID,Fotmob_Name,Match_Type,Country/Region,Is_Verified';
            const dataLines = [];
            
            // Only include entries that exist in DB
            for (const [unibetId, league] of dbMap.entries()) {
                const cleanEntry = cleanCsvMap.get(unibetId);
                if (cleanEntry) {
                    const fields = [
                        escapeCSVField(unibetId),
                        escapeCSVField(cleanEntry.unibetName),
                        escapeCSVField(cleanEntry.fotmobId),
                        escapeCSVField(cleanEntry.fotmobName),
                        escapeCSVField(cleanEntry.matchType),
                        escapeCSVField(cleanEntry.country),
                        escapeCSVField(cleanEntry.isVerified)
                    ];
                    dataLines.push(fields.join(','));
                } else {
                    // Create entry from DB data
                    const fields = [
                        escapeCSVField(unibetId),
                        escapeCSVField(league.unibetName),
                        escapeCSVField(league.fotmobId),
                        escapeCSVField(league.fotmobName),
                        escapeCSVField(league.matchType),
                        escapeCSVField(league.country || 'International'),
                        escapeCSVField(league.isVerified ? 'true' : 'false')
                    ];
                    dataLines.push(fields.join(','));
                }
            }
            
            // Sort by Unibet ID
            dataLines.sort((a, b) => {
                const idA = parseCSVLine(a)[0];
                const idB = parseCSVLine(b)[0];
                return idA.localeCompare(idB);
            });
            
            const newContent = [headerLine, ...dataLines].join('\n') + '\n';
            fs.writeFileSync(cleanCsvPath, newContent, 'utf-8');
            console.log(`   ✅ Clean CSV fixed: ${dataLines.length} entries (removed ${cleanCsvMap.size - dataLines.length} extras)`);
        }
        
        // 6. Re-read CSVs to verify final counts
        let finalCleanCount = 0;
        if (fs.existsSync(cleanCsvPath)) {
            const cleanContent = fs.readFileSync(cleanCsvPath, 'utf-8');
            const cleanLines = cleanContent.split('\n').filter(line => line.trim() !== '');
            finalCleanCount = cleanLines.length - 1; // Subtract header
        }
        
        let finalUrlsCount = 0;
        if (fs.existsSync(urlsCsvPath)) {
            const urlsContent = fs.readFileSync(urlsCsvPath, 'utf-8');
            const urlsLines = urlsContent.split('\n').filter(line => line.trim() !== '');
            urlsLines.slice(1).forEach(line => {
                if (line.trim() && line.includes('http')) {
                    finalUrlsCount++;
                }
            });
        }
        
        // 7. Final verification
        console.log('\n✅ Verification complete!');
        console.log(`📊 Final Counts:`);
        console.log(`   - Database: ${dbMap.size} leagues`);
        console.log(`   - Clean CSV: ${finalCleanCount} leagues`);
        console.log(`   - URLs CSV: ${finalUrlsCount} leagues`);
        
        if (dbMap.size === finalCleanCount && dbMap.size === finalUrlsCount) {
            console.log('✅ All counts match!');
        } else {
            console.warn('⚠️  WARNING: Counts still do not match!');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

// Run verification
verifyAndCleanupLeagues();

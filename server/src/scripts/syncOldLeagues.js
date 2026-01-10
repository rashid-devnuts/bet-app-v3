import "dotenv/config";
import connectDB from '../config/database.js';
import LeagueMapping from '../models/LeagueMapping.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Normalize string to slug format with parentheses handling (same as fixParenthesesUrls)
 */
function normalizeToSlug(str) {
    if (!str) return '';
    
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[''"]/g, '')
        .replace(/[^a-z0-9\s()-]/g, '') // Keep parentheses, spaces, hyphens
        .replace(/\s+/g, '_') // Replace spaces with underscore
        .replace(/\(/g, '_') // Replace ( with _
        .replace(/\)/g, '_') // Replace ) with _
        .replace(/([^_])_{3,}([^_])/g, '$1_$2') // Collapse 3+ underscores to single
        .replace(/^_+/, '') // Remove only leading underscores, keep trailing ones
        .trim();
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
                // Escaped quote
                currentField += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator
            fields.push(currentField.trim());
            currentField = '';
        } else {
            currentField += char;
        }
    }
    // Add last field
    fields.push(currentField.trim());
    return fields;
}

/**
 * Construct Unibet URL from league data (same logic as service)
 */
function constructUnibetUrl(unibetName, country) {
    const baseUrl = 'https://www.unibet.com.au/betting/sports/filter/football';
    
    // For international leagues
    if (!country || country === 'International' || country === 'Unknown') {
        const leagueSlug = normalizeToSlug(unibetName);
        return `${baseUrl}/${leagueSlug}`;
    }
    
    const countrySlug = normalizeToSlug(country);
    const leagueSlug = normalizeToSlug(unibetName);
    
    // If country and league name are essentially the same, use only league slug
    if (countrySlug === leagueSlug) {
        return `${baseUrl}/${leagueSlug}`;
    }
    
    // For country-based leagues
    return `${baseUrl}/${countrySlug}/${leagueSlug}`;
}

/**
 * Sync leagues from old_leagues.csv to database and CSV files
 */
async function syncOldLeagues() {
    try {
        console.log('🔄 Starting sync of old leagues...');
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        // Read old_leagues.csv
        const oldLeaguesPath = path.join(__dirname, '../unibet-calc/old_leagues.csv');
        if (!fs.existsSync(oldLeaguesPath)) {
            console.error('❌ old_leagues.csv not found!');
            process.exit(1);
        }
        
        const oldLeaguesContent = fs.readFileSync(oldLeaguesPath, 'utf-8');
        const lines = oldLeaguesContent.split('\n').filter(line => line.trim() !== '');
        const header = lines[0];
        const dataLines = lines.slice(1);
        
        console.log(`📋 Found ${dataLines.length} leagues in old_leagues.csv`);
        
        // Get existing Unibet IDs from database
        const existingDbLeagues = await LeagueMapping.find({}, { unibetId: 1 }).lean();
        const existingDbIds = new Set(existingDbLeagues.map(l => String(l.unibetId)));
        console.log(`📊 Found ${existingDbIds.size} existing leagues in database`);
        
        // Get existing Unibet IDs from CSV files
        const cleanCsvPath = path.join(__dirname, '../unibet-calc/league_mapping_clean.csv');
        const urlsCsvPath = path.join(__dirname, '../unibet-calc/league_mapping_with_urls.csv');
        
        const existingCleanIds = new Set();
        const existingUrlsIds = new Set();
        
        // Read clean CSV
        if (fs.existsSync(cleanCsvPath)) {
            const cleanContent = fs.readFileSync(cleanCsvPath, 'utf-8');
            const cleanLines = cleanContent.split('\n').filter(line => line.trim() !== '');
            cleanLines.slice(1).forEach(line => {
                const fields = parseCSVLine(line);
                if (fields[0] && fields[0].trim()) {
                    existingCleanIds.add(fields[0].trim());
                }
            });
        }
        
        // Read URLs CSV (handle both old format with separate Is_Verified lines and new one-line format)
        if (fs.existsSync(urlsCsvPath)) {
            const urlsContent = fs.readFileSync(urlsCsvPath, 'utf-8');
            const urlsLines = urlsContent.split('\n').filter(line => line.trim() !== '');
            
            // Check if it's old format (Is_Verified on separate line) or new format (one line per record)
            let isOldFormat = false;
            if (urlsLines.length > 1 && urlsLines[1].trim() === ',Is_Verified') {
                isOldFormat = true;
            }
            
            if (isOldFormat) {
                // Old format: skip header, Is_Verified header, then process pairs
                for (let i = 2; i < urlsLines.length; i += 2) {
                    const dataLine = urlsLines[i];
                    if (dataLine && dataLine.trim() && dataLine.includes('http')) {
                        const fields = parseCSVLine(dataLine);
                        if (fields[0] && fields[0].trim()) {
                            existingUrlsIds.add(fields[0].trim());
                        }
                    }
                }
            } else {
                // New format: one line per record
                urlsLines.slice(1).forEach(line => {
                    if (line.trim() && line.includes('http')) {
                        const fields = parseCSVLine(line);
                        if (fields[0] && fields[0].trim()) {
                            existingUrlsIds.add(fields[0].trim());
                        }
                    }
                });
            }
        }
        
        console.log(`📊 Found ${existingCleanIds.size} existing leagues in clean CSV`);
        console.log(`📊 Found ${existingUrlsIds.size} existing leagues in URLs CSV`);
        
        let addedToDb = 0;
        let addedToCleanCsv = 0;
        let addedToUrlsCsv = 0;
        let skipped = 0;
        
        // Process each league from old_leagues.csv
        for (const line of dataLines) {
            if (!line.trim()) continue;
            
            try {
                // Parse CSV line properly (handle quoted values and commas in values)
                const fields = parseCSVLine(line);
                const [unibetId, unibetName, fotmobId, fotmobName, matchType, country] = fields;
                
                if (!unibetId || !unibetName || !fotmobId || !fotmobName) {
                    console.log(`⚠️  Skipping incomplete line: ${line.substring(0, 50)}...`);
                    skipped++;
                    continue;
                }
                
                // Fix typo: "Differnent Name" → "Different Name"
                let normalizedMatchType = matchType || 'Different Name';
                if (normalizedMatchType === 'Differnent Name') {
                    normalizedMatchType = 'Different Name';
                }
                
                // Validate matchType enum
                if (normalizedMatchType !== 'Exact Match' && normalizedMatchType !== 'Different Name') {
                    console.log(`⚠️  Invalid matchType "${normalizedMatchType}", defaulting to "Different Name"`);
                    normalizedMatchType = 'Different Name';
                }
                
                const unibetIdStr = String(unibetId);
                const unibetIdNum = parseInt(unibetId);
                const fotmobIdNum = parseInt(fotmobId);
                
                if (isNaN(unibetIdNum) || isNaN(fotmobIdNum)) {
                    console.log(`⚠️  Skipping invalid IDs: ${unibetId} / ${fotmobId}`);
                    skipped++;
                    continue;
                }
                
                // Check if already exists in DB (by unibetId OR fotmobId to avoid duplicate key errors)
                const existsInDb = existingDbIds.has(unibetIdStr);
                const existingByFotmob = await LeagueMapping.findOne({ fotmobId: fotmobIdNum });
                const existsInDbByFotmob = !!existingByFotmob;
                
                // Check if already exists in CSVs
                const existsInClean = existingCleanIds.has(unibetIdStr);
                const existsInUrls = existingUrlsIds.has(unibetIdStr);
                
                // Skip only if exists in ALL three places
                if (existsInDb && existsInClean && existsInUrls) {
                    skipped++;
                    continue;
                }
                
                // If exists in DB by fotmobId but different unibetId, skip to avoid duplicate
                if (existsInDbByFotmob && !existsInDb) {
                    console.log(`⚠️  Skipping ${unibetName} - Fotmob ID ${fotmobId} already exists with different Unibet ID`);
                    skipped++;
                    continue;
                }
                
                // Construct URLs
                const unibetUrl = constructUnibetUrl(unibetName, country || 'International');
                const fotmobUrl = `https://www.fotmob.com/leagues/${fotmobId}`;
                
                // Add to database if not exists
                if (!existsInDb && !existsInDbByFotmob) {
                    try {
                        await LeagueMapping.create({
                            unibetId: unibetIdNum,
                            unibetName: unibetName,
                            fotmobId: fotmobIdNum,
                            fotmobName: fotmobName,
                            matchType: normalizedMatchType, // Use normalized matchType
                            country: country || 'International',
                            unibetUrl: unibetUrl,
                            fotmobUrl: fotmobUrl,
                            isVerified: false // ✅ Mark as not verified
                        });
                        addedToDb++;
                        existingDbIds.add(unibetIdStr); // Update set to avoid duplicates
                        console.log(`✅ Added to DB: ${unibetName} (${unibetId})`);
                    } catch (error) {
                        if (error.code === 11000) {
                            console.log(`⚠️  Skipping ${unibetName} - Duplicate key error (already exists)`);
                            skipped++;
                            continue;
                        }
                        throw error;
                    }
                }
                
                // Add to clean CSV if not exists
                if (!existsInClean && fs.existsSync(cleanCsvPath)) {
                    const cleanContent = fs.readFileSync(cleanCsvPath, 'utf-8');
                    const cleanLines = cleanContent.split('\n').filter(line => line.trim() !== '');
                    const newLine = `${unibetId},${unibetName},${fotmobId},${fotmobName},${normalizedMatchType},${country || 'International'},false`;
                    const newContent = cleanLines.join('\n') + '\n' + newLine;
                    fs.writeFileSync(cleanCsvPath, newContent, 'utf-8');
                    addedToCleanCsv++;
                    existingCleanIds.add(unibetIdStr);
                    console.log(`✅ Added to clean CSV: ${unibetName}`);
                }
                
                // Add to URLs CSV if not exists (convert to proper format - one line per record)
                if (!existsInUrls && fs.existsSync(urlsCsvPath)) {
                    const urlsContent = fs.readFileSync(urlsCsvPath, 'utf-8');
                    const urlsLines = urlsContent.split('\n').filter(line => line.trim() !== '');
                    
                    // Ensure header has Is_Verified column
                    let headerLine = urlsLines[0] || 'Unibet_ID,Unibet_URL,Unibet_Name,Fotmob_URL,Fotmob_Name,Match_Type,Country/Region,Is_Verified';
                    if (!headerLine.includes('Is_Verified')) {
                        headerLine = headerLine + ',Is_Verified';
                    }
                    
                    // Check if old format (Is_Verified on separate line)
                    const isOldFormat = urlsLines.length > 1 && urlsLines[1].trim() === ',Is_Verified';
                    
                    // Get existing data lines and convert to new format
                    const existingDataLines = [];
                    if (isOldFormat) {
                        // Old format: convert pairs to single lines
                        for (let i = 2; i < urlsLines.length; i += 2) {
                            const dataLine = urlsLines[i];
                            const isVerifiedLine = urlsLines[i + 1] || ',true';
                            if (dataLine && dataLine.trim() && dataLine.includes('http')) {
                                // Extract Is_Verified value
                                const isVerifiedValue = isVerifiedLine.trim().replace(/^,/, '') || 'true';
                                // Combine into one line
                                existingDataLines.push(dataLine + ',' + isVerifiedValue);
                            }
                        }
                    } else {
                        // New format: just copy lines, ensure Is_Verified exists
                        for (let i = 1; i < urlsLines.length; i++) {
                            const line = urlsLines[i];
                            if (line.trim() && line.includes('http')) {
                                const fields = parseCSVLine(line);
                                if (fields.length >= 7) {
                                    // Has Is_Verified
                                    existingDataLines.push(line);
                                } else {
                                    // Missing Is_Verified, add default
                                    existingDataLines.push(line + ',true');
                                }
                            }
                        }
                    }
                    
                    // Add new entry (one line format)
                    const newDataLine = `${unibetId},${unibetUrl},${unibetName},${fotmobUrl},${fotmobName},${normalizedMatchType},${country || 'International'},false`;
                    
                    const newContent = [
                        headerLine,
                        ...existingDataLines,
                        newDataLine
                    ].join('\n') + '\n';
                    
                    fs.writeFileSync(urlsCsvPath, newContent, 'utf-8');
                    addedToUrlsCsv++;
                    existingUrlsIds.add(unibetIdStr);
                    console.log(`✅ Added to URLs CSV: ${unibetName}`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing line: ${error.message}`);
                skipped++;
            }
        }
        
        // Verify counts match
        const dbCount = await LeagueMapping.countDocuments({});
        
        // Re-read CSV files to get accurate counts
        let cleanCsvCount = 0;
        if (fs.existsSync(cleanCsvPath)) {
            const cleanContent = fs.readFileSync(cleanCsvPath, 'utf-8');
            const cleanLines = cleanContent.split('\n').filter(line => line.trim() !== '');
            cleanCsvCount = cleanLines.length - 1; // Subtract header
        }
        
        let urlsCsvCount = 0;
        if (fs.existsSync(urlsCsvPath)) {
            const urlsContent = fs.readFileSync(urlsCsvPath, 'utf-8');
            const urlsLines = urlsContent.split('\n').filter(line => line.trim() !== '');
            
            // Check if old format
            const isOldFormat = urlsLines.length > 1 && urlsLines[1].trim() === ',Is_Verified';
            
            if (isOldFormat) {
                // Old format: count data lines (skip header, Is_Verified header, and Is_Verified value lines)
                for (let i = 2; i < urlsLines.length; i += 2) {
                    const dataLine = urlsLines[i];
                    if (dataLine && dataLine.trim() && dataLine.includes('http')) {
                        urlsCsvCount++;
                    }
                }
            } else {
                // New format: count data lines (skip header)
                urlsLines.slice(1).forEach(line => {
                    if (line.trim() && line.includes('http')) {
                        urlsCsvCount++;
                    }
                });
            }
        }
        
        console.log('\n✅ Sync complete!');
        console.log(`📊 Summary:`);
        console.log(`   - Added to DB: ${addedToDb} leagues`);
        console.log(`   - Added to clean CSV: ${addedToCleanCsv} leagues`);
        console.log(`   - Added to URLs CSV: ${addedToUrlsCsv} leagues`);
        console.log(`   - Skipped (already exists): ${skipped} leagues`);
        
        console.log('\n📊 Count Verification:');
        console.log(`   - Database: ${dbCount} leagues`);
        console.log(`   - Clean CSV: ${cleanCsvCount} leagues`);
        console.log(`   - URLs CSV: ${urlsCsvCount} leagues`);
        
        if (dbCount !== cleanCsvCount || dbCount !== urlsCsvCount) {
            console.warn('⚠️  WARNING: Counts do not match! Please verify manually.');
        } else {
            console.log('✅ All counts match!');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

// Run sync
syncOldLeagues();

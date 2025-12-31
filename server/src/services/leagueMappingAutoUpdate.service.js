import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { normalizeTeamName, calculateNameSimilarity } from '../unibet-calc/utils/fotmob-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LeagueMappingAutoUpdate {
    constructor() {
        this.clientCsvPath = path.join(__dirname, '../../../client/league_mapping_clean.csv');
        this.serverCsvPath = path.join(__dirname, '../unibet-calc/league_mapping_clean.csv');
        this.urlsCsvPath = path.join(__dirname, '../../../league_mapping_with_urls.csv');
        
        // ✅ Add path verification logging
        console.log('[LeagueMapping] 📁 File paths initialized:');
        console.log(`[LeagueMapping]   - Client CSV: ${this.clientCsvPath}`);
        console.log(`[LeagueMapping]   - Server CSV: ${this.serverCsvPath}`);
        console.log(`[LeagueMapping]   - URLs CSV: ${this.urlsCsvPath}`);
        console.log(`[LeagueMapping]   - URLs CSV exists: ${fs.existsSync(this.urlsCsvPath)}`);
        console.log(`[LeagueMapping]   - Current working directory: ${process.cwd()}`);
        console.log(`[LeagueMapping]   - __dirname: ${__dirname}`);
        
        this.existingMappings = new Map(); // Key: Unibet_ID, Value: mapping object
        this.existingFotmobIds = new Set(); // Track all Fotmob IDs already mapped
        this.newMappings = []; // Store new mappings to add
    }

    /**
     * Load existing mappings from CSV files
     */
    loadExistingMappings() {
        console.log('[LeagueMapping] Loading existing mappings from CSV...');
        
        try {
            // Read server CSV (both should be same, but we'll check server one)
            if (!fs.existsSync(this.serverCsvPath)) {
                console.warn('[LeagueMapping] Server CSV file not found:', this.serverCsvPath);
                return;
            }

            const csvContent = fs.readFileSync(this.serverCsvPath, 'utf8');
            const lines = csvContent.split('\n').slice(1); // Skip header

            this.existingMappings.clear();
            this.existingFotmobIds.clear();

            for (const line of lines) {
                if (!line.trim() || line.startsWith(',')) continue; // Skip empty lines
                
                const [unibetId, unibetName, fotmobId, fotmobName, matchType, country] = 
                    line.split(',').map(s => s.trim().replace(/"/g, ''));

                if (unibetId && fotmobId) {
                    this.existingMappings.set(unibetId, {
                        unibetId,
                        unibetName,
                        fotmobId,
                        fotmobName,
                        matchType,
                        country
                    });
                    // Track Fotmob ID to prevent duplicate mappings
                    this.existingFotmobIds.add(fotmobId);
                }
            }

            console.log(`[LeagueMapping] Loaded ${this.existingMappings.size} existing mappings`);
        } catch (error) {
            console.error('[LeagueMapping] Error loading existing mappings:', error);
        }
    }

    /**
     * Extract league ID and info from Unibet path array
     * Path structure: [Soccer, Country, League] - we need League (not Soccer, not Country)
     */
    extractLeagueFromPath(pathArray) {
        if (!pathArray || !Array.isArray(pathArray) || pathArray.length < 2) {
            return null;
        }

        // Find league (not soccer/football, not country)
        // Usually it's the last entry, but verify it's not "Soccer" or "Football"
        for (let i = pathArray.length - 1; i >= 0; i--) {
            const item = pathArray[i];
            const termKey = (item.termKey || '').toLowerCase();
            const name = (item.name || '').toLowerCase();
            
            // Skip if it's soccer/football
            if (termKey === 'football' || termKey === 'soccer' || 
                name === 'soccer' || name === 'football') {
                continue;
            }
            
            // This should be the league
            return {
                id: item.id,
                name: item.name,
                englishName: item.englishName || item.name,
                termKey: item.termKey
            };
        }

        // Fallback: return second last if exists (usually country is last, league is second last)
        if (pathArray.length >= 2) {
            const item = pathArray[pathArray.length - 2];
            return {
                id: item.id,
                name: item.name,
                englishName: item.englishName || item.name,
                termKey: item.termKey
            };
        }

        return null;
    }

    /**
     * Extract country from Unibet path array
     * For international leagues, path is: [Football, League] (no country) - only 2 entries
     * For country leagues, path is: [Football, Country, League] - 3+ entries
     */
    extractCountryFromPath(pathArray) {
        if (!pathArray || !Array.isArray(pathArray)) return null;
        
        // ✅ SIMPLE FIX: If path has only 2 entries total (Football + League), it's international
        // If path has 3+ entries (Football + Country + League), first non-football is country
        if (pathArray.length === 2) {
            // Only Football and League - no country = International
            return 'International';
        }
        
        // For 3+ entries, first non-football entry is usually the country
        for (const item of pathArray) {
            const termKey = (item.termKey || '').toLowerCase();
            // Skip soccer/football
            if (termKey === 'football' || termKey === 'soccer') continue;
            // First non-soccer entry is usually country
            return item.name;
        }
        
        return null;
    }

    /**
     * Fetch Unibet matches for a specific date
     */
    async fetchUnibetMatches(dateStr) {
        console.log(`[LeagueMapping] Fetching Unibet matches for date: ${dateStr}`);
        
        try {
            // Use the Unibet API endpoint
            const url = `https://www.unibet.com.au/sportsbook-feeds/views/filter/football/all/matches?includeParticipants=true&useCombined=true&ncid=${Date.now()}`;
            
            const headers = {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'referer': 'https://www.unibet.com.au/betting/sports/filter/football/all/matches',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
            };

            const response = await axios.get(url, { headers, timeout: 30000 });
            const data = response.data;

            // Extract matches from the response structure
            // Structure: layout.sections[].widgets[].matches.groups[].subGroups[].events[].event
            const leaguesMap = new Map(); // Group by league

            const extractFromWidgets = (widgets) => {
                if (!Array.isArray(widgets)) return;

                for (const widget of widgets) {
                    if (widget.matches && widget.matches.groups) {
                        extractFromGroups(widget.matches.groups);
                    }
                }
            };

            const extractFromGroups = (groups) => {
                if (!Array.isArray(groups)) return;

                for (const group of groups) {
                    // Check if group has events directly
                    if (group.events && Array.isArray(group.events)) {
                        extractFromEvents(group.events);
                    }

                    // Check subGroups
                    if (group.subGroups && Array.isArray(group.subGroups)) {
                        for (const subGroup of group.subGroups) {
                            if (subGroup.events && Array.isArray(subGroup.events)) {
                                extractFromEvents(subGroup.events);
                            }
                        }
                    }
                }
            };

            const extractFromEvents = (events) => {
                if (!Array.isArray(events)) return;

                for (const eventObj of events) {
                    if (eventObj.event && eventObj.event.path) {
                        const league = this.extractLeagueFromPath(eventObj.event.path);
                        if (league) {
                            const leagueId = String(league.id);
                            
                            if (!leaguesMap.has(leagueId)) {
                                leaguesMap.set(leagueId, {
                                    id: leagueId,
                                    name: league.name,
                                    englishName: league.englishName,
                                    country: this.extractCountryFromPath(eventObj.event.path),
                                    matches: []
                                });
                            }

                            leaguesMap.get(leagueId).matches.push({
                                eventId: eventObj.event.id,
                                homeName: eventObj.event.homeName,
                                awayName: eventObj.event.awayName,
                                start: eventObj.event.start,
                                path: eventObj.event.path
                            });
                        }
                    }
                }
            };

            // Navigate through the response structure
            if (data.layout && data.layout.sections) {
                for (const section of data.layout.sections) {
                    if (section.widgets) {
                        extractFromWidgets(section.widgets);
                    }
                }
            }

            console.log(`[LeagueMapping] Found ${leaguesMap.size} unique leagues in Unibet data`);
            return Array.from(leaguesMap.values());
        } catch (error) {
            console.error('[LeagueMapping] Error fetching Unibet matches:', error.message);
            throw error;
        }
    }

    /**
     * Fetch Fotmob matches for a specific date
     */
    async fetchFotmobMatches(dateStr) {
        console.log(`[LeagueMapping] Fetching Fotmob matches for date: ${dateStr}`);
        
        try {
            const timezone = 'Asia/Karachi';
            const ccode3 = 'PAK';
            const apiUrl = `https://www.fotmob.com/api/data/matches?date=${dateStr}&timezone=${encodeURIComponent(timezone)}&ccode3=${ccode3}`;

            // Get x-mas token (required for authentication)
            let xmasToken = null;
            try {
                console.log(`[LeagueMapping] 🔑 Attempting to fetch x-mas token...`);
                const xmasResponse = await Promise.race([
                    axios.get('http://46.101.91.154:6006/', { timeout: 5000 }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('x-mas token fetch timeout')), 8000))
                ]);
                xmasToken = xmasResponse.data?.['x-mas'];
                if (xmasToken) {
                    console.log(`[LeagueMapping] ✅ Got x-mas token`);
                } else {
                    console.warn(`[LeagueMapping] ⚠️ x-mas token response missing token`);
                }
            } catch (xmasError) {
                console.warn(`[LeagueMapping] ⚠️ Could not get x-mas token (${xmasError.message}), trying without it...`);
            }

            const headers = {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.fotmob.com/'
            };

            if (xmasToken) {
                headers['x-mas'] = xmasToken;
            }

            const response = await axios.get(apiUrl, { headers, timeout: 30000 });
            const data = response.data;

            if (!data.leagues || !Array.isArray(data.leagues)) {
                throw new Error('Invalid Fotmob response format');
            }

            console.log(`[LeagueMapping] Found ${data.leagues.length} leagues in Fotmob data`);
            return data.leagues;
        } catch (error) {
            console.error('[LeagueMapping] Error fetching Fotmob matches:', error.message);
            throw error;
        }
    }

    /**
     * Compare countries from Unibet (country name) and Fotmob (ccode)
     * Returns true if countries match, false otherwise
     * Handles International leagues (ccode: "INT") specially
     */
    compareCountries(unibetCountry, fotmobCcode) {
        // If both are missing/empty, consider them as match (unknown countries)
        if (!unibetCountry && !fotmobCcode) return true;
        if (!unibetCountry || !fotmobCcode) return false;
        
        // Normalize both for comparison
        const unibetCountryNorm = (unibetCountry || '').toLowerCase().trim();
        const fotmobCcodeNorm = (fotmobCcode || '').toUpperCase().trim();
        
        // International leagues (Fotmob uses "INT" for international tournaments)
        // Unibet might use "International" or similar
        if (fotmobCcodeNorm === 'INT' || fotmobCcodeNorm === 'INTERNATIONAL') {
            const internationalKeywords = ['international', 'int', 'world', 'global'];
            return internationalKeywords.some(keyword => unibetCountryNorm.includes(keyword));
        }
        
        // Create a mapping from common country names to ISO codes
        // This is based on actual responses, not hardcoded
        const countryNameToCode = {
            'israel': 'ISR',
            'oman': 'OMN',
            'qatar': 'QAT',
            'saudi arabia': 'SAU',
            'egypt': 'EGY',
            'turkey': 'TUR',
            'england': 'ENG',
            'spain': 'ESP',
            'france': 'FRA',
            'germany': 'GER',
            'italy': 'ITA',
            'netherlands': 'NED',
            'portugal': 'POR',
            'brazil': 'BRA',
            'argentina': 'ARG',
            'mexico': 'MEX',
            'usa': 'USA',
            'united states': 'USA',
            'algeria': 'DZA',
            'tunisia': 'TUN',
            'morocco': 'MAR',
            'jordan': 'JOR',
            'iran': 'IRN',
            'uae': 'ARE',
            'united arab emirates': 'ARE'
        };
        
        // Check if Unibet country name maps to Fotmob code
        const expectedCode = countryNameToCode[unibetCountryNorm];
        if (expectedCode && expectedCode === fotmobCcodeNorm) {
            return true;
        }
        
        // Fallback: Check if country name contains the code or vice versa
        // This handles cases where country name might be "Israel" and code is "ISR"
        const countryNameFirst3 = unibetCountryNorm.substring(0, 3).toUpperCase();
        if (countryNameFirst3 === fotmobCcodeNorm) {
            return true;
        }
        
        // If no match found, return false (strict matching)
        return false;
    }

    /**
     * Compare two team names using existing similarity logic
     */
    compareTeamNames(name1, name2) {
        const similarity = calculateNameSimilarity(name1, name2);
        return similarity >= 0.7; // Threshold for match
    }

    /**
     * Compare both teams together (home and away)
     */
    compareTeams(unibetHome, unibetAway, fotmobHome, fotmobAway) {
        // Normal case: home matches home, away matches away
        const normalMatch = 
            this.compareTeamNames(unibetHome, fotmobHome) &&
            this.compareTeamNames(unibetAway, fotmobAway);

        // Swapped case: home matches away, away matches home
        const swappedMatch = 
            this.compareTeamNames(unibetHome, fotmobAway) &&
            this.compareTeamNames(unibetAway, fotmobHome);

        return normalMatch || swappedMatch;
    }

    /**
     * Compare match times (within tolerance)
     */
    compareTime(unibetTime, fotmobTime, toleranceMinutes = 30) {
        try {
            const unibetDate = new Date(unibetTime);
            const fotmobDate = new Date(fotmobTime);

            if (isNaN(unibetDate.getTime()) || isNaN(fotmobDate.getTime())) {
                return false;
            }

            const diffMinutes = Math.abs((unibetDate.getTime() - fotmobDate.getTime()) / (1000 * 60));
            return diffMinutes <= toleranceMinutes;
        } catch (error) {
            return false;
        }
    }

    /**
     * Find matching Fotmob league for Unibet league
     */
    findMatchingFotmobLeague(unibetLeague, fotmobLeagues) {
        console.log(`[LeagueMapping] Finding match for Unibet league: ${unibetLeague.name} (ID: ${unibetLeague.id})`);
        console.log(`[LeagueMapping]   - Unibet country: "${unibetLeague.country || '(empty)'}"`);
        console.log(`[LeagueMapping]   - Unibet englishName: "${unibetLeague.englishName || unibetLeague.name}"`);
        console.log(`[LeagueMapping]   - Unibet league has ${unibetLeague.matches?.length || 0} matches`);

        // PRIORITY 1: Exact country + league name match
        for (const fotmobLeague of fotmobLeagues) {
            const unibetCountry = unibetLeague.country || '';
            const fotmobCcode = fotmobLeague.ccode || '';
            
            // Use parentLeagueName if it's a group, otherwise use name
            const fotmobName = fotmobLeague.isGroup && fotmobLeague.parentLeagueName 
                ? fotmobLeague.parentLeagueName 
                : (fotmobLeague.name || fotmobLeague.parentLeagueName || '');
            const unibetName = unibetLeague.englishName || unibetLeague.name || '';
            
            // Normalize names for comparison
            const fotmobNameNorm = normalizeTeamName(fotmobName);
            const unibetNameNorm = normalizeTeamName(unibetName);
            
            // ✅ ROOT CAUSE FIX: Check international status first
            const isInternational = !unibetCountry || 
                                   unibetCountry.toLowerCase().includes('international') ||
                                   fotmobCcode === 'INT' ||
                                   fotmobCcode === 'INTERNATIONAL' ||
                                   !fotmobCcode;
            
            const countryMatch = this.compareCountries(unibetCountry, fotmobCcode);
            const nameMatch = fotmobNameNorm === unibetNameNorm;
            
            // Detailed logging for debugging
            if (nameMatch || fotmobNameNorm.includes('africa') || unibetNameNorm.includes('africa') || 
                fotmobNameNorm.includes('professional') || unibetNameNorm.includes('professional') ||
                fotmobNameNorm.includes('pro league') || unibetNameNorm.includes('pro league')) {
                console.log(`[LeagueMapping] 🔍 Checking: "${fotmobName}" (FotMob) vs "${unibetName}" (Unibet)`);
                console.log(`[LeagueMapping]   - Normalized: "${fotmobNameNorm}" vs "${unibetNameNorm}"`);
                console.log(`[LeagueMapping]   - Country match: ${countryMatch} (Unibet: "${unibetCountry}", FotMob: "${fotmobCcode}")`);
                console.log(`[LeagueMapping]   - Name match: ${nameMatch}`);
                console.log(`[LeagueMapping]   - Is international: ${isInternational}`);
            }
            
            // ✅ PRIORITY 1: For international leagues OR if names match exactly, accept it
            if (nameMatch && (countryMatch || isInternational)) {
                const fotmobId = String(fotmobLeague.primaryId || fotmobLeague.id);
                console.log(`[LeagueMapping] ✅ Exact name match found: ${fotmobName} (Fotmob ID: ${fotmobId}, Country: ${fotmobCcode})`);
                return {
                    id: fotmobLeague.primaryId || fotmobLeague.id,
                    name: fotmobName,
                    exactMatch: true
                };
            }
        }

        // PRIORITY 2: Match by teams + time (check ALL leagues, prioritize by score)
        console.log(`[LeagueMapping] No exact match found, trying team + time comparison...`);
        console.log(`[LeagueMapping]   - Will check ALL FotMob leagues for team+time matches`);
        
        let bestMatch = null;
        let bestMatchScore = 0;
        let checkedLeagues = 0;
        let leaguesWithMatches = 0;

        for (const fotmobLeague of fotmobLeagues) {
            const unibetCountry = unibetLeague.country || '';
            const fotmobCcode = fotmobLeague.ccode || '';
            
            // Use parentLeagueName if it's a group, otherwise use name
            const fotmobName = fotmobLeague.isGroup && fotmobLeague.parentLeagueName 
                ? fotmobLeague.parentLeagueName 
                : (fotmobLeague.name || fotmobLeague.parentLeagueName || '');
            
            if (!fotmobLeague.matches || !Array.isArray(fotmobLeague.matches) || fotmobLeague.matches.length === 0) {
                continue;
            }
            
            checkedLeagues++;
            
            // ✅ FIX: Check international status for team+time matching
            const isInternational = !unibetCountry || 
                                   unibetCountry.toLowerCase().includes('international') ||
                                   fotmobCcode === 'INT' ||
                                   fotmobCcode === 'INTERNATIONAL' ||
                                   !fotmobCcode;
            
            const countryMatch = this.compareCountries(unibetCountry, fotmobCcode);
            
            // ✅ IMPORTANT: For team+time matching, we check ALL leagues first
            // Then we'll prioritize matches with same country, but won't skip if country doesn't match
            // This allows "Professional League" (Saudi) to match "Saudi Pro League" (Saudi) via teams+time

            let matchCount = 0;
            let totalScore = 0;
            let perfectMatches = 0; // Teams + time both match
            let teamOnlyMatches = 0; // Teams match but time doesn't

            for (const fotmobMatch of fotmobLeague.matches) {
                for (const unibetMatch of unibetLeague.matches) {
                    // Compare teams
                    const teamsMatch = this.compareTeams(
                        unibetMatch.homeName,
                        unibetMatch.awayName,
                        fotmobMatch.home?.name || fotmobMatch.home?.longName,
                        fotmobMatch.away?.name || fotmobMatch.away?.longName
                    );

                    if (teamsMatch) {
                        // Compare time
                        const fotmobTime = fotmobMatch.status?.utcTime || fotmobMatch.time;
                        const timeMatch = this.compareTime(unibetMatch.start, fotmobTime);

                        if (timeMatch) {
                            matchCount++;
                            perfectMatches++;
                            totalScore += 1.0; // Perfect match (teams + time)
                        } else {
                            matchCount++;
                            teamOnlyMatches++;
                            totalScore += 0.5; // Teams match but time doesn't
                        }
                    }
                }
            }

            // Calculate match score (percentage of matches that matched)
            if (matchCount > 0) {
                leaguesWithMatches++;
                const score = totalScore / Math.max(unibetLeague.matches.length, fotmobLeague.matches.length);
                
                // ✅ PRIORITY LOGIC: 
                // - If country matches, use standard threshold (0.5)
                // - If country doesn't match BUT we have perfect matches (teams+time), still consider it
                //   but require higher threshold (0.7) to avoid false positives
                const requiredScore = (countryMatch || isInternational) ? 0.5 : 0.7;
                
                if (score > bestMatchScore && score >= requiredScore) {
                    // Additional check: if country doesn't match, require at least some perfect matches
                    if (!countryMatch && !isInternational && perfectMatches === 0) {
                        continue; // Skip if no perfect matches and country doesn't match
                    }
                    
                    bestMatchScore = score;
                    bestMatch = {
                        id: fotmobLeague.primaryId || fotmobLeague.id,
                        name: fotmobName,
                        exactMatch: false,
                        matchScore: score,
                        matchCount,
                        perfectMatches,
                        teamOnlyMatches,
                        countryMatch
                    };
                    
                    console.log(`[LeagueMapping]   📊 Found candidate: "${fotmobName}" (Score: ${score.toFixed(2)}, Perfect: ${perfectMatches}, Team-only: ${teamOnlyMatches}, Country: ${countryMatch ? '✅' : '❌'})`);
                }
            }
        }

        console.log(`[LeagueMapping]   📈 Team+Time summary: Checked ${checkedLeagues} leagues with matches, ${leaguesWithMatches} had team matches`);

        if (bestMatch) {
            console.log(`[LeagueMapping] ✅ Team+time match found: ${bestMatch.name} (Fotmob ID: ${bestMatch.id}, Score: ${bestMatch.matchScore.toFixed(2)}, Perfect matches: ${bestMatch.perfectMatches})`);
            return {
                id: bestMatch.id,
                name: bestMatch.name,
                exactMatch: false
            };
        }

        console.log(`[LeagueMapping] ❌ No match found for Unibet league: ${unibetLeague.name}`);
        return null;
    }

    /**
     * Add new mapping to CSV files
     */
    async addMappingToCsv(mapping) {
        const matchType = mapping.exactMatch ? 'Exact Match' : 'Different Name';
        const row = [
            mapping.unibetId,
            `"${mapping.unibetName}"`,
            mapping.fotmobId,
            `"${mapping.fotmobName}"`,
            matchType,
            mapping.country || ''
        ].join(',');

        try {
            // ✅ FIX: Use async file operations
            const ensureNewline = async (filePath) => {
                if (fs.existsSync(filePath)) {
                    const content = await fs.promises.readFile(filePath, 'utf8');
                    const trimmed = content.replace(/\n+$/, '');
                    if (trimmed && !trimmed.endsWith('\n')) {
                        await fs.promises.writeFile(filePath, trimmed + '\n', 'utf8');
                    } else if (trimmed) {
                        await fs.promises.writeFile(filePath, trimmed + '\n', 'utf8');
                    }
                }
            };

            // Append to both CSV files
            if (fs.existsSync(this.clientCsvPath)) {
                await ensureNewline(this.clientCsvPath);
                await fs.promises.appendFile(this.clientCsvPath, row + '\n', 'utf8');
                console.log(`[LeagueMapping] ✅ Added to client CSV: ${mapping.unibetName} → ${mapping.fotmobName}`);
            } else {
                console.warn(`[LeagueMapping] ⚠️ Client CSV not found: ${this.clientCsvPath}`);
            }

            if (fs.existsSync(this.serverCsvPath)) {
                await ensureNewline(this.serverCsvPath);
                await fs.promises.appendFile(this.serverCsvPath, row + '\n', 'utf8');
                console.log(`[LeagueMapping] ✅ Added to server CSV: ${mapping.unibetName} → ${mapping.fotmobName}`);
            } else {
                console.warn(`[LeagueMapping] ⚠️ Server CSV not found: ${this.serverCsvPath}`);
            }

            // Also add to existing mappings cache
            this.existingMappings.set(mapping.unibetId, {
                unibetId: mapping.unibetId,
                unibetName: mapping.unibetName,
                fotmobId: mapping.fotmobId,
                fotmobName: mapping.fotmobName,
                matchType,
                country: mapping.country || ''
            });
            // Track Fotmob ID
            this.existingFotmobIds.add(mapping.fotmobId);

            return {
                success: true,
                mapping: {
                    unibetId: mapping.unibetId,
                    unibetName: mapping.unibetName,
                    fotmobId: mapping.fotmobId,
                    fotmobName: mapping.fotmobName,
                    matchType: matchType,
                    country: mapping.country || ''
                }
            };
        } catch (error) {
            console.error(`[LeagueMapping] ❌ Error adding mapping to CSV:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Normalize a string to URL slug format
     * @param {string} str - String to normalize
     * @returns {string} - Normalized slug
     */
    normalizeToSlug(str) {
        if (!str) return '';
        
        return str
            .toLowerCase()
            .replace(/[''"]/g, '_') // Replace apostrophes/quotes with underscores FIRST
            .replace(/[^a-z0-9\s_-]/g, '') // Remove other special chars (but keep spaces, hyphens, underscores)
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/-+/g, '_') // Replace hyphens with underscores
            .replace(/_+/g, '_') // Replace multiple underscores with single
            .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
            .trim();
    }

    /**
     * Construct Unibet URL from league data
     * @param {Object} league - League object with unibetName and country
     * @returns {string} - Constructed Unibet URL
     */
    constructUnibetUrl(league) {
        const baseUrl = 'https://www.unibet.com.au/betting/sports/filter/football';
        
        // For international leagues (no country or country is "International")
        if (!league.country || league.country === 'International' || league.country === 'Unknown') {
            const leagueSlug = this.normalizeToSlug(league.unibetName);
            return `${baseUrl}/${leagueSlug}`;
        }
        
        // ✅ FIX: If country and league name are the same (e.g., "Africa Cup of Nations"),
        // use only the league slug, not both
        const countrySlug = this.normalizeToSlug(league.country);
        const leagueSlug = this.normalizeToSlug(league.unibetName);
        
        // Normalize both for comparison
        const countryNorm = normalizeTeamName(league.country || '');
        const leagueNorm = normalizeTeamName(league.unibetName || '');
        
        // If country and league name are essentially the same, use only league slug
        if (countryNorm === leagueNorm || countrySlug === leagueSlug) {
            return `${baseUrl}/${leagueSlug}`;
        }
        
        // For country-based leagues (different country and league)
        return `${baseUrl}/${countrySlug}/${leagueSlug}`;
    }

    /**
     * Verify if a Unibet URL is valid by checking if it returns data
     * @param {string} url - URL to verify
     * @returns {Promise<boolean>} - True if URL is valid
     */
    async verifyUnibetUrl(url) {
        try {
            // Convert webpage URL to API URL
            const urlParts = url.split('/');
            const filterIndex = urlParts.findIndex(part => part === 'filter');
            if (filterIndex === -1) return false;
            
            const matchesPath = urlParts.slice(filterIndex + 1).join('/');
            const apiUrl = `https://www.unibet.com.au/sportsbook-feeds/views/filter/${matchesPath}/all/matches?includeParticipants=true&useCombined=true&ncid=${Date.now()}`;
            
            const response = await axios.get(apiUrl, {
                headers: {
                    'accept': '*/*',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'referer': url
                },
                timeout: 10000,
                validateStatus: (status) => status < 500 // Don't throw on 404
            });
            
            // If we get valid JSON with data, URL is valid
            if (response.status === 200 && response.data && response.data.layout) {
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Add a league to league_mapping_with_urls.csv
     * @param {Object} mapping - Mapping object with all league data
     * @param {string} url - Unibet URL
     * @returns {boolean} - True if successful
     */
    async addToUrlsCsv(mapping, url) {
        try {
            console.log(`[LeagueMapping] 🔍 Attempting to add to URLs CSV:`);
            console.log(`[LeagueMapping]   - Path: ${this.urlsCsvPath}`);
            console.log(`[LeagueMapping]   - Path exists: ${fs.existsSync(this.urlsCsvPath)}`);
            console.log(`[LeagueMapping]   - League: ${mapping.unibetName} (ID: ${mapping.unibetId})`);
            
            if (!fs.existsSync(this.urlsCsvPath)) {
                console.error(`[LeagueMapping] ❌ URLs CSV not found at: ${this.urlsCsvPath}`);
                console.error(`[LeagueMapping] ❌ Current working directory: ${process.cwd()}`);
                console.error(`[LeagueMapping] ❌ __dirname: ${__dirname}`);
                return false;
            }

            // Construct Fotmob URL from Fotmob ID
            const fotmobUrl = mapping.fotmobId 
                ? `https://www.fotmob.com/leagues/${mapping.fotmobId}`
                : '';

            // Create row: Unibet_ID,Unibet_URL,Unibet_Name,Fotmob_URL,Fotmob_Name,Match_Type,Country/Region
            const row = [
                mapping.unibetId,
                url,
                mapping.unibetName,
                fotmobUrl,
                mapping.fotmobName,
                mapping.matchType || '',
                mapping.country || ''
            ].join(',');

            // ✅ FIX: Use async file operations
            const content = await fs.promises.readFile(this.urlsCsvPath, 'utf8');
            console.log(`[LeagueMapping] 📄 Current file size: ${content.length} bytes`);
            console.log(`[LeagueMapping] 📄 Current file lines: ${content.split('\n').length}`);
            
            // Check if entry already exists
            if (content.includes(mapping.unibetId)) {
                console.log(`[LeagueMapping] ⚠️ League ID ${mapping.unibetId} already exists in URLs CSV - skipping`);
                return false;
            }
            
            // Ensure file ends with newline before appending
            const trimmed = content.replace(/\n+$/, '');
            const finalContent = trimmed + (trimmed.endsWith('\n') ? '' : '\n') + row + '\n';
            
            // Write to file
            await fs.promises.writeFile(this.urlsCsvPath, finalContent, 'utf8');
            
            // Verify write
            const verifyContent = await fs.promises.readFile(this.urlsCsvPath, 'utf8');
            const verifyLines = verifyContent.split('\n').length;
            console.log(`[LeagueMapping] ✅ File written successfully`);
            console.log(`[LeagueMapping] ✅ New file size: ${verifyContent.length} bytes`);
            console.log(`[LeagueMapping] ✅ New file lines: ${verifyLines}`);
            console.log(`[LeagueMapping] ✅ Added to URLs CSV: ${mapping.unibetName} → ${url}`);
            console.log(`[LeagueMapping] ✅ Row added: ${row}`);
            
            return true;
        } catch (error) {
            console.error(`[LeagueMapping] ❌ Error adding to URLs CSV:`, error);
            console.error(`[LeagueMapping] ❌ Error stack:`, error.stack);
            console.error(`[LeagueMapping] ❌ Path attempted: ${this.urlsCsvPath}`);
            return false;
        }
    }

    /**
     * Sync newly added leagues to league_mapping_with_urls.csv
     * @param {Array} newMappings - Array of mapping objects to sync
     * @returns {Promise<Object>} - Sync result
     */
    async syncLeagueUrlsForNewMappings(newMappings) {
        if (!newMappings || newMappings.length === 0) {
            return { success: true, added: 0, skipped: 0 };
        }

        console.log(`[LeagueMapping] 🔄 Syncing ${newMappings.length} new league(s) to URLs CSV...`);
        
        let added = 0;
        let skipped = 0;
        const skippedLeagues = [];

        for (const mapping of newMappings) {
            try {
                // Construct URL
                const constructedUrl = this.constructUnibetUrl(mapping);
                console.log(`[LeagueMapping] 🔍 Verifying URL for ${mapping.unibetName}: ${constructedUrl}`);
                
                // Verify URL
                const isValid = await this.verifyUnibetUrl(constructedUrl);
                
                if (isValid) {
                    // Add to URLs CSV
                    const success = await this.addToUrlsCsv(mapping, constructedUrl);
                    if (success) {
                        added++;
                    } else {
                        skipped++;
                        skippedLeagues.push(mapping.unibetName);
                    }
                } else {
                    skipped++;
                    skippedLeagues.push(mapping.unibetName);
                    console.log(`[LeagueMapping] ⚠️ URL verification failed for ${mapping.unibetName} - skipping`);
                }
            } catch (error) {
                console.error(`[LeagueMapping] ❌ Error syncing ${mapping.unibetName}:`, error.message);
                skipped++;
                skippedLeagues.push(mapping.unibetName);
            }
        }

        console.log(`[LeagueMapping] ✅ URL Sync Summary: ${added} added, ${skipped} skipped`);
        if (skippedLeagues.length > 0) {
            console.log(`[LeagueMapping] ⚠️ Skipped leagues: ${skippedLeagues.join(', ')}`);
        }

        return {
            success: true,
            added,
            skipped,
            skippedLeagues
        };
    }

    /**
     * Generate leagueUtils.js file from CSV mappings
     */
    async generateLeagueUtils() {
        console.log('[LeagueMapping] 🔄 Generating leagueUtils.js from CSV...');
        
        try {
            // Read CSV file
            if (!fs.existsSync(this.clientCsvPath)) {
                console.warn('[LeagueMapping] ⚠️ Client CSV not found, cannot generate leagueUtils.js');
                return false;
            }

            // ✅ FIX: Use async readFile
            const csvContent = await fs.promises.readFile(this.clientCsvPath, 'utf8');
            const lines = csvContent.split('\n').slice(1); // Skip header

            const mappings = [];
            
            for (const line of lines) {
                if (!line.trim() || line.startsWith(',')) continue;
                
                const [unibetId, unibetName, fotmobId, fotmobName, matchType, country] = 
                    line.split(',').map(s => s.trim().replace(/"/g, ''));

                if (unibetId && fotmobId) {
                    mappings.push({
                        unibetId,
                        unibetName: unibetName || 'Unknown',
                        fotmobId,
                        fotmobName: fotmobName || 'Unknown',
                        country: country || ''
                    });
                }
            }

            // Sort by league name for better organization
            mappings.sort((a, b) => {
                const nameA = (a.unibetName || '').toLowerCase();
                const nameB = (b.unibetName || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });

            // Generate the file content
            let fileContent = `// Simple utility to get Fotmob logo URL from Unibet league ID
// Based on league_mapping_clean.csv
// Auto-generated - DO NOT EDIT MANUALLY (will be overwritten by league mapping job)

const UNIBET_TO_FOTMOB_MAPPING = {
`;

            // Add mappings with comments
            for (const mapping of mappings) {
                const comment = mapping.country 
                    ? `${mapping.unibetName} (${mapping.country})`
                    : mapping.unibetName;
                fileContent += `  '${mapping.unibetId}': '${mapping.fotmobId}', // ${comment}\n`;
            }

            fileContent += `};

export const getFotmobLogoByUnibetId = (unibetId) => {
  if (!unibetId) {
    return null;
  }
  
  const fotmobId = UNIBET_TO_FOTMOB_MAPPING[String(unibetId)];
  
  if (!fotmobId) {
    return null;
  }
  
  const url = \`https://images.fotmob.com/image_resources/logo/leaguelogo/\${fotmobId}.png\`;
  return url;
};
`;

            // ✅ FIX: Use async writeFile
            const clientLeagueUtilsPath = path.join(__dirname, '../../../client/lib/leagueUtils.js');
            await fs.promises.writeFile(clientLeagueUtilsPath, fileContent, 'utf8');
            
            console.log(`[LeagueMapping] ✅ Generated leagueUtils.js with ${mappings.length} mappings`);
            console.log(`[LeagueMapping] 📁 Saved to: ${clientLeagueUtilsPath}`);
            
            return true;
        } catch (error) {
            console.error('[LeagueMapping] ❌ Error generating leagueUtils.js:', error);
            return false;
        }
    }

    /**
     * Main execution method
     */
    async execute() {
        const startTime = Date.now();
        console.log('[LeagueMapping] ========================================');
        console.log('[LeagueMapping] 🚀 Starting League Mapping Auto-Update');
        console.log('[LeagueMapping] ========================================');
        console.log(`[LeagueMapping] ⏰ Start time: ${new Date().toISOString()}`);

        try {
            // 1. Load existing mappings
            this.loadExistingMappings();

            // 2. Get today's date
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
            console.log(`[LeagueMapping] Processing date: ${dateStr}`);

            // 3. Fetch Unibet matches
            const unibetLeagues = await this.fetchUnibetMatches(dateStr);
            console.log(`[LeagueMapping] Found ${unibetLeagues.length} Unibet leagues`);

            // 4. Fetch Fotmob matches
            const fotmobLeagues = await this.fetchFotmobMatches(dateStr);
            console.log(`[LeagueMapping] Found ${fotmobLeagues.length} Fotmob leagues`);

            // 5. Process each Unibet league
            let newMappingsCount = 0;
            let skippedCount = 0;
            let notFoundCount = 0;

            for (const unibetLeague of unibetLeagues) {
                // Skip Esports leagues
                const leagueNameLower = (unibetLeague.name || '').toLowerCase();
                if (leagueNameLower.includes('esports') || leagueNameLower.includes('esport')) {
                    console.log(`[LeagueMapping] ⏭️ Skipping Esports league: ${unibetLeague.name}`);
                    skippedCount++;
                    continue;
                }

                // Skip if already in CSV (by Unibet ID)
                if (this.existingMappings.has(unibetLeague.id)) {
                    console.log(`[LeagueMapping] ⚠️ Skipping ${unibetLeague.name} - Unibet ID ${unibetLeague.id} already exists in CSV`);
                    skippedCount++;
                    continue;
                }

                // Skip if no matches (can't compare)
                if (!unibetLeague.matches || unibetLeague.matches.length === 0) {
                    console.log(`[LeagueMapping] ⚠️ Skipping ${unibetLeague.name} - no matches`);
                    skippedCount++;
                    continue;
                }

                // Find matching Fotmob league
                const fotmobLeague = this.findMatchingFotmobLeague(unibetLeague, fotmobLeagues);

                if (fotmobLeague) {
                    const fotmobId = String(fotmobLeague.id);
                    
                    // Check if this Fotmob ID is already mapped to any Unibet league
                    if (this.existingFotmobIds.has(fotmobId)) {
                        console.log(`[LeagueMapping] ⚠️ Skipping ${unibetLeague.name} - Fotmob ID ${fotmobId} already mapped to another league`);
                        skippedCount++;
                        continue;
                    }
                    
                    // Double check: Verify the combination doesn't exist
                    // (This should already be covered by Unibet ID check, but extra safety)
                    const existingMapping = this.existingMappings.get(unibetLeague.id);
                    if (existingMapping && existingMapping.fotmobId === fotmobId) {
                        console.log(`[LeagueMapping] ⚠️ Skipping ${unibetLeague.name} - Combination (Unibet ID: ${unibetLeague.id}, Fotmob ID: ${fotmobId}) already exists`);
                        skippedCount++;
                        continue;
                    }
                    
                    // Add to CSV
                    const mappingData = {
                        unibetId: unibetLeague.id,
                        unibetName: unibetLeague.englishName || unibetLeague.name, // Use englishName
                        fotmobId: fotmobId,
                        fotmobName: fotmobLeague.name, // Already using parentLeagueName for groups
                        exactMatch: fotmobLeague.exactMatch,
                        country: unibetLeague.country || ''
                    };

                    const result = await this.addMappingToCsv(mappingData);

                    if (result.success) {
                        newMappingsCount++;
                        // Track the new Fotmob ID
                        this.existingFotmobIds.add(fotmobId);
                        
                        // ✅ NEW: Sync to URLs CSV
                        try {
                            await this.syncLeagueUrlsForNewMappings([result.mapping]);
                            console.log(`[LeagueMapping] ✅ Synced ${result.mapping.unibetName} to URLs CSV`);
                        } catch (error) {
                            console.warn(`[LeagueMapping] ⚠️ Failed to sync ${result.mapping.unibetName} to URLs CSV:`, error.message);
                            // Don't fail the whole job if URL sync fails
                        }
                    }
                } else {
                    notFoundCount++;
                }
            }

            console.log('[LeagueMapping] ========================================');
            console.log('[LeagueMapping] ✅ League Mapping Auto-Update Completed');
            console.log('[LeagueMapping] ========================================');
            console.log(`[LeagueMapping] Summary:`);
            console.log(`  - New mappings added: ${newMappingsCount}`);
            console.log(`  - Already exists (skipped): ${skippedCount}`);
            console.log(`  - No match found: ${notFoundCount}`);
            console.log('[LeagueMapping] ========================================');
            
            // Generate leagueUtils.js from updated CSV
            await this.generateLeagueUtils();
            
            console.log('[LeagueMapping] ========================================');
            console.log(''); // Empty line for better readability

            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            const result = {
                success: true,
                newMappings: newMappingsCount,
                skipped: skippedCount,
                notFound: notFoundCount,
                duration: `${duration}s`
            };
            
            console.log(`[LeagueMapping] ⏰ Total execution time: ${duration} seconds`);
            console.log(`[LeagueMapping] ⏰ End time: ${new Date().toISOString()}`);
            
            // Ensure we return immediately without any blocking operations
            return result;
        } catch (error) {
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            console.error('[LeagueMapping] ========================================');
            console.error('[LeagueMapping] ❌ League Mapping Auto-Update Failed');
            console.error('[LeagueMapping] ========================================');
            console.error(`[LeagueMapping] ⏰ Failed after: ${duration} seconds`);
            console.error(`[LeagueMapping] ⏰ Error time: ${new Date().toISOString()}`);
            console.error('[LeagueMapping] Error:', error.message || error);
            console.error('[LeagueMapping] Stack:', error.stack);
            throw error;
        }
    }
}

export default LeagueMappingAutoUpdate;


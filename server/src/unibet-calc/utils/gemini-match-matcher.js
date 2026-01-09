import { GoogleGenAI } from '@google/genai';
import { waitForRateLimit } from '../../utils/geminiRateLimiter.js';

/**
 * Use Gemini AI to match teams when normal matching fails
 * This is a fallback when similarity score is too low but matches exist
 */
export async function findMatchWithGemini(betHomeName, betAwayName, betDate, leagueName, availableMatches) {
    // Get both API keys
    const geminiApiKey1 = process.env.GEMINI_API_KEY_1;
    const geminiApiKey2 = process.env.GEMINI_API_KEY_2;
    
    if (!geminiApiKey1 && !geminiApiKey2) {
        console.log(`   ⚠️ No Gemini API keys found (GEMINI_API_KEY_1 or GEMINI_API_KEY_2), skipping Gemini fallback`);
        return null;
    }

    // Helper function to check if error is quota-related
    const isQuotaError = (error) => {
        if (!error) return false;
        const errorMessage = (error.message || '').toLowerCase();
        const errorCode = error.code || error.status || error.statusCode;
        
        return (
            errorCode === 429 ||
            errorCode === 'RESOURCE_EXHAUSTED' ||
            errorMessage.includes('quota') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('resource_exhausted')
        );
    };

    // Try with first key, then fallback to second key if quota error
    const apiKeys = [
        { key: geminiApiKey1, name: 'GEMINI_API_KEY_1' },
        { key: geminiApiKey2, name: 'GEMINI_API_KEY_2' }
    ].filter(k => k.key); // Only include keys that exist

    if (apiKeys.length === 0) {
        console.log(`   ⚠️ No valid Gemini API keys found, skipping Gemini fallback`);
        return null;
    }

    let lastError = null;

    for (let i = 0; i < apiKeys.length; i++) {
        const { key: geminiApiKey, name: keyName } = apiKeys[i];
        
        try {
            // ✅ RATE LIMIT: Wait before making Gemini API call
            await waitForRateLimit();
            
            console.log(`   🤖 Using Gemini AI fallback (${keyName}) to find match: "${betHomeName}" vs "${betAwayName}"`);
            
            // Format available matches for prompt
            if (!availableMatches || availableMatches.length === 0) {
                console.log(`   ⚠️ No matches available for Gemini matching`);
                return null;
            }
            
            console.log(`   📋 Found ${availableMatches.length} matches in Fotmob data for Gemini matching`);
            
            // Format matches list for prompt
            const matchesList = availableMatches.map((match, idx) => {
                const matchDate = new Date(match.status?.utcTime || match.time);
                const homeName = match.home?.name || 'Unknown';
                const awayName = match.away?.name || 'Unknown';
                return `${idx + 1}. Match ID: ${match.id}\n   Teams: "${homeName}" vs "${awayName}"\n   Date: ${matchDate.toISOString()}`;
            }).join('\n\n');
            
            // Initialize Gemini with current API key
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            
            // Create prompt - Simple and direct
            const prompt = `Bet information:
- Home team: "${betHomeName}"
- Away team: "${betAwayName}"
- Match date: ${betDate.toISOString()}
- League: ${leagueName}

Available matches from Fotmob (same league, similar date):

${matchesList}

Task: Find the match that corresponds to "${betHomeName}" vs "${betAwayName}".
Team names might be written differently (abbreviations, different languages, alternative names, etc.), but it's the same match.

Return ONLY the match ID number if you find a match, or "NO_MATCH" if not found.

Example response: 1234567`;

            console.log(`   📤 Sending request to Gemini Flash 2.5 (${keyName})...`);
            // Use new API: ai.models.generateContent
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            
            // Extract text from response (new API structure)
            const text = (response.text || '').trim();
            
            console.log(`   📥 Gemini response (${keyName}): "${text}"`);
            
            // Parse response
            if (text === 'NO_MATCH' || text.toLowerCase().includes('no match')) {
                console.log(`   ❌ Gemini could not find a match`);
                return null;
            }
            
            // Try to extract match ID from response
            const matchIdMatch = text.match(/\d+/);
            if (matchIdMatch) {
                const matchedMatchId = Number(matchIdMatch[0]);
                const matchedMatch = availableMatches.find(m => m.id === matchedMatchId || String(m.id) === String(matchedMatchId));
                
                if (matchedMatch) {
                    console.log(`   ✅ Gemini matched (${keyName}): "${matchedMatch.home?.name || 'Unknown'}" vs "${matchedMatch.away?.name || 'Unknown'}" (ID: ${matchedMatchId})`);
                    return matchedMatch;
                } else {
                    console.log(`   ⚠️ Gemini returned ID ${matchedMatchId} but match not found in our list`);
                    return null;
                }
            }
            
            console.log(`   ⚠️ Could not parse match ID from Gemini response`);
            return null;
            
        } catch (error) {
            lastError = error;
            console.error(`   ❌ Gemini API error (${keyName}):`, error.message || error);
            
            // If quota error and we have another key, try next key
            if (isQuotaError(error) && i < apiKeys.length - 1) {
                console.log(`   ⚠️ Quota error with ${keyName}, trying next API key...`);
                continue;
            }
            
            // If not quota error or last key, break
            if (!isQuotaError(error)) {
                break;
            }
        }
    }
    
    // If we get here, all API keys failed
    if (lastError) {
        console.error(`   ❌ All Gemini API keys failed. Last error:`, lastError.message || lastError);
    }
    
    return null;
}

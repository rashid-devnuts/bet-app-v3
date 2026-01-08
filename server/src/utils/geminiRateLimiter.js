/**
 * Global rate limiter for Gemini API calls
 * Ensures minimum delay between requests to prevent 503 "overloaded" errors
 */

let lastGeminiCallTime = 0;
const MIN_DELAY_MS = 60000; // 60 seconds (1 minute)

/**
 * Wait if necessary to ensure minimum delay between Gemini API calls
 * @returns {Promise<void>}
 */
export async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - lastGeminiCallTime;
    
    if (timeSinceLastCall < MIN_DELAY_MS) {
        const waitTime = MIN_DELAY_MS - timeSinceLastCall;
        console.log(`[GeminiRateLimiter] ⏳ Waiting ${waitTime}ms before next Gemini API call (rate limit: ${MIN_DELAY_MS}ms)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastGeminiCallTime = Date.now();
}

/**
 * Reset the rate limiter (useful for testing or manual resets)
 */
export function resetRateLimiter() {
    lastGeminiCallTime = 0;
}

export { MIN_DELAY_MS };

import "dotenv/config";
import connectDB from '../config/database.js';
import LeagueMapping from '../models/LeagueMapping.js';

/**
 * Update existing league mappings with Unibet URLs
 * This script updates records that have empty unibetUrl
 */
async function updateUnibetUrls() {
    try {
        console.log('🔄 Starting Unibet URL update for existing mappings...');
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        // Find all mappings with empty unibetUrl
        const mappingsWithoutUrl = await LeagueMapping.find({
            $or: [
                { unibetUrl: '' },
                { unibetUrl: { $exists: false } }
            ]
        });
        
        console.log(`📊 Found ${mappingsWithoutUrl.length} mappings without Unibet URL`);
        
        if (mappingsWithoutUrl.length === 0) {
            console.log('✅ All mappings already have Unibet URLs!');
            process.exit(0);
        }
        
        // Normalize to slug format (same logic as constructUnibetUrl)
        const normalizeToSlug = (str) => {
            if (!str) return '';
            return str
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[''"]/g, '')
                .replace(/[^a-z0-9\s()-]/g, '') // Keep parentheses, spaces, hyphens
                .replace(/\s+/g, '_') // Replace spaces with underscore
                .replace(/\(/g, '_') // ✅ ONE-LINER: Replace ( with _ (creates __ when after space)
                .replace(/\)/g, '_') // ✅ ONE-LINER: Replace ) with _
                .replace(/([^_])_{3,}([^_])/g, '$1_$2') // Collapse 3+ underscores to single
                .replace(/^_+/, '') // Remove only leading underscores, keep trailing ones
                .trim();
        };
        
        let updated = 0;
        let failed = 0;
        
        for (const mapping of mappingsWithoutUrl) {
            try {
                const baseUrl = 'https://www.unibet.com.au/betting/sports/filter/football';
                let unibetUrl = '';
                
                // For international leagues (no country or country is "International")
                if (!mapping.country || mapping.country === 'International' || mapping.country === 'Unknown') {
                    const leagueSlug = normalizeToSlug(mapping.unibetName);
                    unibetUrl = `${baseUrl}/${leagueSlug}`;
                } else {
                    const countrySlug = normalizeToSlug(mapping.country);
                    const leagueSlug = normalizeToSlug(mapping.unibetName);
                    
                    // If country and league name are the same, use only league slug
                    if (countrySlug === leagueSlug) {
                        unibetUrl = `${baseUrl}/${leagueSlug}`;
                    } else {
                        unibetUrl = `${baseUrl}/${countrySlug}/${leagueSlug}`;
                    }
                }
                
                // Update the mapping
                await LeagueMapping.updateOne(
                    { _id: mapping._id },
                    { $set: { unibetUrl: unibetUrl } }
                );
                
                updated++;
                console.log(`✅ Updated: ${mapping.unibetName} → ${unibetUrl}`);
                
            } catch (error) {
                failed++;
                console.error(`❌ Failed to update ${mapping.unibetName}: ${error.message}`);
            }
        }
        
        console.log('\n📊 Update Summary:');
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   📈 Total processed: ${mappingsWithoutUrl.length}`);
        
        console.log('\n✅ Update completed!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Update failed:', error);
        process.exit(1);
    }
}

// Run update
updateUnibetUrls();

import "dotenv/config";
import connectDB from '../config/database.js';
import Bet from '../models/Bet.js';

/**
 * Script to set maxRetryCount for cancelled bets (for testing the processCancelledBets job)
 */
async function setRetryCountForCancelledBets() {
    try {
        console.log('🔄 Starting script to set maxRetryCount for cancelled bets...');
        
        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB');
        
        // Find all cancelled/canceled bets
        const cancelledBets = await Bet.find({
            status: { $in: ['cancelled', 'canceled'] }
        });
        
        console.log(`📋 Found ${cancelledBets.length} cancelled/canceled bets in database`);
        
        if (cancelledBets.length === 0) {
            console.log('ℹ️  No cancelled bets found. Exiting.');
            process.exit(0);
        }
        
        let updated = 0;
        let skipped = 0;
        
        // Update each cancelled bet to set maxRetryCount = 20
        for (const bet of cancelledBets) {
            try {
                const currentMaxRetry = bet.maxRetryCount || 0;
                
                // Update bet with maxRetryCount = 20
                await Bet.findByIdAndUpdate(bet._id, {
                    $set: {
                        maxRetryCount: 20,
                        retryCount: 0
                    }
                });
                
                updated++;
                console.log(`✅ Updated bet ${bet._id}: maxRetryCount ${currentMaxRetry} → 20, retryCount = 0`);
                
            } catch (error) {
                console.error(`❌ Error updating bet ${bet._id}:`, error.message);
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`   - Total cancelled bets: ${cancelledBets.length}`);
        console.log(`   - Updated: ${updated}`);
        console.log(`   - Skipped: ${skipped} (already had maxRetryCount > 0)`);
        console.log(`✅ Script completed successfully!`);
        
        // Verify: Check updated bets
        const updatedBets = await Bet.find({
            status: { $in: ['cancelled', 'canceled'] },
            maxRetryCount: { $gt: 0 }
        });
        
        console.log(`\n🔍 Verification: Found ${updatedBets.length} cancelled bets with maxRetryCount > 0`);
        if (updatedBets.length > 0) {
            console.log('📋 Updated bets:');
            updatedBets.forEach((bet, index) => {
                console.log(`   ${index + 1}. Bet ID: ${bet._id}, Status: ${bet.status}, maxRetryCount: ${bet.maxRetryCount}, retryCount: ${bet.retryCount}`);
            });
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error in script:', error);
        console.error('❌ Stack:', error.stack);
        process.exit(1);
    }
}

// Run the script
setRetryCountForCancelledBets();

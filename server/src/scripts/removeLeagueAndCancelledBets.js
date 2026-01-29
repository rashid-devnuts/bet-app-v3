import "dotenv/config";
import connectDB from '../config/database.js';
import LeagueMapping from '../models/LeagueMapping.js';
import FailedLeagueMappingAttempt from '../models/FailedLeagueMappingAttempt.js';
import Bet from '../models/Bet.js';
import mongoose from 'mongoose';

/**
 * Remove a specific league from LeagueMapping and move it to FailedLeagueMappingAttempt
 * Also removes all cancelled/canceled bets related to this league
 * 
 * Usage: node src/scripts/removeLeagueAndCancelledBets.js [leagueId] [--force]
 * Example: node src/scripts/removeLeagueAndCancelledBets.js 696117819dfb6289cdae8908 --force
 */
async function removeLeagueAndCancelledBets() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        let leagueId = null;
        let force = false;

        for (const arg of args) {
            if (arg === '--force') {
                force = true;
            } else if (mongoose.Types.ObjectId.isValid(arg)) {
                leagueId = arg;
            }
        }

        if (!leagueId) {
            console.error('❌ Error: Please provide a valid league _id');
            console.log('Usage: node src/scripts/removeLeagueAndCancelledBets.js [leagueId] [--force]');
            console.log('Example: node src/scripts/removeLeagueAndCancelledBets.js 696117819dfb6289cdae8908 --force');
            process.exit(1);
        }

        console.log('🔄 Starting league removal and bet cleanup...');
        console.log(`📋 League ID: ${leagueId}\n`);

        // Connect to database
        await connectDB();
        console.log('✅ Connected to MongoDB\n');

        // Find the league
        const league = await LeagueMapping.findById(leagueId);
        
        if (!league) {
            console.error(`❌ League with _id ${leagueId} not found in LeagueMapping collection`);
            process.exit(1);
        }

        console.log('📋 Found league:');
        console.log('─'.repeat(100));
        console.log(`   _id: ${league._id}`);
        console.log(`   unibetId: ${league.unibetId}`);
        console.log(`   unibetName: "${league.unibetName}"`);
        console.log(`   fotmobId: ${league.fotmobId}`);
        console.log(`   fotmobName: "${league.fotmobName}"`);
        console.log(`   matchType: ${league.matchType}`);
        console.log(`   country: ${league.country || 'N/A'}`);
        console.log(`   isVerified: ${league.isVerified}`);
        console.log(`   createdAt: ${league.createdAt.toISOString()}`);
        console.log('─'.repeat(100));
        console.log('');

        // Check if league already exists in FailedLeagueMappingAttempt
        const existingFailed = await FailedLeagueMappingAttempt.findOne({ unibetId: league.unibetId });
        if (existingFailed) {
            console.log(`⚠️  Warning: League with unibetId ${league.unibetId} already exists in FailedLeagueMappingAttempt`);
            console.log(`   Will update existing record instead of creating new one\n`);
        }

        // Find all cancelled/canceled bets related to this league
        // For single bets: check unibetMeta.leagueId
        // For combo bets: check combination[].unibetMeta.leagueId
        const leagueIdString = String(league.unibetId);
        
        console.log(`🔍 Searching for cancelled/canceled bets with leagueId: ${leagueIdString}...`);
        
        // Find single bets (no combination array or empty combination array)
        const singleBets = await Bet.find({
            status: { $in: ['cancelled', 'canceled'] },
            'unibetMeta.leagueId': leagueIdString,
            $or: [
                { combination: { $exists: false } },
                { combination: { $size: 0 } }
            ]
        });

        // Find combo bets where any leg in combination array has this leagueId
        const comboBets = await Bet.find({
            status: { $in: ['cancelled', 'canceled'] },
            combination: { $exists: true, $ne: [] },
            'combination.unibetMeta.leagueId': leagueIdString
        });

        const totalBets = singleBets.length + comboBets.length;
        
        console.log(`📊 Found ${totalBets} cancelled/canceled bet(s) related to this league:`);
        console.log(`   - Single bets: ${singleBets.length}`);
        console.log(`   - Combo bets: ${comboBets.length}`);
        console.log('');

        if (totalBets > 0) {
            console.log('📝 Bets to be deleted:');
            console.log('─'.repeat(100));
            
            // Display single bets
            singleBets.forEach((bet, index) => {
                console.log(`${index + 1}. Single Bet (ID: ${bet._id})`);
                console.log(`   User: ${bet.userId}`);
                console.log(`   Match: ${bet.matchId}`);
                console.log(`   Status: ${bet.status}`);
                console.log(`   Stake: $${bet.stake}`);
                console.log(`   League: ${bet.unibetMeta?.leagueName || 'N/A'}`);
                console.log('');
            });

            // Display combo bets
            comboBets.forEach((bet, index) => {
                console.log(`${singleBets.length + index + 1}. Combo Bet (ID: ${bet._id})`);
                console.log(`   User: ${bet.userId}`);
                console.log(`   Status: ${bet.status}`);
                console.log(`   Stake: $${bet.stake}`);
                console.log(`   Legs: ${bet.combination?.length || 0}`);
                const matchingLegs = bet.combination?.filter(leg => leg.unibetMeta?.leagueId === leagueIdString) || [];
                console.log(`   Matching legs: ${matchingLegs.length}`);
                matchingLegs.forEach((leg, legIndex) => {
                    console.log(`      Leg ${legIndex + 1}: ${leg.teams || 'N/A'} - ${leg.unibetMeta?.leagueName || 'N/A'}`);
                });
                console.log('');
            });
            
            console.log('─'.repeat(100));
        }

        // Confirmation
        if (!force) {
            console.log(`⚠️  WARNING: This will:`);
            console.log(`   1. Move league "${league.unibetName}" (Unibet ID: ${league.unibetId}) to FailedLeagueMappingAttempt`);
            console.log(`   2. Delete league from LeagueMapping`);
            console.log(`   3. Delete ${totalBets} cancelled/canceled bet(s) from the database`);
            console.log(`\n   To skip confirmation, use: node src/scripts/removeLeagueAndCancelledBets.js ${leagueId} --force\n`);
            
            console.log('⏳ Proceeding in 5 seconds... (Press Ctrl+C to cancel)\n');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Step 1: Move league to FailedLeagueMappingAttempt
        console.log('📦 Moving league to FailedLeagueMappingAttempt...');
        try {
            const manualReason = 'Manually removed';
            if (existingFailed) {
                // Update existing record
                existingFailed.unibetName = league.unibetName;
                existingFailed.country = league.country || '';
                existingFailed.unibetUrl = league.unibetUrl || '';
                existingFailed.mappingAttempted = true;
                existingFailed.mappingFailed = true;
                existingFailed.lastMappingAttempt = new Date();
                existingFailed.attemptCount = (existingFailed.attemptCount || 0) + 1;
                existingFailed.reason = manualReason;
                existingFailed.updatedAt = new Date();
                await existingFailed.save();
                console.log(`✅ Updated existing record in FailedLeagueMappingAttempt (unibetId: ${league.unibetId})`);
            } else {
                // Create new record
                const failedAttempt = new FailedLeagueMappingAttempt({
                    unibetId: league.unibetId,
                    unibetName: league.unibetName,
                    country: league.country || '',
                    unibetUrl: league.unibetUrl || '',
                    mappingAttempted: true,
                    mappingFailed: true,
                    lastMappingAttempt: new Date(),
                    attemptCount: 1,
                    reason: manualReason
                });
                await failedAttempt.save();
                console.log(`✅ Created new record in FailedLeagueMappingAttempt (unibetId: ${league.unibetId})`);
            }
        } catch (error) {
            console.error(`❌ Error moving league to FailedLeagueMappingAttempt: ${error.message}`);
            throw error;
        }

        // Step 2: Delete league from LeagueMapping
        console.log('🗑️  Deleting league from LeagueMapping...');
        try {
            await LeagueMapping.deleteOne({ _id: league._id });
            console.log(`✅ Deleted league from LeagueMapping (${league.unibetName})`);
        } catch (error) {
            console.error(`❌ Error deleting league from LeagueMapping: ${error.message}`);
            throw error;
        }

        // Step 3: Delete related cancelled/canceled bets
        if (totalBets > 0) {
            console.log(`🗑️  Deleting ${totalBets} cancelled/canceled bet(s)...`);
            
            let deletedSingleBets = 0;
            let deletedComboBets = 0;

            // Delete single bets
            for (const bet of singleBets) {
                try {
                    await Bet.deleteOne({ _id: bet._id });
                    deletedSingleBets++;
                    console.log(`   ✅ Deleted single bet: ${bet._id}`);
                } catch (error) {
                    console.error(`   ❌ Error deleting single bet ${bet._id}: ${error.message}`);
                }
            }

            // Delete combo bets
            for (const bet of comboBets) {
                try {
                    await Bet.deleteOne({ _id: bet._id });
                    deletedComboBets++;
                    console.log(`   ✅ Deleted combo bet: ${bet._id}`);
                } catch (error) {
                    console.error(`   ❌ Error deleting combo bet ${bet._id}: ${error.message}`);
                }
            }

            console.log(`\n✅ Bet deletion complete:`);
            console.log(`   - Single bets deleted: ${deletedSingleBets}/${singleBets.length}`);
            console.log(`   - Combo bets deleted: ${deletedComboBets}/${comboBets.length}`);
        } else {
            console.log('ℹ️  No cancelled/canceled bets found to delete');
        }

        // Summary
        console.log('\n✅ Operation complete!');
        console.log('📊 Summary:');
        console.log(`   - League moved to FailedLeagueMappingAttempt: ✅`);
        console.log(`   - League deleted from LeagueMapping: ✅`);
        console.log(`   - Cancelled/canceled bets deleted: ${totalBets}`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Operation failed:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the script
removeLeagueAndCancelledBets();

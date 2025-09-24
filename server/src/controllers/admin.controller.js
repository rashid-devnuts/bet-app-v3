import Bet from '../models/Bet.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

class AdminController {
    /**
     * Update bet status with automatic payout calculation and balance updates
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async updateBetStatus(req, res) {
        try {
            console.log(`[AdminController] Received request to update bet status`);
            console.log(`[AdminController] Request headers:`, req.headers);
            console.log(`[AdminController] Request cookies:`, req.cookies);
            
            const { betId } = req.params;
            const { oldStatus, newStatus, reason } = req.body;

            console.log(`[AdminController] Updating bet ${betId} from ${oldStatus} to ${newStatus}`);

            // Find the bet
            const bet = await Bet.findById(betId);
            if (!bet) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Bet not found' 
                });
            }

            // Validate status change
            const validStatuses = ['pending', 'won', 'lost', 'canceled'];
            if (!validStatuses.includes(newStatus)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid status' 
                });
            }

            // Calculate balance changes
            const balanceChanges = this.calculateBalanceChanges(bet, oldStatus, newStatus);
            console.log(`[AdminController] Balance changes:`, balanceChanges);

            // Update bet status and payout
            const updatedBet = await Bet.findByIdAndUpdate(
                betId,
                {
                    status: newStatus,
                    payout: balanceChanges.newPayout,
                    result: {
                        ...bet.result,
                        status: newStatus,
                        payout: balanceChanges.newPayout,
                        reason: reason || bet.result?.reason,
                        processedAt: new Date(),
                        adminOverride: true,
                        originalStatus: oldStatus
                    },
                    updatedAt: new Date()
                },
                { new: true, runValidators: true }
            );

            // For combination bets, also update individual leg statuses if needed
            if (bet.combination && bet.combination.length > 0) {
                if (newStatus === 'won') {
                    // If admin sets combination to won, all legs should be won
                    await Bet.findByIdAndUpdate(
                        betId,
                        {
                            $set: {
                                'combination.$[].status': 'won',
                                'combination.$[].result.status': 'won',
                                'combination.$[].result.reason': 'Admin override: Combination bet set to won'
                            }
                        },
                        { new: true, runValidators: true }
                    );
                } else if (newStatus === 'lost') {
                    // If admin sets combination to lost, check if any legs are actually lost
                    const hasLostLegs = bet.combination.some(leg => leg.status === 'lost');
                    if (!hasLostLegs) {
                        // If no legs are lost, set the first leg to lost
                        await Bet.findByIdAndUpdate(
                            betId,
                            {
                                $set: {
                                    'combination.0.status': 'lost',
                                    'combination.0.result.status': 'lost',
                                    'combination.0.result.reason': 'Admin override: Combination bet set to lost'
                                }
                            },
                            { new: true, runValidators: true }
                        );
                    }
                }
            }

            // Update user balance if there's a change
            if (balanceChanges.balanceChange !== 0) {
                const userUpdateResult = await User.findByIdAndUpdate(
                    bet.userId,
                    { $inc: { balance: balanceChanges.balanceChange } },
                    { new: true }
                );

                if (!userUpdateResult) {
                    console.error(`[AdminController] Failed to update user balance - user not found: ${bet.userId}`);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Failed to update user balance' 
                    });
                }

                console.log(`[AdminController] Updated user ${bet.userId} balance by ${balanceChanges.balanceChange}`);
            }

            res.json({
                success: true,
                message: 'Bet status updated successfully',
                bet: updatedBet,
                balanceChange: balanceChanges.balanceChange,
                newPayout: balanceChanges.newPayout
            });

        } catch (error) {
            console.error('[AdminController] Error updating bet status:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error',
                error: error.message 
            });
        }
    }

    /**
     * Calculate balance changes when bet status changes
     * @param {Object} bet - The bet object
     * @param {string} oldStatus - Previous status
     * @param {string} newStatus - New status
     * @returns {Object} Balance change information
     */
    calculateBalanceChanges(bet, oldStatus, newStatus) {
        const stake = bet.stake;
        let oldPayout = bet.payout || 0;
        let newPayout = 0;
        let balanceChange = 0;

        // Calculate new payout based on new status
        if (newStatus === 'won') {
            // For both single and combination bets, payout = stake × odds
            // (combination bets already have multiplied odds in bet.odds)
            newPayout = stake * bet.odds;
        } else if (newStatus === 'canceled') {
            newPayout = stake; // Refund stake
        } else {
            // lost or pending
            newPayout = 0;
        }

        // Calculate balance change
        // If going from won to lost: subtract the old payout
        if (oldStatus === 'won' && newStatus === 'lost') {
            balanceChange = -oldPayout;
        }
        // If going from lost to won: add the new payout
        else if (oldStatus === 'lost' && newStatus === 'won') {
            balanceChange = newPayout;
        }
        // If going from won to canceled: subtract old payout, add refund
        else if (oldStatus === 'won' && newStatus === 'canceled') {
            balanceChange = -oldPayout + stake;
        }
        // If going from lost to canceled: add refund
        else if (oldStatus === 'lost' && newStatus === 'canceled') {
            balanceChange = stake;
        }
        // If going from canceled to won: subtract refund, add payout
        else if (oldStatus === 'canceled' && newStatus === 'won') {
            balanceChange = -stake + newPayout;
        }
        // If going from canceled to lost: subtract refund
        else if (oldStatus === 'canceled' && newStatus === 'lost') {
            balanceChange = -stake;
        }
        // If going from pending to won: add payout
        else if (oldStatus === 'pending' && newStatus === 'won') {
            balanceChange = newPayout;
        }
        // If going from pending to lost: no change (stake was already deducted)
        else if (oldStatus === 'pending' && newStatus === 'lost') {
            balanceChange = 0;
        }
        // If going from pending to canceled: add refund
        else if (oldStatus === 'pending' && newStatus === 'canceled') {
            balanceChange = stake;
        }

        return {
            oldPayout,
            newPayout,
            balanceChange
        };
    }
}

export default AdminController;

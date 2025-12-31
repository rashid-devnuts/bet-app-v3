// Bet Schema Adapter Service
// Maps bet-app Bet schema to unibet-api calculator format

import { normalizeBet } from '../unibet-calc/utils/market-normalizer.js';
import { identifyMarket } from '../unibet-calc/utils/market-registry.js';

export class BetSchemaAdapter {
    /**
     * Convert bet-app Bet document to calculator-compatible format
     * @param {Object} bet - bet-app Bet document
     * @returns {Object} - Calculator-compatible bet object
     */
    static adaptBetForCalculator(bet) {
        if (!bet) {
            throw new Error('Bet document is required');
        }

        // Extract data from bet-app schema
        const betDetails = bet.betDetails || {};
        const unibetMeta = bet.unibetMeta || {};

        // Build calculator-compatible bet object
        const calculatorBet = {
            // Core identifiers
            eventId: bet.matchId || unibetMeta.eventName,
            marketId: bet.marketId || betDetails.market_id || unibetMeta.marketName,
            outcomeId: bet.oddId,
            outcomeLabel: betDetails.label || bet.betOption || unibetMeta.outcomeEnglishLabel,
            outcomeEnglishLabel: betDetails.label || bet.betOption || unibetMeta.outcomeEnglishLabel,

            // Market information - prioritize market_name over market_description for better recognition
            marketName: unibetMeta.marketName || betDetails.market_name || betDetails.market_description,
            criterionLabel: unibetMeta.criterionLabel || betDetails.market_description,
            criterionEnglishLabel: unibetMeta.criterionEnglishLabel || betDetails.market_description,

            // Participant information
            // ✅ FIX: Prioritize unibetMeta.participant for player markets (it contains actual player name from Unibet API)
            // betDetails.name might be "Over 0.5" which is not a player name, especially for combination bets
            // For combination bets, leg.unibetMeta.participant contains the actual player name like "Washington Navaya"
            participant: unibetMeta.participant || betDetails.name,
            participantId: unibetMeta.participantId,
            eventParticipantId: unibetMeta.eventParticipantId,

            // Bet details
            odds: bet.odds || betDetails.value,
            stake: bet.stake,
            payout: bet.payout || 0,
            potentialWin: bet.potentialWin || (bet.stake * (bet.odds || betDetails.value)),
            betType: bet.betType || 'single',
            betOfferTypeId: unibetMeta.betOfferTypeId,

            // Handicap/Line information
            handicapRaw: unibetMeta.handicapRaw || this.parseHandicap(betDetails.handicap),
            handicapLine: unibetMeta.handicapLine || this.parseHandicap(betDetails.handicap),
            line: this.parseHandicap(betDetails.handicap) || unibetMeta.handicapLine,
            
            // Bet details for line calculation
            betDetails: {
                total: betDetails.total,
                handicap: betDetails.handicap,
                market_name: betDetails.market_name,
                market_description: betDetails.market_description,
                label: betDetails.label,
                value: betDetails.value,
                name: betDetails.name,
                // ✅ FIX: Preserve matchDate in betDetails for combination bet legs
                matchDate: betDetails.matchDate || bet.matchDate || null
            },

            // Match context - prioritize direct league fields over unibetMeta, but ensure unibetMeta is used as fallback
            leagueId: bet.leagueId || unibetMeta.leagueId || null,
            leagueName: bet.leagueName || unibetMeta.leagueName || null,
            homeName: unibetMeta.homeName || this.extractTeamName(bet.teams, 'home'),
            awayName: unibetMeta.awayName || this.extractTeamName(bet.teams, 'away'),
            // ✅ FIX: Prioritize bet.matchDate (from DB) over unibetMeta.start
            // bet.matchDate is the source of truth stored in database when bet was placed
            // IMPORTANT: Set both matchDate AND start so calculator can find it
            matchDate: (() => {
                let matchDateValue, matchDateSource;
                if (bet.matchDate) {
                    matchDateValue = bet.matchDate;
                    matchDateSource = 'bet.matchDate (from DB)';
                } else if (unibetMeta.start) {
                    matchDateValue = unibetMeta.start;
                    matchDateSource = 'unibetMeta.start';
                } else {
                    matchDateValue = null;
                    matchDateSource = 'NONE';
                }
                console.log(`✅ [adaptBetForCalculator] Using ${matchDateSource} as source of truth for matchDate field: ${matchDateValue}`);
                return matchDateValue;
            })(),
            start: (() => {
                let startValue, startSource;
                if (bet.matchDate) {
                    startValue = bet.matchDate;
                    startSource = 'bet.matchDate (from DB)';
                } else if (unibetMeta.start) {
                    startValue = unibetMeta.start;
                    startSource = 'unibetMeta.start';
                } else {
                    startValue = null;
                    startSource = 'NONE';
                }
                console.log(`✅ [adaptBetForCalculator] Using ${startSource} as source of truth for start field: ${startValue}`);
                return startValue;
            })(),

            // Additional fields
            eventName: unibetMeta.eventName || `${unibetMeta.homeName || 'Home'} vs ${unibetMeta.awayName || 'Away'}`,
            userId: bet.userId,
            status: bet.status,
            createdAt: bet.createdAt,
            updatedAt: bet.updatedAt,

            // Original bet-app fields for reference
            _originalBet: {
                id: bet._id,
                matchId: bet.matchId,
                oddId: bet.oddId,
                betOption: bet.betOption,
                marketId: bet.marketId,
                betDetails: betDetails,
                unibetMeta: unibetMeta,
                matchDate: bet.matchDate, // ✅ FIX: Include matchDate for time-based processing
                result: bet.result // ✅ FIX: Include result object (contains matchDate in some cases)
            }
        };

        // Normalize the bet for calculator
        const normalizedBet = normalizeBet(calculatorBet);
        
        // Identify market type
        const marketCode = identifyMarket(calculatorBet, normalizedBet);

        return {
            ...calculatorBet,
            normalized: normalizedBet,
            marketCode: marketCode
        };
    }

    /**
     * Parse handicap value from various formats
     * @param {any} handicap - Handicap value (string, number, etc.)
     * @returns {number|null} - Parsed handicap value
     */
    static parseHandicap(handicap) {
        if (handicap === null || handicap === undefined) return null;
        
        const num = Number(handicap);
        if (Number.isNaN(num)) return null;
        
        return num;
    }

    /**
     * Extract team name from teams string
     * @param {string} teams - Teams string like "Team A vs Team B"
     * @param {string} side - 'home' or 'away'
     * @returns {string|null} - Team name
     */
    static extractTeamName(teams, side) {
        if (!teams || typeof teams !== 'string') return null;
        
        const parts = teams.split(' vs ');
        if (parts.length !== 2) return null;
        
        return side === 'home' ? parts[0].trim() : parts[1].trim();
    }


    /**
     * Convert calculator result back to bet-app format
     * @param {Object} calculatorResult - Result from calculator
     * @param {Object} originalBet - Original bet-app bet document
     * @returns {Object} - Updated bet-app bet document
     */
    static adaptCalculatorResult(calculatorResult, originalBet) {
        const updatedBet = {
            ...originalBet,
            status: calculatorResult.status || originalBet.status,
            payout: calculatorResult.payout || originalBet.payout,
            result: {
                status: calculatorResult.status,
                payout: calculatorResult.payout,
                reason: calculatorResult.reason,
                processedAt: new Date(),
                debugInfo: calculatorResult.debugInfo || {},
                calculatorVersion: 'unibet-api-v1'
            },
            updatedAt: new Date()
        };

        return updatedBet;
    }

    /**
     * Validate that bet has required fields for calculator
     * @param {Object} bet - bet-app Bet document
     * @returns {Object} - Validation result
     */
    static validateBetForCalculator(bet) {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!bet.matchId && !bet.unibetMeta?.eventName) {
            errors.push('Missing matchId or eventName');
        }

        if (!bet.oddId) {
            errors.push('Missing oddId');
        }

        if (!bet.stake || bet.stake <= 0) {
            errors.push('Invalid or missing stake');
        }

        if (!bet.odds && !bet.betDetails?.value) {
            errors.push('Missing odds');
        }

        // Warnings for missing optional fields
        if (!bet.unibetMeta?.marketName && !bet.betDetails?.market_name) {
            warnings.push('Missing market name');
        }

        if (!bet.unibetMeta?.leagueName) {
            warnings.push('Missing league name');
        }

        if (!bet.unibetMeta?.homeName || !bet.unibetMeta?.awayName) {
            warnings.push('Missing team names');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Get market family for bet
     * @param {Object} bet - bet-app Bet document
     * @returns {string} - Market family
     */
    static getMarketFamily(bet) {
        const adaptedBet = this.adaptBetForCalculator(bet);
        const marketName = (adaptedBet.marketName || '').toLowerCase();
        
        if (!marketName) return 'unknown';
        
        if (marketName.includes('match') || marketName.includes('3-way') || marketName.includes('double chance') || marketName.includes('draw no bet')) {
            return 'result';
        }
        if (marketName.includes('total') || marketName.includes('over') || marketName.includes('under') || marketName.includes('odd/even')) {
            return 'totals';
        }
        if (marketName.includes('card')) {
            return 'cards';
        }
        if (marketName.includes('corner')) {
            return 'corners';
        }
        if (marketName.includes('player') || marketName.includes('to score')) {
            return 'player';
        }
        if (marketName.includes('half') || marketName.includes('interval') || marketName.includes('minute') || marketName.includes('next')) {
            return 'time';
        }
        
        return 'unknown';
    }

    /**
     * Convert combination bet to calculator-compatible format
     * @param {Object} bet - bet-app Bet document with combination array
     * @returns {Array} - Array of calculator-compatible bet objects (one per leg)
     */
    static adaptCombinationBetForCalculator(bet) {
        if (!bet.combination || !Array.isArray(bet.combination)) {
            throw new Error('Invalid combination bet: missing combination array');
        }
        
        console.log(`[adaptCombinationBetForCalculator] Processing combination bet ${bet._id} with ${bet.combination.length} legs`);
        
        return bet.combination.map((leg, index) => {
            
            // ✅ FIX: Check both locations - leg.betDetails.matchDate (actual data) and leg.matchDate (schema)
            // Priority: leg.betDetails.matchDate > leg.matchDate
            // For combination bets, each leg has its own matchDate in betDetails
            let legMatchDate, legMatchDateSource;
            if (leg.betDetails?.matchDate) {
                legMatchDate = leg.betDetails.matchDate;
                legMatchDateSource = 'leg.betDetails.matchDate';
            } else if (leg.matchDate) {
                legMatchDate = leg.matchDate;
                legMatchDateSource = 'leg.matchDate';
            } else {
                legMatchDate = null;
                legMatchDateSource = 'NONE';
            }
            
            const legEstimatedMatchEnd = leg.betDetails?.estimatedMatchEnd || leg.estimatedMatchEnd;
            const legBetOutcomeCheckTime = leg.betDetails?.betOutcomeCheckTime || leg.betOutcomeCheckTime;
            
            console.log(`[adaptCombinationBetForCalculator] Leg ${index + 1} matchDate sources:`, {
                legMatchDate: leg.matchDate,
                legBetDetailsMatchDate: leg.betDetails?.matchDate,
                legBetDetailsMatchDateType: typeof leg.betDetails?.matchDate,
                legBetDetailsMatchDateValue: leg.betDetails?.matchDate ? new Date(leg.betDetails.matchDate).toISOString() : 'N/A',
                finalMatchDate: legMatchDate,
                finalMatchDateType: typeof legMatchDate,
                finalMatchDateValue: legMatchDate ? new Date(legMatchDate).toISOString() : 'N/A',
                matchId: leg.matchId
            });
            console.log(`✅ [adaptCombinationBetForCalculator] Leg ${index + 1} using ${legMatchDateSource} as source of truth for matchDate: ${legMatchDate ? new Date(legMatchDate).toISOString() : 'NONE'}`);
            
            // Create a single bet object for this leg using the leg's data
            const legBet = {
                // Core bet fields from the main combination bet
                _id: bet._id,
                userId: bet.userId,
                status: bet.status,
                createdAt: bet.createdAt,
                updatedAt: bet.updatedAt,
                betType: bet.betType,
                
                // Leg-specific data
                matchId: leg.matchId,
                oddId: leg.oddId,
                betOption: leg.betOption,
                odds: leg.odds,
                stake: leg.stake,
                betDetails: leg.betDetails,
                unibetMeta: leg.unibetMeta, // Use leg's unibetMeta
                teams: leg.teams,
                selection: leg.selection,
                inplay: leg.inplay,
                // ✅ FIX: Use leg's matchDate (from betDetails or directly on leg), not main bet's matchDate
                matchDate: legMatchDate,
                estimatedMatchEnd: legEstimatedMatchEnd,
                betOutcomeCheckTime: legBetOutcomeCheckTime,
                // Include league information directly from the leg
                leagueId: leg.leagueId,
                leagueName: leg.leagueName
            };
            
            console.log(`[adaptCombinationBetForCalculator] Processing leg ${index + 1}: ${leg.betOption} @ ${leg.odds} for match ${leg.matchId}`);
            console.log(`[adaptCombinationBetForCalculator] Leg ${index + 1} matchDate: ${legMatchDate}`);
            console.log(`[adaptCombinationBetForCalculator] Leg ${index + 1} league info:`, {
                legLeagueId: leg.leagueId,
                legLeagueName: leg.leagueName,
                unibetMetaLeagueId: leg.unibetMeta?.leagueId,
                unibetMetaLeagueName: leg.unibetMeta?.leagueName
            });
            
            // Ensure league information is available - prioritize leg fields, then unibetMeta
            if (!legBet.leagueId && leg.unibetMeta?.leagueId) {
                legBet.leagueId = leg.unibetMeta.leagueId;
                console.log(`[adaptCombinationBetForCalculator] Set leagueId from unibetMeta: ${legBet.leagueId}`);
            }
            if (!legBet.leagueName && leg.unibetMeta?.leagueName) {
                legBet.leagueName = leg.unibetMeta.leagueName;
                console.log(`[adaptCombinationBetForCalculator] Set leagueName from unibetMeta: ${legBet.leagueName}`);
            }
            
            // Use the existing single bet adapter
            return this.adaptBetForCalculator(legBet);
        });
    }

    /**
     * Convert calculator results back to bet-app format for combination bets
     * @param {Array} calculatorResults - Results from calculator for each leg
     * @param {Object} originalBet - Original bet-app Bet document
     * @returns {Object} - Updated bet-app Bet document
     */
    static adaptCombinationCalculatorResult(calculatorResults, originalBet) {
        if (!originalBet.combination || !Array.isArray(originalBet.combination)) {
            throw new Error('Invalid combination bet: missing combination array');
        }
        
        if (calculatorResults.length !== originalBet.combination.length) {
            throw new Error(`Mismatch: ${calculatorResults.length} results for ${originalBet.combination.length} legs`);
        }
        
        console.log(`[adaptCombinationCalculatorResult] Processing ${calculatorResults.length} leg results for combination bet ${originalBet._id}`);
        
        // Update each leg with its calculator result
        const updatedCombination = originalBet.combination.map((leg, index) => {
            const result = calculatorResults[index];
            
            // ✅ FIX: Preserve existing final status if leg was already finalized
            // Only update if leg was pending or if calculator returned a final status
            const existingStatus = leg.status;
            const isExistingFinal = existingStatus === 'won' || existingStatus === 'lost' || 
                                   existingStatus === 'canceled' || existingStatus === 'cancelled' || 
                                   existingStatus === 'void';
            
            // Use calculator result only if:
            // 1. Leg was pending, OR
            // 2. Calculator returned a different final status (shouldn't happen, but handle it)
            let finalStatus;
            if (isExistingFinal && result.status === 'pending') {
                // Leg was already finalized, keep existing status
                finalStatus = existingStatus;
                console.log(`[adaptCombinationCalculatorResult] Leg ${index + 1}: Preserving existing final status: ${existingStatus}`);
            } else {
                // Use calculator result (normalize canceled/cancelled)
                finalStatus = result.status === 'cancelled' ? 'canceled' : result.status;
            }
            
            console.log(`[adaptCombinationCalculatorResult] Leg ${index + 1}: ${leg.betOption} → ${result.status} → ${finalStatus} (payout: ${result.payout})`);
            console.log(`[adaptCombinationCalculatorResult] Leg ${index + 1} status details:`, {
                originalStatus: leg.status,
                calculatorStatus: result.status,
                finalStatus: finalStatus,
                isExistingFinal: isExistingFinal
            });
            
            return {
                ...leg,
                status: finalStatus,
                payout: result.payout !== undefined ? result.payout : (leg.payout || 0), // Preserve existing payout if calculator didn't provide one
                odds: leg.odds, // Explicitly preserve odds for payout calculation
                // Add result metadata
                result: {
                    status: finalStatus,
                    payout: result.payout !== undefined ? result.payout : (leg.payout || 0),
                    reason: result.reason || leg.result?.reason || this.generateLegReason(leg, result, finalStatus),
                    processedAt: leg.result?.processedAt || new Date(), // Preserve existing processedAt if available
                    debugInfo: result.debugInfo || leg.result?.debugInfo || {},
                    calculatorVersion: 'unibet-api-v1'
                }
            };
        });
        
        // Calculate overall combination status using combination bet rules
        const overallStatus = this.calculateCombinationStatus(updatedCombination);
        const totalPayout = this.calculateCombinationPayout(updatedCombination, originalBet.stake);
        
        console.log(`[adaptCombinationCalculatorResult] Overall status: ${overallStatus}, Total payout: ${totalPayout}`);
        
        // Debug: Log the final combination array to verify leg statuses
        console.log(`[adaptCombinationCalculatorResult] Final combination array:`, updatedCombination.map((leg, index) => ({
            leg: index + 1,
            betOption: leg.betOption,
            status: leg.status,
            payout: leg.payout
        })));
        
        return {
            ...originalBet,
            combination: updatedCombination,
            status: overallStatus,
            payout: totalPayout,
            result: {
                status: overallStatus,
                payout: totalPayout,
                reason: this.generateCombinationBetReason(updatedCombination, overallStatus),
                processedAt: new Date(),
                legs: updatedCombination.length,
                wonLegs: updatedCombination.filter(leg => leg.status === 'won').length,
                lostLegs: updatedCombination.filter(leg => leg.status === 'lost').length,
                canceledLegs: updatedCombination.filter(leg => leg.status === 'canceled' || leg.status === 'error').length,
                pendingLegs: updatedCombination.filter(leg => leg.status === 'pending').length,
                calculatorVersion: 'unibet-api-v1'
            },
            updatedAt: new Date()
        };
    }

    /**
     * Calculate overall combination bet status
     * @param {Array} legs - Updated combination legs
     * @returns {string} - Overall bet status
     */
    static calculateCombinationStatus(legs) {
        // Handle both 'canceled' and 'cancelled' spellings from calculator
        // Also treat 'error' status as 'canceled' for combination bet rules
        const hasCanceled = legs.some(leg => 
            leg.status === 'canceled' || 
            leg.status === 'cancelled' || 
            leg.status === 'error'
        );
        const hasLost = legs.some(leg => leg.status === 'lost');
        const hasPending = legs.some(leg => leg.status === 'pending');
        
        // Combination bet rules:
        // - CANCELED: If any leg is canceled/cancelled/error
        // - LOST: If any leg is lost (even if others are won)
        // - PENDING: If any leg is still pending
        // - WON: Only if ALL legs are won
        
        if (hasCanceled) return 'canceled';
        if (hasLost) return 'lost';
        if (hasPending) return 'pending';
        return 'won'; // All legs won
    }

    /**
     * Calculate total payout for combination bet
     * @param {Array} legs - Updated combination legs
     * @param {number} stake - Original stake
     * @returns {number} - Total payout
     */
    static calculateCombinationPayout(legs, stake) {
        // Handle both 'canceled' and 'cancelled' spellings from calculator
        // Also treat 'error' status as 'canceled' for payout calculation
        const hasCanceled = legs.some(leg => 
            leg.status === 'canceled' || 
            leg.status === 'cancelled' || 
            leg.status === 'error'
        );
        const hasLost = legs.some(leg => leg.status === 'lost');
        const allWon = legs.every(leg => leg.status === 'won');
        
        // Combination bet payout rules:
        // - CANCELED: Refund stake
        // - LOST: No payout (0)
        // - WON: stake × (odd1 × odd2 × odd3 × ...) - product of all odds
        
        if (hasCanceled) return stake; // Refund
        if (hasLost) return 0; // No payout
        if (allWon) {
            // Odds are already in decimal format (e.g., 1.11, 1.62)
            const totalOdds = legs.reduce((acc, leg) => {
                console.log(`[calculateCombinationPayout] Leg odds: ${leg.odds}`);
                return acc * leg.odds;
            }, 1);
            console.log(`[calculateCombinationPayout] Total odds: ${totalOdds}, Stake: ${stake}, Payout: ${stake * totalOdds}`);
            return stake * totalOdds; // Product of all odds
        }
        
        return 0; // Default for pending
    }

    /**
     * Validate combination bet for calculator processing
     * @param {Object} bet - bet-app Bet document with combination array
     * @returns {Object} - Validation result
     */
    static validateCombinationBetForCalculator(bet) {
        const errors = [];
        const warnings = [];
        
        if (!bet.combination || !Array.isArray(bet.combination)) {
            errors.push('Missing or invalid combination array');
            return { isValid: false, errors, warnings };
        }
        
        if (bet.combination.length < 2) {
            errors.push('Combination bet must have at least 2 legs');
        }
        
        if (bet.combination.length > 10) {
            errors.push('Combination bet cannot have more than 10 legs');
        }
        
        // Validate each leg
        bet.combination.forEach((leg, index) => {
            const legValidation = this.validateBetForCalculator({
                matchId: leg.matchId,
                oddId: leg.oddId,
                stake: leg.stake,
                odds: leg.odds,
                betDetails: leg.betDetails,
                unibetMeta: leg.unibetMeta
            });
            
            if (!legValidation.isValid) {
                errors.push(`Leg ${index + 1}: ${legValidation.errors.join(', ')}`);
            }
            
            warnings.push(...legValidation.warnings.map(w => `Leg ${index + 1}: ${w}`));
        });
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Generate a comprehensive reason for combination bet outcome
     * @param {Array} legs - Array of combination bet legs with their results
     * @param {string} overallStatus - Overall combination bet status
     * @returns {string} Detailed reason explaining the outcome
     */
    static generateCombinationBetReason(legs, overallStatus) {
        const legCount = legs.length;
        const wonLegs = legs.filter(leg => leg.status === 'won');
        const lostLegs = legs.filter(leg => leg.status === 'lost');
        const canceledLegs = legs.filter(leg => leg.status === 'canceled' || leg.status === 'cancelled');
        const voidLegs = legs.filter(leg => leg.status === 'void');
        const pendingLegs = legs.filter(leg => leg.status === 'pending');
        
        // ✅ FIX: Include actual leg reasons from result.reason if available
        const legDetails = legs.map((leg, index) => {
            const matchName = leg.unibetMeta?.eventName || leg.teams || 'Unknown match';
            const legReason = leg.result?.reason || `${leg.betOption} - ${leg.status}`;
            return `Leg ${index + 1} (${matchName}): ${legReason}`;
        }).join(' | ');
        
        if (overallStatus === 'won') {
            return `Combination bet won: All ${legCount} legs successful. Details: ${legDetails}`;
        } else if (overallStatus === 'lost') {
            return `Combination bet lost: ${lostLegs.length} of ${legCount} legs failed. Details: ${legDetails}`;
        } else if (overallStatus === 'canceled' || overallStatus === 'cancelled') {
            return `Combination bet canceled: ${canceledLegs.length} of ${legCount} legs canceled. Details: ${legDetails}`;
        } else if (overallStatus === 'void') {
            return `Combination bet void: ${voidLegs.length} of ${legCount} legs void. Details: ${legDetails}`;
        } else if (overallStatus === 'pending') {
            return `Combination bet pending: ${pendingLegs.length} of ${legCount} legs still pending. Details: ${legDetails}`;
        } else {
            return `Combination bet status: ${overallStatus} (${wonLegs.length} won, ${lostLegs.length} lost, ${canceledLegs.length} canceled, ${voidLegs.length} void, ${pendingLegs.length} pending). Details: ${legDetails}`;
        }
    }

    /**
     * Generate a reason string for individual combination bet leg results
     * @param {Object} leg - Individual leg object
     * @param {Object} result - Calculator result for this leg
     * @param {string} status - Normalized status
     * @returns {string} - Reason string for this leg
     */
    static generateLegReason(leg, result, status) {
        // ✅ FIX: Use actual reason from calculator if available, otherwise generate generic one
        // Check both result.reason (from calculator outcome) and result.debugInfo for cancellation details
        const actualReason = result?.reason || result?.debugInfo?.cancellationReason || result?.debugInfo?.error;
        
        if (actualReason) {
            const betOption = leg.betOption || 'Unknown bet';
            const teams = leg.teams || leg.unibetMeta?.eventName || 'Unknown teams';
            // For cancelled bets, include the detailed reason
            if (status === 'canceled' || status === 'cancelled') {
                return `${betOption} (${teams}): ${actualReason}`;
            }
            return `${betOption} (${teams}): ${actualReason}`;
        }
        
        // Fallback to generic reason if calculator didn't provide one
        const betOption = leg.betOption || 'Unknown bet';
        const teams = leg.teams || leg.unibetMeta?.eventName || 'Unknown teams';
        
        if (status === 'won') {
            return `${betOption} won for ${teams}`;
        } else if (status === 'lost') {
            return `${betOption} lost for ${teams}`;
        } else if (status === 'canceled' || status === 'cancelled') {
            return `${betOption} canceled for ${teams} - No detailed reason available`;
        } else if (status === 'void') {
            return `${betOption} void for ${teams}`;
        } else {
            return `${betOption} status: ${status} for ${teams}`;
        }
    }
}

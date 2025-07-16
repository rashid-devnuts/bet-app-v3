'use client';

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Image from 'next/image';
import { fetchTodaysMatches } from '@/lib/features/matches/matchesSlice';
import MatchCard from '@/components/home/MatchCard';
import { formatMatchTime } from '@/lib/utils';

// Helper function to transform API data to MatchCard format (same as TopPicks)
const transformMatchData = (apiMatch, league) => {
    // Extract team names from the match name (e.g., "Hammarby vs Halmstad")
    const teamNames = apiMatch.name?.split(' vs ') || ['Team A', 'Team B'];

    // Extract main odds (1, X, 2) from the odds data
    const odds = {};
    if (apiMatch.odds) {
        console.log('🎲 Processing odds for match:', apiMatch.id, apiMatch.odds);
        
        if (typeof apiMatch.odds === 'object' && !Array.isArray(apiMatch.odds)) {
            // Handle object format: { home: { value: 2.1, oddId: 123 }, draw: { value: 3.4, oddId: 124 } }
            if (apiMatch.odds.home && typeof apiMatch.odds.home === 'object' && !isNaN(apiMatch.odds.home.value)) {
                odds['1'] = { value: apiMatch.odds.home.value.toFixed(2), oddId: apiMatch.odds.home.oddId };
            }
            if (apiMatch.odds.draw && typeof apiMatch.odds.draw === 'object' && !isNaN(apiMatch.odds.draw.value)) {
                odds['X'] = { value: apiMatch.odds.draw.value.toFixed(2), oddId: apiMatch.odds.draw.oddId };
            }
            if (apiMatch.odds.away && typeof apiMatch.odds.away === 'object' && !isNaN(apiMatch.odds.away.value)) {
                odds['2'] = { value: apiMatch.odds.away.value.toFixed(2), oddId: apiMatch.odds.away.oddId };
            }
            
            // Handle simple object format: { home: 2.1, draw: 3.4, away: 3.2 }
            if (apiMatch.odds.home && typeof apiMatch.odds.home === 'number') {
                odds['1'] = { value: apiMatch.odds.home.toFixed(2), oddId: null };
            }
            if (apiMatch.odds.draw && typeof apiMatch.odds.draw === 'number') {
                odds['X'] = { value: apiMatch.odds.draw.toFixed(2), oddId: null };
            }
            if (apiMatch.odds.away && typeof apiMatch.odds.away === 'number') {
                odds['2'] = { value: apiMatch.odds.away.toFixed(2), oddId: null };
            }
        } else if (Array.isArray(apiMatch.odds)) {
            // Handle array format
            apiMatch.odds.forEach(odd => {
                const label = odd.label?.toString().toLowerCase();
                const name = odd.name?.toString().toLowerCase();
                const value = parseFloat(odd.value);
                if (!isNaN(value)) {
                    if (label === '1' || label === 'home' || name === 'home') odds['1'] = { value: value.toFixed(2), oddId: odd.oddId };
                    if (label === 'x' || label === 'draw' || name === 'draw') odds['X'] = { value: value.toFixed(2), oddId: odd.oddId };
                    if (label === '2' || label === 'away' || name === 'away') odds['2'] = { value: value.toFixed(2), oddId: odd.oddId };
                }
            });
        }
        
        console.log('✅ Extracted odds:', odds);
    } else {
        console.log('⚠️ No odds found for match:', apiMatch.id);
    }

    // Use the new timezone helper with 12-hour format
    const { date: dateStr, time: timeStr, isToday, isTomorrow } = formatMatchTime(apiMatch?.starting_at || null);

    // Combine date and time for display
    let displayTime = timeStr;
    if (isToday) {
        displayTime = `Today ${timeStr}`;
    } else if (isTomorrow) {
        displayTime = `Tomorrow ${timeStr}`;
    }

    return {
        id: apiMatch.id,
        league: {
            name: league.name,
            imageUrl: league.imageUrl
        },
        team1: teamNames[0],
        team2: teamNames[1],
        date: dateStr,
        time: displayTime,
        odds: odds,
        clock: true
    };
};

const TodaysMatchesPage = () => {
    const dispatch = useDispatch();
    const { todaysMatches, todaysMatchesLoading, todaysMatchesError } = useSelector(
        (state) => state.matches
    );

    useEffect(() => {
        dispatch(fetchTodaysMatches());
    }, [dispatch]);

    // Transform matches data grouped by league into a flat array
    const allMatches = todaysMatches.flatMap(leagueData => 
        leagueData.matches.map(match => transformMatchData(match, leagueData.league || leagueData))
    ).filter(match => {
        const hasValidOdds = match.odds && Object.keys(match.odds).length > 0;
        return hasValidOdds;
    });

    if (todaysMatchesLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">Today&apos;s Matches</h1>
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                </div>
            </div>
        );
    }

    if (todaysMatchesError) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">Today&apos;s Matches</h1>
                <div className="text-center py-12">
                    <div className="text-red-500 mb-4">
                        <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-lg">Failed to load today&apos;s matches</p>
                        <p className="text-sm text-gray-600 mt-2">{todaysMatchesError}</p>
                    </div>
                    <button 
                        onClick={() => dispatch(fetchTodaysMatches())}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (allMatches.length === 0) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-8">Today&apos;s Matches</h1>
                <div className="text-center py-12">
                    <div className="text-gray-500">
                        <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-lg">No matches scheduled for today</p>
                        <p className="text-sm text-gray-600 mt-2">Check back later or browse upcoming matches</p>
                    </div>
                </div>
            </div>
        );
    }

    // Group matches by league for better organization
    const matchesByLeague = todaysMatches.filter(leagueData => leagueData.matches.length > 0);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Today&apos;s Matches</h1>
                <p className="text-gray-600">
                    {allMatches.length} match{allMatches.length !== 1 ? 'es' : ''} available for betting today
                </p>
            </div>

            {/* Display matches grouped by league */}
            {matchesByLeague.map((leagueData) => {
                const leagueMatches = leagueData.matches
                    .map(match => transformMatchData(match, leagueData.league || leagueData))
                    .filter(match => match.odds && Object.keys(match.odds).length > 0);

                if (leagueMatches.length === 0) return null;

                return (
                    <div key={leagueData.id} className="mb-8">
                        <div className="flex items-center mb-4">
                            {leagueData.imageUrl && (
                                <Image 
                                    src={leagueData.imageUrl} 
                                    alt={leagueData.name}
                                    width={32}
                                    height={32}
                                    className="w-8 h-8 rounded-full mr-3"
                                />
                            )}
                            <h2 className="text-xl font-semibold text-gray-800">
                                {leagueData.name}
                            </h2>
                            <span className="ml-2 text-sm text-gray-500">
                                ({leagueMatches.length} match{leagueMatches.length !== 1 ? 'es' : ''})
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {leagueMatches.map((match) => (
                                <MatchCard key={match.id} match={match} />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default TodaysMatchesPage;

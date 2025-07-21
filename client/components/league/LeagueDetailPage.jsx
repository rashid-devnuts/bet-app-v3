"use client"
import React, { useEffect, useState } from 'react';
import LeagueHeader from "./LeagueHeader";
import LeagueAccordions from "./LeagueAccordions";
import MatchVisualization from "../match/MatchVisualization";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchMatchesByLeague, selectMatchesLoading, selectMatchesByLeague } from '@/lib/features/leagues/leaguesSlice';
import { Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
const LeagueDetailPage = ({ leagueId }) => {
    const [selectedBetType, setSelectedBetType] = useState("total-goals");
    const dispatch = useDispatch();
    const selectMatchesLoadingValue = useSelector(selectMatchesLoading);
    const selectMatches = useSelector(state => selectMatchesByLeague(state, leagueId));
    const betTypeLabels = {
        "match": "Match",
        "total-goals": "Total Goals",
        "handicap": "Handicap",
        "over-under": "Over/Under",
        "both-teams": "Both Teams to Score"
    };
    useEffect(() => {
        dispatch(fetchMatchesByLeague(leagueId));
    }, [dispatch, leagueId])

    useEffect(() => {
        console.log(selectMatches, "THIS IS MATCHES");

    }, [selectMatches])

    if (selectMatchesLoadingValue) {
        return <div className='flex items-center justify-center min-h-[calc(100vh-198px)]'><Loader2 className='animate-spin h-10 w-10 text-base' /></div>
    }

    // Check if there's no data or empty matches array
    if (!selectMatches || !selectMatches.matches || selectMatches.matches.length === 0) {
        return (
            <div className="bg-slate-100 min-h-[calc(100vh-198px)] flex flex-col items-center justify-center">
                <div className="text-center p-8 bg-white  shadow-md">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">No Data Found</h2>
                    <p className="text-gray-600 mb-6">There are currently no matches available for this league.</p>
                    <Button 
                        className="bg-base hover:bg-base-dark text-white font-medium py-2 px-6 shadow-sm" 
                        onClick={() => window.history.back()}
                    >
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-100 min-h-screen relative">
            {/* Main content - adjusts width when sidebar expands */}
            <div className="lg:mr-80 xl:mr-96">
                <div className="p-2 sm:p-3 md:p-4">
                    <LeagueHeader league={selectMatches.league} />

                    {/* Live & Upcoming Section */}
                    

                    <LeagueAccordions matches={selectMatches.matches} />
                </div>
            </div>

            {/* Right sidebar - fixed position, doesn't move */}

        </div>
    );
};

export default LeagueDetailPage;

"use client"
import MatchHeader from "./MatchHeader"
import BettingTabs from "./BettingTabs"
import MatchVisualization from "./MatchVisualization"
import { useCustomSidebar } from "@/contexts/SidebarContext.js"
import { useSelector, useDispatch } from "react-redux"
import { 
    fetchMatchById, 
    fetchLiveOdds,
    clearError,
    selectLiveOdds,
    selectLiveOddsLoading,
    selectLiveOddsError,
    selectLiveOddsTimestamp
} from "@/lib/features/matches/matchesSlice"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

const isMatchLive = (match) => {
    if (!match || !match.starting_at) return false;
    const now = new Date();
    let matchTime;
    if (match.starting_at.includes('T')) {
        matchTime = new Date(match.starting_at.endsWith('Z') ? match.starting_at : match.starting_at + 'Z');
    } else {
        matchTime = new Date(match.starting_at.replace(' ', 'T') + 'Z');
    }
    const matchEnd = new Date(matchTime.getTime() + 120 * 60 * 1000);
    return matchTime <= now && now < matchEnd;
};

const MatchDetailPage = ({ matchId }) => {
    const dispatch = useDispatch();
    const {
        matchDetails,
        matchDetailLoading: loading,
        matchDetailError: error
    } = useSelector(state => state.matches);

    const liveOdds = useSelector(state => selectLiveOdds(state, matchId));
    const liveOddsLoading = useSelector(selectLiveOddsLoading);
    const liveOddsError = useSelector(selectLiveOddsError);
    const lastOddsUpdate = useSelector(state => selectLiveOddsTimestamp(state, matchId));

    const matchData = matchDetails[matchId];

    useEffect(() => {
        if (matchId && !matchData) {
            dispatch(fetchMatchById(matchId));
        }
    }, [matchId, matchData, dispatch]);

    // Poll for live odds if match is live
    useEffect(() => {
        if (!matchId || !matchData || !isMatchLive(matchData)) return;

        // Initial fetch
        dispatch(fetchLiveOdds(matchId));

        // Set up polling every 3 minutes
        const interval = setInterval(() => {
            dispatch(fetchLiveOdds(matchId));
        }, 180000); // 3 minutes

        return () => clearInterval(interval);
    }, [matchId, matchData, dispatch]);

    const handleRetry = () => {
        dispatch(clearError());
        dispatch(fetchMatchById(matchId));
    };

    const handleRefreshOdds = () => {
        if (isMatchLive(matchData)) {
            dispatch(fetchLiveOdds(matchId));
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-100 min-h-screen relative">
                <div className="lg:mr-80 xl:mr-96">
                    <div className="p-2 sm:p-3 md:p-4">
                        <Card className="w-full">
                            <CardContent className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-base" />
                                    <p className="text-gray-600">Loading match details...</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-slate-100 min-h-screen relative">
                <div className="lg:mr-80 xl:mr-96">
                    <div className="p-2 sm:p-3 md:p-4">
                        <Card className="w-full border-red-200">
                            <CardContent className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
                                    <p className="text-red-600 font-medium mb-2">Failed to load match</p>
                                    <p className="text-gray-600 mb-4">{error}</p>
                                    <Button onClick={handleRetry} variant="outline" size="sm">
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Try Again
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    if (!matchData) {
        return (
            <div className="bg-slate-100 min-h-screen relative">
                <div className="lg:mr-80 xl:mr-96">
                    <div className="p-2 sm:p-3 md:p-4">
                        <Card className="w-full">
                            <CardContent className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-4 text-gray-400" />
                                    <p className="text-gray-600">Match not found</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    const isLive = isMatchLive(matchData);
    const hasLiveOdds = liveOdds && liveOdds.length > 0;
    
    // For live matches, show loading state while fetching odds
    if (isLive && liveOddsLoading) {
        return (
            <div className="bg-slate-100 min-h-screen relative">
                <div className="lg:mr-80 xl:mr-96">
                    <div className="p-2 sm:p-3 md:p-4">
                        <Card className="w-full">
                            <CardContent className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-base" />
                                    <p className="text-gray-600">Loading live odds...</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    // For live matches, show error state if live odds fetch failed
    if (isLive && liveOddsError) {
        return (
            <div className="bg-slate-100 min-h-screen relative">
                <div className="lg:mr-80 xl:mr-96">
                    <div className="p-2 sm:p-3 md:p-4">
                        <Card className="w-full border-red-200">
                            <CardContent className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
                                    <p className="text-red-600 font-medium mb-2">Failed to load live odds</p>
                                    <p className="text-gray-600 mb-4">{liveOddsError}</p>
                                    <Button onClick={handleRefreshOdds} variant="outline" size="sm">
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Try Again
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }
    
    // Determine which odds to show:
    // For live matches: ONLY show live odds
    // For non-live matches: Show pre-match odds
    const bettingData = isLive 
        ? liveOdds || [] // For live matches, only show live odds or empty array if none available
        : matchData.betting_data; // For non-live matches, show pre-match odds

    // Show no betting options message only if there are truly no odds available
    if (!bettingData || bettingData.length === 0) {
        return (
            <div className="bg-slate-100 min-h-[calc(100vh-198px)] flex flex-col items-center justify-center">
                <div className="text-center p-8 bg-white shadow-md">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        No Betting Options Available
                    </h2>
                    <p className="text-gray-600 mb-6">
                        There are currently no betting options available for this match.
                    </p>
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
                    <MatchHeader matchData={matchData} />
                    <BettingTabs matchData={{ ...matchData, betting_data: bettingData }} />
                </div>
            </div>

            {/* Right sidebar - fixed position, doesn't move */}
            <div className="w-full lg:w-80 xl:w-96 lg:fixed lg:right-4 lg:top-40 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
                <div className="p-2 sm:p-3 md:p-4 lg:p-2">
                    <MatchVisualization matchData={matchData} />
                </div>
            </div>
        </div>
    )
}

export default MatchDetailPage

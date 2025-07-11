'use client';

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TopPicks from './TopPicks';
import LeagueCards from './LeagueCards';
import { fetchHomepageData, selectHomeLoading, selectHomeError, selectFootballDaily } from '@/lib/features/home/homeSlice';
import { fetchLiveMatches, selectLiveMatches, selectLiveMatchesLoading, selectLiveMatchesError } from '@/lib/features/matches/liveMatchesSlice';

const HomePage = () => {
    const dispatch = useDispatch();
    const loading = useSelector(selectHomeLoading);
    const error = useSelector(selectHomeError);
    const footballDaily = useSelector(selectFootballDaily);
    const filteredFootballDaily = footballDaily.filter(league => 
        league.matches.length > 0 && 
        league.matches.some(match => match.odds_main && Object.keys(match.odds_main).length > 0)
    );

    // Live matches state
    const liveMatches = useSelector(selectLiveMatches);
    const liveLoading = useSelector(selectLiveMatchesLoading);
    const liveError = useSelector(selectLiveMatchesError);

    useEffect(() => {
        // Fetch homepage data when component mounts
        dispatch(fetchHomepageData());
        // Fetch live matches separately
        dispatch(fetchLiveMatches());
    }, [dispatch]);

    if (loading) {
        return (
            <div className="flex-1 bg-gray-100">
                <div className="p-3 lg:p-6 overflow-hidden">
                    <div className="flex items-center justify-center h-64">
                        <div className="text-gray-500">Loading homepage data...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 bg-gray-100">
                <div className="p-3 lg:p-6 overflow-hidden">
                    <div className="flex items-center justify-center h-64">
                        <div className="text-red-500">Error: {error}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-gray-100">
            <div className="p-3 lg:p-6 overflow-hidden">
                <div className="flex flex-col xl:flex-row gap-4 lg:gap-6">
                    {/* Main content area */}
                    <div className="flex-1 min-w-0">
                        {/* Top Picks - using Redux data */}
                        <TopPicks />

                        {/* Football Daily - using existing LeagueCards component */}
                        <LeagueCards
                            title="Football Daily"
                            useReduxData={true}
                            reduxData={filteredFootballDaily}
                            isInPlay={false}
                            showDayTabs={true}
                            viewAllText="View All Football Daily"
                        />

                        {/* In-Play Section - using live matches from Redux */}
                        <LeagueCards
                            title="In-Play"
                            isInPlay={true}
                            showDayTabs={false}
                            viewAllText="View All Live Football"
                            useReduxData={true}
                            reduxData={liveMatches}
                            loading={liveLoading}
                            error={liveError}
                        />
                    </div>

                    {/* Right sidebar */}
                    {/* <div className="w-full xl:w-80 xl:flex-shrink-0">
                        <TrendingCombo />
                    </div> */}
                </div>
            </div>
        </div>
    );
};

export default HomePage;

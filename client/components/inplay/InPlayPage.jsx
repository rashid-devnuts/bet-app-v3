'use client';

import React, { useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchLiveMatches, silentUpdateLiveMatches, selectLiveMatches, selectLiveMatchesLoading, selectLiveMatchesError } from '@/lib/features/matches/liveMatchesSlice';
import MatchListPage from '@/components/shared/MatchListPage'; // Updated import path
import LiveTimer from '@/components/home/LiveTimer';

const InPlayPage = () => {
    const dispatch = useDispatch();
    const liveMatches = useSelector(selectLiveMatches);
    const loading = useSelector(selectLiveMatchesLoading);
    const error = useSelector(selectLiveMatchesError);

    useEffect(() => {
        // Initial fetch (with loading state)
        dispatch(fetchLiveMatches());
        // Set up polling every 2 minutes (silent updates)
        const interval = setInterval(() => {
            dispatch(silentUpdateLiveMatches());
        }, 120000); // 2 minutes
        return () => clearInterval(interval);
    }, [dispatch]);

    const inPlayConfig = {
        pageTitle: 'Live Matches',
        breadcrumbText: 'Football | In-Play Matches',
        leagues: liveMatches,
        loading,
        error,
        matchTimeComponent: LiveTimer, // Use LiveTimer component for real-time updates
        PageIcon: Clock,
        noMatchesConfig: {
            title: 'No Live Matches',
            message: 'There are no live matches available at the moment.',
            buttonText: 'View All Matches',
            buttonLink: '/',
            Icon: Clock
        }
    };

    return <MatchListPage config={inPlayConfig} />;
};

export default InPlayPage;

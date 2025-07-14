'use client';

import React, { useState, useEffect } from 'react';

const LiveTimer = ({ startingAt }) => {
    const [elapsedTime, setElapsedTime] = useState('');

    useEffect(() => {
        if (!startingAt) {
            console.log('[LiveTimer] No startingAt provided');
            setElapsedTime('');
            return;
        }

        console.log('[LiveTimer] Starting timer with startingAt:', startingAt);

        const calculateElapsedTime = () => {
            try {
                const startTime = new Date(startingAt);
                const now = new Date();
                const diffMs = now.getTime() - startTime.getTime();

                // If match hasn't started yet
                if (diffMs < 0) {
                    setElapsedTime('0:00');
                    return;
                }

                // Calculate minutes and seconds
                const totalMinutes = Math.floor(diffMs / (1000 * 60));
                const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

                // Format as MM:SS
                const formattedTime = `${totalMinutes}:${seconds.toString().padStart(2, '0')}`;
                setElapsedTime(formattedTime);
            } catch (error) {
                console.error('[LiveTimer] Error calculating elapsed time:', error);
                setElapsedTime('--');
            }
        };

        // Calculate immediately
        calculateElapsedTime();

        // Update every second
        const interval = setInterval(calculateElapsedTime, 1000);

        return () => {
            console.log('[LiveTimer] Cleaning up interval');
            clearInterval(interval);
        };
    }, [startingAt]);

    if (!elapsedTime) {
        return <span className="text-xs text-gray-600">--</span>;
    }

    return (
        <span className="text-xs text-gray-600 font-medium">
            {elapsedTime}
        </span>
    );
};

export default LiveTimer; 
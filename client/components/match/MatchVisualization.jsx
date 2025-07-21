

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getCountdownToKickoff } from '@/lib/utils';

const MatchVisualization = ({ matchData }) => {
    // Determine if the match is live
    const isLive = (() => {
        if (!matchData || !matchData.starting_at) return false;
        const now = new Date();
        let matchTime;
        if (matchData.starting_at.includes('T')) {
            matchTime = new Date(matchData.starting_at.endsWith('Z') ? matchData.starting_at : matchData.starting_at + 'Z');
        } else {
            matchTime = new Date(matchData.starting_at.replace(' ', 'T') + 'Z');
        }
        const matchEnd = new Date(matchTime.getTime() + 120 * 60 * 1000);
        return matchTime <= now && now < matchEnd;
    })();

    // Countdown timer state
    const [countdown, setCountdown] = useState(getCountdownToKickoff(matchData));

    useEffect(() => {
        if (isLive) return; // No timer if live
        const interval = setInterval(() => {
            setCountdown(getCountdownToKickoff(matchData));
        }, 1000);
        return () => clearInterval(interval);
    }, [matchData, isLive]);

    const quickActions = [
        { icon: '📊', label: 'Stats', color: 'from-blue-500 to-blue-600', hoverColor: 'hover:from-blue-600 hover:to-blue-700' },
        { icon: '👥', label: 'Lineups', color: 'from-purple-500 to-purple-600', hoverColor: 'hover:from-purple-600 hover:to-purple-700' },
        { icon: '📋', label: 'Events', color: 'from-orange-500 to-orange-600', hoverColor: 'hover:from-orange-600 hover:to-orange-700' },
        { icon: '🏆', label: 'H2H', color: 'from-emerald-500 to-emerald-600', hoverColor: 'hover:from-emerald-600 hover:to-emerald-700' }
    ];

    const matchOfficials = [
        { name: 'Pinheiro, Joao Pedro', role: 'REFEREE', position: 'left-8' },
        { name: 'Friis, Jacob', role: 'MANAGER (FIN)', position: 'left-32' },
        { name: 'Probierz, Michal', role: 'MANAGER (POL)', position: 'right-8' }
    ];

    return (
        <div className="space-y-4  sm:space-y-6">
            {/* Quick Actions */}
            {/* <Card className="shadow-lg border-0 bg-gradient-to-br from-gray-50 to-white">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Match Center
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="grid grid-cols-4 gap-4">
                        {quickActions.map((action, index) => (
                            <div key={index} className="text-center group cursor-pointer">
                                <div className={`w-14 h-14 bg-gradient-to-br ${action.color} ${action.hoverColor} rounded-2xl mb-3 flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:-translate-y-1`}>
                                    <span className="text-white text-xl">{action.icon}</span>
                                </div>
                                <span className="text-sm text-gray-700 font-semibold">{action.label}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card> */}            {/* Enhanced Football Field Visualization */}
            <Card className="overflow-hidden fix bg-gradient-to-br from-green-600 via-green-500 to-green-600">
                <CardContent className="p-0 relative">
                    <div className="relative p-3 sm:p-4">
                        <div className="relative bg-gradient-to-br from-green-400 to-green-500 rounded-lg p-3 sm:p-4 h-[200px] sm:h-[300px] shadow-inner">
                            {/* Football field layout with clean styling */}
                            <div className="h-full border-2 border-white rounded-md relative bg-green-500">
                                {/* Center circle */}
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 sm:w-16 sm:h-16 border-2 border-white rounded-full">
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full"></div>
                                </div>

                                {/* Center line */}
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-white"></div>

                                {/* Goal areas */}                                <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-4 h-12 sm:w-6 sm:h-16 border-2 border-white border-l-0 rounded-r-md"></div>
                                <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-4 h-12 sm:w-6 sm:h-16 border-2 border-white border-r-0 rounded-l-md"></div>

                                {/* Penalty areas */}                                <div className="absolute top-1/2 left-0 transform -translate-y-1/2 w-8 h-18 sm:w-12 sm:h-24 border-2 border-white border-l-0 rounded-r-lg">
                                    {/* Penalty spot */}
                                    <div className="absolute top-1/2 right-4 sm:right-6 transform -translate-y-1/2 w-1 h-1 bg-white rounded-full"></div>
                                </div>
                                <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-8 h-18 sm:w-12 sm:h-24 border-2 border-white border-r-0 rounded-l-lg">
                                    <div className="absolute top-1/2 left-4 sm:left-6 transform -translate-y-1/2 w-1 h-1 bg-white rounded-full"></div>
                                </div>

                                {/* Penalty arcs - simplified */}                                <div className="absolute top-1/2 left-8 sm:left-12 transform -translate-y-1/2 w-4 h-8 sm:w-6 sm:h-12 border-2 border-white border-l-0 border-r-0 rounded-full"></div>
                                <div className="absolute top-1/2 right-8 sm:right-12 transform -translate-y-1/2 w-4 h-8 sm:w-6 sm:h-12 border-2 border-white border-l-0 border-r-0 rounded-full"></div>

                                {/* Corner arcs - smaller and cleaner */}
                                <div className="absolute top-0 left-0 w-3 h-3 border-r-2 border-b-2 border-white rounded-br-full"></div>
                                <div className="absolute top-0 right-0 w-3 h-3 border-l-2 border-b-2 border-white rounded-bl-full"></div>
                                <div className="absolute bottom-0 left-0 w-3 h-3 border-r-2 border-t-2 border-white rounded-tr-full"></div>
                                <div className="absolute bottom-0 right-0 w-3 h-3 border-l-2 border-t-2 border-white rounded-tl-full"></div>
                            </div>

                            {/* Centered Kickoff Time Display */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-3 text-center shadow-lg border border-gray-200 z-10">
                                {isLive ? (
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                        <span className="text-xs font-bold text-red-600 animate-pulse">LIVE</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-center gap-1 mb-1">
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                            <div className="text-xs font-bold text-gray-800">KICKOFF IN</div>
                                        </div>
                                        <div className="flex items-center justify-center space-x-1 text-sm font-bold">
                                            <div className="bg-gray-900 text-white px-1.5 py-0.5 rounded shadow text-xs">
                                                {String(countdown.hours).padStart(2, '0')}
                                            </div>
                                            <span className="text-gray-600 text-xs">:</span>
                                            <div className="bg-gray-900 text-white px-1.5 py-0.5 rounded shadow text-xs">
                                                {String(countdown.minutes).padStart(2, '0')}
                                            </div>
                                            <span className="text-gray-600 text-xs">:</span>
                                            <div className="bg-gray-900 text-white px-1.5 py-0.5 rounded shadow text-xs">
                                                {String(countdown.seconds).padStart(2, '0')}
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-0.5 px-0.5">
                                            <span>HRS</span>
                                            <span>MIN</span>
                                            <span>SEC</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default MatchVisualization;

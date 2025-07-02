"use client"
import MatchHeader from "./MatchHeader"
import BettingTabs from "./BettingTabs"
import MatchVisualization from "./MatchVisualization"
import { useCustomSidebar } from "@/contexts/SidebarContext.js"
import { useSelector, useDispatch } from "react-redux"
import { fetchMatchById, clearError } from "@/lib/features/matches/matchesSlice"
import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertCircle, RefreshCw, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

const MatchDetailPage = ({ matchId }) => {
    const dispatch = useDispatch();
    const {
        matchDetails,
        matchDetailLoading: loading,
        matchDetailError: error
    } = useSelector(state => state.matches);

    const matchData = matchDetails[matchId];

    useEffect(() => {
        if (matchId && !matchData) {
            dispatch(fetchMatchById(matchId));
        }
    }, [matchId, matchData, dispatch]);

    const handleRetry = () => {
        dispatch(clearError());
        dispatch(fetchMatchById(matchId));
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

    // Check if betting options are available
    const hasBettingOptions = matchData.betting_data && matchData.betting_data.length > 0;
    
    // If no betting options are available, show a "Go Back" page
    if (!hasBettingOptions) {
        return (
            <div className="bg-slate-100 min-h-[calc(100vh-198px)] flex flex-col items-center justify-center">
                <div className="text-center p-8 bg-white shadow-md">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">No Betting Options Available</h2>
                    <p className="text-gray-600 mb-6">There are currently no betting options available for this match.</p>
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
                    <BettingTabs matchData={matchData} />
                </div>
            </div>

            {/* Right sidebar - fixed position, doesn't move */}
            <div className="w-full lg:w-80 xl:w-96 lg:fixed lg:right-4 lg:top-40 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto ">
                <div className="p-2 sm:p-3 md:p-4 lg:p-2">
                    <MatchVisualization matchData={matchData} />
                </div>
            </div>
        </div>
    )
}

export default MatchDetailPage

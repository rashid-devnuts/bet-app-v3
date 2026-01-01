"use client";

import { use } from "react";
import MatchDetailPage from "@/components/match/MatchDetailPage";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function MatchDetail({ params }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [hasError, setHasError] = useState(false);
  const matchId = resolvedParams.id;

  // ✅ FIX: Move useEffect before conditional return (React Hooks rules)
  useEffect(() => {
    // Add a global error handler for this page
    const handleError = () => {
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  // ✅ FIX: Validate that matchId is numeric before rendering
  const isNumeric = /^\d+$/.test(String(matchId));
  
  if (!isNumeric) {
    return (
      <div className="bg-slate-100 min-h-screen p-4">
        <Card className="w-full border-red-200 max-w-3xl mx-auto mt-8">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
              <p className="text-red-600 font-medium text-xl mb-2">Invalid Match ID</p>
              <p className="text-gray-600 mb-2">
                The match ID must be numeric, but received: <code className="bg-gray-100 px-2 py-1 rounded">&quot;{matchId}&quot;</code>
              </p>
              <p className="text-gray-500 text-sm mb-6">
                This appears to be a slug instead of a numeric event ID. Please use a valid match ID.
              </p>
              <Button onClick={() => router.back()} variant="outline" size="lg" className="mr-2">
                Go Back
              </Button>
              <Button onClick={() => router.push('/')} variant="default" size="lg">
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-slate-100 min-h-screen p-4">
        <Card className="w-full border-red-200 max-w-3xl mx-auto mt-8">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
              <p className="text-red-600 font-medium text-xl mb-2">Failed to load match</p>
              <p className="text-gray-600 mb-6">Failed to fetch match data</p>
              <Button onClick={() => router.back()} variant="outline" size="lg" className="mr-2">
                Go Back
              </Button>
              <Button onClick={() => window.location.reload()} variant="default" size="lg">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <MatchDetailPage matchId={matchId} />;
}

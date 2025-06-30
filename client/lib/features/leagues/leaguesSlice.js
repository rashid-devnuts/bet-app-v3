import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import apiClient from "@/config/axios";

// Async thunk for fetching leagues

// Async thunk for fetching popular leagues for sidebar
export const fetchPopularLeagues = createAsyncThunk(
  "leagues/fetchPopularLeagues",
  async (_, { rejectWithValue }) => {
    try {
      console.log("Fetching popular leagues for sidebar...");

      // Updated endpoint to fetch all leagues
      const response = await apiClient.get("/sportsmonk/leagues");

      const leagues = response.data.data;
      return leagues;
    } catch (error) {
      // Return fallback data if API fails

      console.warn(
        "Failed to fetch popular leagues, using fallback data:",
        error
      );
      return fallbackLeagues;
    }
  }
);

// Async thunk for fetching matches by league
export const fetchMatchesByLeague = createAsyncThunk(
  "leagues/fetchMatchesByLeague",
  async (leagueId, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(
        `/fixtures/league/${leagueId}/matches`
      );
      return { leagueId, matches: response.data.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message ||
          "Failed to fetch matches for league"
      );
    }
  }
);

const leaguesSlice = createSlice({
  name: "leagues",
  initialState: {
    data: [],
    popularLeagues: [],
    loading: false,
    popularLoading: false,
    error: null,
    selectedLeague: null,
    matchesByLeague: {},
    matchesLoading: false,
    matchesError: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.matchesError = null;
    },
    setSelectedLeague: (state, action) => {
      state.selectedLeague = action.payload;
    },
    clearSelectedLeague: (state) => {
      state.selectedLeague = null;
    },
  },
  extraReducers: (builder) => {
    builder

      // Popular leagues cases
      .addCase(fetchPopularLeagues.pending, (state) => {
        state.popularLoading = true;
        state.error = null;
      })
      .addCase(fetchPopularLeagues.fulfilled, (state, action) => {
        state.popularLoading = false;
        state.popularLeagues = action.payload;
      })
      .addCase(fetchPopularLeagues.rejected, (state, action) => {
        state.popularLoading = false;
        state.error = action.payload;
      })
      // Matches by league cases
      .addCase(fetchMatchesByLeague.pending, (state) => {
        state.matchesLoading = true;
        state.matchesError = null;
      })
      .addCase(fetchMatchesByLeague.fulfilled, (state, action) => {
        state.matchesLoading = false;
        const { leagueId, matches } = action.payload;
        state.matchesByLeague[leagueId] = matches;
      })
      .addCase(fetchMatchesByLeague.rejected, (state, action) => {
        state.matchesLoading = false;
        state.matchesError = action.payload;
      });
  },
});

export const { clearError, setSelectedLeague, clearSelectedLeague } =
  leaguesSlice.actions;
export default leaguesSlice.reducer;

// Selectors
export const selectLeagues = (state) => state.leagues.data;
export const selectLeaguesLoading = (state) => state.leagues.loading;
export const selectLeaguesError = (state) => state.leagues.error;
export const selectSelectedLeague = (state) => state.leagues.selectedLeague;
export const selectPopularLeagues = (state) => state.leagues.popularLeagues;
export const selectPopularLeaguesLoading = (state) =>
  state.leagues.popularLoading;
export const selectMatchesByLeague = (state, leagueId) =>
  state.leagues.matchesByLeague[leagueId] || [];
export const selectMatchesLoading = (state) => state.leagues.matchesLoading;
export const selectMatchesError = (state) => state.leagues.matchesError;

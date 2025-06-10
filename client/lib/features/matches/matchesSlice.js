import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_BASE_URL = "http://localhost:4000/api/sportsmonk";

// Async thunk for fetching matches by league
export const fetchMatches = createAsyncThunk(
  "matches/fetchMatches",
  async (leagueId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/leagues/${leagueId}/matches`
      );
      return {
        leagueId,
        matches: response.data.data,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message || "Failed to fetch matches"
      );
    }
  }
);

const matchesSlice = createSlice({
  name: "matches",
  initialState: {
    data: {},
    loading: false,
    error: null,
    selectedLeague: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedLeague: (state, action) => {
      state.selectedLeague = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMatches.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMatches.fulfilled, (state, action) => {
        state.loading = false;
        state.data[action.payload.leagueId] = action.payload.matches;
      })
      .addCase(fetchMatches.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setSelectedLeague } = matchesSlice.actions;
export default matchesSlice.reducer;

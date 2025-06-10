import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_BASE_URL = "http://localhost:4000/api/sportsmonk";

// Async thunk for fetching markets by match
export const fetchMarkets = createAsyncThunk(
  "markets/fetchMarkets",
  async (matchId, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/matches/${matchId}/markets`
      );
      return {
        matchId,
        markets: response.data.data,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message || "Failed to fetch markets"
      );
    }
  }
);

const marketsSlice = createSlice({
  name: "markets",
  initialState: {
    data: {},
    loading: false,
    error: null,
    selectedMatch: null,
    activeCategory: "goals",
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedMatch: (state, action) => {
      state.selectedMatch = action.payload;
    },
    setActiveCategory: (state, action) => {
      state.activeCategory = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMarkets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMarkets.fulfilled, (state, action) => {
        state.loading = false;
        state.data[action.payload.matchId] = action.payload.markets;
      })
      .addCase(fetchMarkets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, setSelectedMatch, setActiveCategory } =
  marketsSlice.actions;
export default marketsSlice.reducer;

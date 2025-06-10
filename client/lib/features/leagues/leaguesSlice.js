import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_BASE_URL = "http://localhost:4000/api/sportsmonk";

// Async thunk for fetching leagues
export const fetchLeagues = createAsyncThunk(
  "leagues/fetchLeagues",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leagues`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message || "Failed to fetch leagues"
      );
    }
  }
);

const leaguesSlice = createSlice({
  name: "leagues",
  initialState: {
    data: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeagues.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeagues.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchLeagues.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = leaguesSlice.actions;
export default leaguesSlice.reducer;

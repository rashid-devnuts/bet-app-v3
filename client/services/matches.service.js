import apiClient from "@/config/axios";

class MatchesService {
  /**
   * Get match details by ID with all related data
   * @param {string|number} matchId - The match ID
   * @param {Object} options - Additional options
   * @returns {Promise} - Match data with odds classification and betting data
   */
  async getMatchById(matchId, options = {}) {
    const {
      includeOdds = true,
      includeLeague = true,
      includeParticipants = true,
    } = options;

    try {
      const response = await apiClient.get(`/fixtures/${matchId}`, {
        params: {
          includeOdds: includeOdds.toString(),
          includeLeague: includeLeague.toString(),
          includeParticipants: includeParticipants.toString(),
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error fetching match details:", error);
      throw new Error(
        error.response?.data?.error?.message ||
          error.response?.data?.message ||
          "Failed to fetch match details"
      );
    }
  }

  /**
   * Get match odds only (lighter request)
   * @param {string|number} matchId - The match ID
   * @returns {Promise} - Match odds data
   */
  async getMatchOdds(matchId) {
    try {
      const response = await this.getMatchById(matchId, {
        includeOdds: true,
        includeLeague: false,
        includeParticipants: false,
      });

      return {
        odds: response.data.odds,
        odds_classification: response.data.odds_classification,
        betting_data: response.data.betting_data,
      };
    } catch (error) {
      console.error("Error fetching match odds:", error);
      throw error;
    }
  }

  /**
   * Get today's matches with all related data
   * @param {Object} options - Additional options
   * @returns {Promise} - Today's matches data
   */
  async getTodaysMatches(options = {}) {
    const { leagues } = options;

    try {
      const params = {};
      if (leagues && leagues.length > 0) {
        params.leagues = leagues.join(",");
      }

      const response = await apiClient.get("/fixtures/today", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching today's matches:", error);
      throw new Error(
        error.response?.data?.error?.message ||
          error.response?.data?.message ||
          "Failed to fetch today's matches"
      );
    }
  }
}

// Create and export a single instance
const matchesService = new MatchesService();
export default matchesService;

const axios = require('axios');
const config = require('../config/config');
const logger = require('./logger');

class FotmobService {
  constructor() {
    this.baseUrl = 'https://www.fotmob.com/api';
    this.leagueId = config.fotmob.leagueId;
    
    // Configure axios with headers to mimic a browser
    this.axiosInstance = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.fotmob.com',
        'Referer': 'https://www.fotmob.com/'
      }
    });
  }

  /**
   * Fetch matches for the South African league
   * @returns {Promise<Array>} Array of matches
   */
  async getLeagueMatches() {
    try {
      const url = `${this.baseUrl}/leagues?id=${this.leagueId}&tab=matches`;
      const response = await this.axiosInstance.get(url);
      return response.data.matches || [];
    } catch (error) {
      logger.error('Error fetching league matches:', error);
      throw error;
    }
  }

  /**
   * Fetch detailed match statistics
   * @param {string} matchId - The match ID
   * @returns {Promise<Object>} Match details
   */
  async getMatchDetails(matchId) {
    try {
      const url = `${this.baseUrl}/matchDetails?matchId=${matchId}`;
      const response = await this.axiosInstance.get(url);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching match details for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Get completed matches that haven't been tweeted yet
   * @param {Array} postedMatchIds - Array of match IDs that have already been posted
   * @returns {Promise<Array>} Array of matches to post
   */
  async getCompletedMatches(postedMatchIds = []) {
    const matches = await this.getLeagueMatches();
    return matches.filter(match => {
      // Only include finished matches that haven't been posted yet
      return match.status.finished && !postedMatchIds.includes(match.id);
    });
  }
}

module.exports = new FotmobService();
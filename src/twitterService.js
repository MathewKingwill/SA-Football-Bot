const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('./logger');

class TwitterService {
  constructor() {
    this.client = new TwitterApi({
      appKey: config.twitter.apiKey,
      appSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessSecret: config.twitter.accessSecret
    });

    this.rwClient = this.client.readWrite;
    this.postedMatchesPath = path.join(__dirname, '../assets/posted_matches.json');
    this.postedMatches = this.loadPostedMatches();
  }

  /**
   * Load the list of matches that have already been posted
   * @returns {Array} Array of match IDs
   */
  loadPostedMatches() {
    try {
      if (fs.existsSync(this.postedMatchesPath)) {
        const data = fs.readFileSync(this.postedMatchesPath, 'utf8');
        const matches = JSON.parse(data);
        logger.info(`Loaded ${matches.length} previously posted matches`);
        return matches;
      }
      logger.info('No previously posted matches found');
      return [];
    } catch (error) {
      logger.error('Error loading posted matches:', error);
      return [];
    }
  }

  /**
   * Save the list of matches that have been posted
   */
  savePostedMatches() {
    try {
      fs.writeFileSync(this.postedMatchesPath, JSON.stringify(this.postedMatches), 'utf8');
      logger.info(`Saved ${this.postedMatches.length} posted matches`);
    } catch (error) {
      logger.error('Error saving posted matches:', error);
    }
  }

  /**
   * Post a match graphic to Twitter
   * @param {Buffer} imageBuffer - The image buffer to post
   * @param {Object} matchData - Match data from Fotmob API
   * @returns {Promise<Object>} Tweet response
   */
  async postMatchGraphic(imageBuffer, matchData) {
    try {
      // Upload the image
      const mediaId = await this.rwClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });
      logger.info('Uploaded image to Twitter');

      // Create tweet text
      const homeTeam = matchData.general.homeTeam.name;
      const awayTeam = matchData.general.awayTeam.name;
      const score = matchData.header.status.scoreStr;
      const tweetText = `FT: ${homeTeam} ${score} ${awayTeam} #PSL #SouthAfricanFootball @SAFootyAnalyst`;

      // Post the tweet with the image
      const tweet = await this.rwClient.v2.tweet({
        text: tweetText,
        media: { media_ids: [mediaId] }
      });

      // Add match ID to posted matches
      this.postedMatches.push(matchData.general.matchId);
      this.savePostedMatches();

      logger.success(`Posted match ${matchData.general.matchId} to Twitter`);
      return tweet;
    } catch (error) {
      logger.error('Error posting to Twitter:', error);
      throw error;
    }
  }

  /**
   * Check if a match has already been posted
   * @param {string} matchId - Match ID to check
   * @returns {boolean} True if match has been posted
   */
  hasMatchBeenPosted(matchId) {
    return this.postedMatches.includes(matchId);
  }
}

module.exports = new TwitterService();
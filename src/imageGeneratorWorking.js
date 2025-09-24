const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class ImageGeneratorWorking {
  constructor() {
    this.width = 1200;
    this.height = 800;
    this.backgroundColor = 0x2a2a2aff; // Dark grey background
    this.assetsDir = path.join(__dirname, '../assets');
    
    // Create assets directory if it doesn't exist
    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true });
    }
  }

  /**
   * Generate a match graphic
   * @param {Object} matchData - Match data from Fotmob API
   * @returns {Promise<Buffer>} Image buffer
   */
  async generateMatchGraphic(matchData) {
    try {
      logger.info('Creating match graphic...');
      // Create a new image
      const image = new Jimp(this.width, this.height, this.backgroundColor);

      logger.info('Getting team data...');
      // Get team data
      const homeTeam = matchData.general.homeTeam;
      const awayTeam = matchData.general.awayTeam;
      const homeScore = matchData.header.status.scoreStr.split('-')[0].trim();
      const awayScore = matchData.header.status.scoreStr.split('-')[1].trim();

      logger.info('Drawing basic elements...');
      // Draw basic elements without fonts for now
      await this.drawBasicElements(image, homeTeam, awayTeam, homeScore, awayScore);

      logger.info('Drawing stats...');
      // Draw match stats
      const stats = matchData.content.stats?.Periods?.All || [];
      if (stats.length > 0) {
        await this.drawBasicStats(image, stats);
      }

      logger.info('Drawing league info...');
      // Draw league info
      await this.drawBasicLeagueInfo(image, matchData);

      logger.info('Converting to buffer...');
      // Return as buffer
      const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
      
      logger.info(`Generated match graphic for ${homeTeam.name} vs ${awayTeam.name}`);
      return buffer;
    } catch (error) {
      logger.error('Error generating match graphic:', error);
      throw error;
    }
  }

  /**
   * Draw basic elements
   */
  async drawBasicElements(image, homeTeam, awayTeam, homeScore, awayScore) {
    // Draw simple rectangles for team info
    // Home team area
    for (let x = 50; x < 550; x++) {
      for (let y = 50; y < 150; y++) {
        image.setPixelColor(0x444444ff, x, y);
      }
    }
    
    // Away team area
    for (let x = 650; x < 1150; x++) {
      for (let y = 50; y < 150; y++) {
        image.setPixelColor(0x444444ff, x, y);
      }
    }

    // Draw score areas
    for (let x = 200; x < 300; x++) {
      for (let y = 200; y < 300; y++) {
        image.setPixelColor(0x666666ff, x, y);
      }
    }
    
    for (let x = 900; x < 1000; x++) {
      for (let y = 200; y < 300; y++) {
        image.setPixelColor(0x666666ff, x, y);
      }
    }
  }

  /**
   * Draw basic stats
   */
  async drawBasicStats(image, stats) {
    const statY = 400;
    const statGap = 30;
    let currentY = statY;

    // Key stats to display
    const keyStats = [
      { name: 'Possession %', home: null, away: null },
      { name: 'Total shots', home: null, away: null },
      { name: 'Shots on target', home: null, away: null },
      { name: 'Succ. Passes %', home: null, away: null },
      { name: 'xG', home: null, away: null }
    ];

    // Map stats to our key stats
    stats.forEach(stat => {
      const keyStatIndex = keyStats.findIndex(ks => 
        ks.name.toLowerCase() === stat.title.toLowerCase() ||
        ks.name.toLowerCase().includes(stat.title.toLowerCase()) ||
        stat.title.toLowerCase().includes(ks.name.toLowerCase())
      );

      if (keyStatIndex !== -1) {
        keyStats[keyStatIndex].home = stat.stats[0];
        keyStats[keyStatIndex].away = stat.stats[1];
      }
    });

    // Draw stat areas
    for (const stat of keyStats) {
      if (stat.home !== null && stat.away !== null) {
        // Draw stat row background
        for (let x = 200; x < 1000; x++) {
          for (let y = currentY; y < currentY + 25; y++) {
            image.setPixelColor(0x333333ff, x, y);
          }
        }
        currentY += statGap;
      }
    }
  }

  /**
   * Draw basic league info
   */
  async drawBasicLeagueInfo(image, matchData) {
    // Draw footer background
    for (let x = 0; x < this.width; x++) {
      for (let y = 700; y < this.height; y++) {
        image.setPixelColor(0x222222ff, x, y);
      }
    }
  }
}

module.exports = new ImageGeneratorWorking();

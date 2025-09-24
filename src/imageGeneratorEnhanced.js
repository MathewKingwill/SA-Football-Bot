const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const logger = require('./logger');

class ImageGeneratorEnhanced {
  constructor() {
    this.width = 1400;
    this.height = 1000;
    this.backgroundColor = 0x2a2a2aff; // Dark grey background
    this.assetsDir = path.join(__dirname, '../assets');
    
    // Team colors for PSL teams
    this.teamColors = {
      'kaizer chiefs': { primary: 0xffd700ff, secondary: 0x000000ff }, // Gold and black
      'mamelodi sundowns': { primary: 0xffff00ff, secondary: 0x0000ffff }, // Yellow and blue
      'orlando pirates': { primary: 0x000000ff, secondary: 0xffffff00 }, // Black and white
      'supersport united': { primary: 0x0000ffff, secondary: 0xffffff00 }, // Blue and white
      'sekhukhune united': { primary: 0xff0000ff, secondary: 0x000000ff }, // Red and black
      'ts galaxy': { primary: 0x800080ff, secondary: 0xffffff00 }, // Purple and white
      'cape town city': { primary: 0x00ff00ff, secondary: 0x000000ff }, // Green and black
      'stellenbosch': { primary: 0xffa500ff, secondary: 0x000000ff }, // Orange and black
      'royal am': { primary: 0x0000ffff, secondary: 0xff0000ff }, // Blue and red
      'chippa united': { primary: 0x00ff00ff, secondary: 0xffff00ff }, // Green and yellow
      'default': { primary: 0x87ceebff, secondary: 0xffff00ff } // Light blue and yellow
    };
    
    // Create assets directory if it doesn't exist
    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true });
    }
  }

  /**
   * Get team colors based on team name
   * @param {string} teamName - Name of the team
   * @returns {Object} Team colors object
   */
  getTeamColors(teamName) {
    const normalizedName = teamName.toLowerCase();
    for (const [key, colors] of Object.entries(this.teamColors)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return colors;
      }
    }
    return this.teamColors.default;
  }

  /**
   * Generate a match graphic similar to the provided example
   * @param {Object} matchData - Match data from Fotmob API
   * @returns {Promise<Buffer>} Image buffer
   */
  async generateMatchGraphic(matchData) {
    try {
      logger.info('Creating enhanced match graphic...');
      // Create a new image
      const image = new Jimp(this.width, this.height, this.backgroundColor);

      logger.info('Loading fonts...');
      // Load fonts
      const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
      const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
      const fontTiny = await Jimp.loadFont(Jimp.FONT_SANS_12_WHITE);

      logger.info('Getting team data...');
      // Get team data
      const homeTeam = matchData.general.homeTeam;
      const awayTeam = matchData.general.awayTeam;
      const homeScore = matchData.header.status.scoreStr.split('-')[0].trim();
      const awayScore = matchData.header.status.scoreStr.split('-')[1].trim();

      // Get team colors
      const homeColors = this.getTeamColors(homeTeam.name);
      const awayColors = this.getTeamColors(awayTeam.name);

      logger.info('Drawing team info with badges...');
      // Draw team badges and names
      await this.drawTeamInfo(image, homeTeam, awayTeam, homeScore, awayScore, homeColors, awayColors, fontLarge, fontMedium);

      logger.info('Drawing pitch visualizations...');
      // Draw football pitch halves
      await this.drawPitchVisualization(image, matchData, homeColors, awayColors);

      logger.info('Drawing stats...');
      // Draw match stats in center
      const stats = matchData.content.stats?.Periods?.All || [];
      if (stats.length > 0) {
        await this.drawStats(image, stats, fontSmall, homeColors, awayColors);
      }

      logger.info('Drawing xG legend...');
      // Draw xG legend
      await this.drawXGLegend(image, fontTiny);

      logger.info('Drawing league info...');
      // Draw league info
      await this.drawLeagueInfo(image, matchData, fontSmall);

      logger.info('Converting to buffer...');
      // Return as buffer
      const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
      
      logger.info(`Generated enhanced match graphic for ${homeTeam.name} vs ${awayTeam.name}`);
      return buffer;
    } catch (error) {
      logger.error('Error generating match graphic:', error);
      throw error;
    }
  }

  /**
   * Draw team information with badges
   */
  async drawTeamInfo(image, homeTeam, awayTeam, homeScore, awayScore, homeColors, awayColors, fontLarge, fontMedium) {
    // Download team logos
    const homeLogoPath = await this.downloadLogo(homeTeam.logoUrl, homeTeam.id);
    const awayLogoPath = await this.downloadLogo(awayTeam.logoUrl, awayTeam.id);

    // Load and position logos
    let homeLogo, awayLogo;
    try {
      if (homeLogoPath) {
        homeLogo = await Jimp.read(homeLogoPath);
        homeLogo.resize(80, 80);
        image.composite(homeLogo, 100, 50);
      }
      
      if (awayLogoPath) {
        awayLogo = await Jimp.read(awayLogoPath);
        awayLogo.resize(80, 80);
        image.composite(awayLogo, 1220, 50);
      }
    } catch (error) {
      logger.error('Error loading team logos:', error);
    }

    // Draw team names with team colors
    image.print(fontMedium, 100, 140, homeTeam.name);
    image.print(fontMedium, 1100, 140, awayTeam.name);

    // Draw scores with team colors
    image.print(fontLarge, 100, 180, homeScore);
    image.print(fontLarge, 1200, 180, awayScore);

    // Draw 'Goals' label in center
    image.print(fontMedium, 600, 200, 'Goals');
  }

  /**
   * Draw football pitch visualization with shot locations
   */
  async drawPitchVisualization(image, matchData, homeColors, awayColors) {
    // Left pitch (home team attacking)
    const leftPitchX = 50;
    const leftPitchY = 300;
    const pitchWidth = 200;
    const pitchHeight = 300;

    // Right pitch (away team attacking)
    const rightPitchX = 1150;
    const rightPitchY = 300;

    // Draw pitch outlines
    this.drawPitchOutline(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight);
    this.drawPitchOutline(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight);

    // Draw goal areas
    this.drawGoalArea(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight);
    this.drawGoalArea(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight);

    // Draw shot locations (mock data for now - would need real shot data from API)
    this.drawShotLocations(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight, homeColors, 'home');
    this.drawShotLocations(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight, awayColors, 'away');
  }

  /**
   * Draw pitch outline
   */
  drawPitchOutline(image, x, y, width, height) {
    // Draw pitch border
    for (let i = 0; i < width; i++) {
      image.setPixelColor(0xffffffff, x + i, y);
      image.setPixelColor(0xffffffff, x + i, y + height);
    }
    for (let i = 0; i < height; i++) {
      image.setPixelColor(0xffffffff, x, y + i);
      image.setPixelColor(0xffffffff, x + width, y + i);
    }

    // Draw center line
    for (let i = 0; i < height; i++) {
      image.setPixelColor(0xffffffff, x + width / 2, y + i);
    }

    // Draw penalty area
    const penaltyWidth = width * 0.6;
    const penaltyHeight = height * 0.3;
    const penaltyX = x + (width - penaltyWidth) / 2;
    const penaltyY = y + height - penaltyHeight;

    for (let i = 0; i < penaltyWidth; i++) {
      image.setPixelColor(0xffffffff, penaltyX + i, penaltyY);
    }
    for (let i = 0; i < penaltyHeight; i++) {
      image.setPixelColor(0xffffffff, penaltyX, penaltyY + i);
      image.setPixelColor(0xffffffff, penaltyX + penaltyWidth, penaltyY + i);
    }
  }

  /**
   * Draw goal area
   */
  drawGoalArea(image, x, y, width, height) {
    const goalWidth = width * 0.3;
    const goalX = x + (width - goalWidth) / 2;
    const goalY = y + height - 10;

    for (let i = 0; i < goalWidth; i++) {
      image.setPixelColor(0xffffffff, goalX + i, goalY);
    }
  }

  /**
   * Draw shot locations on pitch
   */
  drawShotLocations(image, x, y, width, height, colors, side) {
    // Mock shot locations (in real implementation, this would come from match data)
    const shots = [
      { x: 0.3, y: 0.7, xg: 0.3, isGoal: false },
      { x: 0.5, y: 0.8, xg: 0.1, isGoal: false },
      { x: 0.7, y: 0.6, xg: 0.5, isGoal: true },
      { x: 0.4, y: 0.9, xg: 0.2, isGoal: false }
    ];

    shots.forEach(shot => {
      const shotX = x + (shot.x * width);
      const shotY = y + (shot.y * height);
      const radius = Math.max(5, Math.min(15, shot.xg * 20));

      // Draw shot circle
      this.drawCircle(image, shotX, shotY, radius, colors.primary);

      // Draw goal indicator
      if (shot.isGoal) {
        this.drawStar(image, shotX, shotY, radius + 5, 0xffffffff);
      }
    });
  }

  /**
   * Draw a circle
   */
  drawCircle(image, x, y, radius, color) {
    for (let i = -radius; i <= radius; i++) {
      for (let j = -radius; j <= radius; j++) {
        if (i * i + j * j <= radius * radius) {
          const pixelX = Math.round(x + i);
          const pixelY = Math.round(y + j);
          if (pixelX >= 0 && pixelX < image.bitmap.width && pixelY >= 0 && pixelY < image.bitmap.height) {
            image.setPixelColor(color, pixelX, pixelY);
          }
        }
      }
    }
  }

  /**
   * Draw a star
   */
  drawStar(image, x, y, radius, color) {
    const points = 8;
    for (let i = 0; i < points; i++) {
      const angle = (i * Math.PI * 2) / points;
      const endX = x + Math.cos(angle) * radius;
      const endY = y + Math.sin(angle) * radius;
      
      this.drawLine(image, x, y, endX, endY, color);
    }
  }

  /**
   * Draw a line
   */
  drawLine(image, x1, y1, x2, y2, color) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      if (x >= 0 && x < image.bitmap.width && y >= 0 && y < image.bitmap.height) {
        image.setPixelColor(color, x, y);
      }

      if (x === x2 && y === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Draw xG legend
   */
  async drawXGLegend(image, font) {
    const legendX = 600;
    const legendY = 650;

    // Draw legend title
    image.print(font, legendX, legendY, 'xG Legend');

    // Draw circles of different sizes
    const circleSizes = [5, 10, 15];
    const labels = ['Low xG', 'Medium xG', 'High xG'];

    for (let i = 0; i < circleSizes.length; i++) {
      const circleX = legendX - 60 + (i * 40);
      const circleY = legendY + 30;
      
      this.drawCircle(image, circleX, circleY, circleSizes[i], 0xffffffff);
      
      image.print(font, circleX, circleY + 20, labels[i]);
    }
  }

  /**
   * Draw match statistics
   */
  async drawStats(image, stats, fontSmall, homeColors, awayColors) {
    const statY = 650;
    const statGap = 35;
    let currentY = statY;

    // Key stats to display (matching the example)
    const keyStats = [
      { name: 'Possession %', home: null, away: null },
      { name: 'Total shots', home: null, away: null },
      { name: 'Shots on target', home: null, away: null },
      { name: 'Succ. Passes %', home: null, away: null },
      { name: 'xG', home: null, away: null },
      { name: 'xG open play', home: null, away: null },
      { name: 'xG set play', home: null, away: null },
      { name: 'Passes Opp. half', home: null, away: null },
      { name: 'Touches Opp. box', home: null, away: null }
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

    // Draw each stat
    for (const stat of keyStats) {
      if (stat.home !== null && stat.away !== null) {
        // Stat name (centered)
        image.print(fontSmall, 600, currentY, stat.name);

        // Home stat (left side, white text)
        image.print(fontSmall, 300, currentY, stat.home);

        // Away stat (right side, team color)
        image.print(fontSmall, 900, currentY, stat.away);

        currentY += statGap;
      }
    }
  }

  /**
   * Draw league information
   */
  async drawLeagueInfo(image, matchData, fontSmall) {
    const matchDate = new Date(matchData.general.matchTimeUTC);
    const formattedDate = matchDate.toLocaleDateString('en-ZA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Left side - Data attribution
    image.print(fontSmall, 50, 950, '|Data via Fotmob: @SAFootyAnalyst|');
    
    // Right side - League and date
    image.print(fontSmall, 950, 950, '| Premier Soccer League 2025-2026');
    image.print(fontSmall, 950, 970, `On ${formattedDate} |`);
  }

  /**
   * Download team logo if not already in assets
   * @param {string} logoUrl - URL of the team logo
   * @param {string} teamId - Team ID for filename
   * @returns {Promise<string>} Path to the saved logo
   */
  async downloadLogo(logoUrl, teamId) {
    const logoPath = path.join(this.assetsDir, `team_${teamId}.png`);
    
    // Check if logo already exists
    if (fs.existsSync(logoPath)) {
      return logoPath;
    }

    try {
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(logoPath, Buffer.from(response.data));
      logger.info(`Downloaded logo for team ${teamId}`);
      return logoPath;
    } catch (error) {
      logger.error(`Error downloading logo for team ${teamId}:`, error);
      // Return a default logo or placeholder
      return null;
    }
  }
}

module.exports = new ImageGeneratorEnhanced();

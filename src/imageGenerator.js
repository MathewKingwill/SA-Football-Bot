 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/src/imageGenerator.js b/src/imageGenerator.js
index 1984707f74144b923955d38ee79ddb2e2589d93d..f44cb065399702a7ad666b2b35f18d9b7adcda35 100644
--- a/src/imageGenerator.js
+++ b/src/imageGenerator.js
@@ -1,678 +1,723 @@
 const Jimp = require('jimp');
 const path = require('path');
 const fs = require('fs');
 const axios = require('axios');
 const logger = require('./logger');
 
+const STAT_CONFIG = [
+  { id: 'possession', label: 'Possession %', matchers: ['possession'] },
+  { id: 'totalShots', label: 'Total shots', matchers: ['totalshots', 'shotstotal', 'allshots'] },
+  { id: 'shotsOnTarget', label: 'Shots on target', matchers: ['ontarget'] },
+  { id: 'passesCompleted', label: 'Succ. Passes %', matchers: ['succpasses', 'passsuccess', 'passaccuracy'] },
+  { id: 'xg', label: 'xG', matchers: ['xg', 'expectedgoals'] },
+  { id: 'xgOpenPlay', label: 'xG open play', matchers: ['xgopen', 'openplayxg'] },
+  { id: 'xgSetPlay', label: 'xG set play', matchers: ['xgset', 'setplayxg'] },
+  { id: 'passesOppHalf', label: 'Passes Opp. half', matchers: ['passesopphalf', 'attackhalfpasses', 'finalthirdpasses'] },
+  { id: 'touchesOppBox', label: 'Touches Opp. box', matchers: ['touchesoppbox', 'touchesattackingbox', 'touchesbox'] }
+];
+
 class ImageGenerator {
   constructor() {
     this.width = 1400;
-    this.height = 1000;
-    this.backgroundColor = 0x2a2a2aff; // Dark grey background
-    this.textColor = 0xffffffff; // White text
+    this.height = 900;
+    this.backgroundColor = 0x1e1f2aff;
     this.assetsDir = path.join(__dirname, '../assets');
-    
-    // Team colors for PSL teams
+    this.pitchDimensions = { width: 340, height: 440 };
+
     this.teamColors = {
-      'kaizer chiefs': { primary: 0xffd700ff, secondary: 0x000000ff }, // Gold and black
-      'mamelodi sundowns': { primary: 0xffff00ff, secondary: 0x0000ffff }, // Yellow and blue
-      'orlando pirates': { primary: 0x000000ff, secondary: 0xffffff00 }, // Black and white
-      'supersport united': { primary: 0x0000ffff, secondary: 0xffffff00 }, // Blue and white
-      'sekhukhune united': { primary: 0xff0000ff, secondary: 0x000000ff }, // Red and black
-      'ts galaxy': { primary: 0x800080ff, secondary: 0xffffff00 }, // Purple and white
-      'cape town city': { primary: 0x00ff00ff, secondary: 0x000000ff }, // Green and black
-      'stellenbosch': { primary: 0xffa500ff, secondary: 0x000000ff }, // Orange and black
-      'royal am': { primary: 0x0000ffff, secondary: 0xff0000ff }, // Blue and red
-      'chippa united': { primary: 0x00ff00ff, secondary: 0xffff00ff }, // Green and yellow
-      'default': { primary: 0x87ceebff, secondary: 0xffff00ff } // Light blue and yellow
+      'kaizer chiefs': { primary: 0xffd700ff, secondary: 0x222222ff },
+      'mamelodi sundowns': { primary: 0xffff00ff, secondary: 0x0057ffff },
+      'orlando pirates': { primary: 0x111111ff, secondary: 0xffffffff },
+      'supersport united': { primary: 0x0057ffff, secondary: 0xffffffff },
+      'sekhukhune united': { primary: 0xc41e3aff, secondary: 0xffffffff },
+      'ts galaxy': { primary: 0x9932ccff, secondary: 0xffffffff },
+      'cape town city': { primary: 0x003b8bff, secondary: 0xffd700ff },
+      'stellenbosch': { primary: 0x7b241cff, secondary: 0xffe4b5ff },
+      'royal am': { primary: 0x0000ffff, secondary: 0xffd700ff },
+      'chippa united': { primary: 0x0033a0ff, secondary: 0xffffffff },
+      'default': { primary: 0x364156ff, secondary: 0xf1f1f1ff }
     };
-    
-    // Create assets directory if it doesn't exist
+
     if (!fs.existsSync(this.assetsDir)) {
       fs.mkdirSync(this.assetsDir, { recursive: true });
     }
   }
 
-  /**
-   * Download team logo if not already in assets
-   * @param {string} logoUrl - URL of the team logo
-   * @param {string} teamId - Team ID for filename
-   * @returns {Promise<string>} Path to the saved logo
-   */
-  async downloadLogo(logoUrl, teamId) {
-    const logoPath = path.join(this.assetsDir, `team_${teamId}.png`);
-    
-    // Check if logo already exists
-    if (fs.existsSync(logoPath)) {
-      return logoPath;
-    }
-
-    try {
-      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
-      fs.writeFileSync(logoPath, Buffer.from(response.data));
-      logger.info(`Downloaded logo for team ${teamId}`);
-      return logoPath;
-    } catch (error) {
-      logger.error(`Error downloading logo for team ${teamId}:`, error);
-      // Return a default logo or placeholder
-      return null;
-    }
-  }
-
-  /**
-   * Generate a match graphic similar to the provided example
-   * @param {Object} matchData - Match data from Fotmob API
-   * @returns {Promise<Buffer>} Image buffer
-   */
   async generateMatchGraphic(matchData) {
     try {
       logger.info('Creating match graphic...');
-      // Create a new image
-      const image = new Jimp(this.width, this.height, this.backgroundColor);
 
-      logger.info('Loading fonts...');
-      // Load fonts
-      const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
-      const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
-      const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
-      const fontTiny = await Jimp.loadFont(Jimp.FONT_SANS_12_WHITE);
+      const image = new Jimp(this.width, this.height, this.backgroundColor);
+      const fonts = await this.loadFonts();
 
-      logger.info('Getting team data...');
-      // Get team data
       const homeTeam = matchData.general.homeTeam;
       const awayTeam = matchData.general.awayTeam;
-      const homeScore = matchData.header.status.scoreStr.split('-')[0].trim();
-      const awayScore = matchData.header.status.scoreStr.split('-')[1].trim();
+      const [homeScore, awayScore] = matchData.header.status.scoreStr
+        .split('-')
+        .map(value => value.trim());
+
+      const stats = this.extractStats(matchData);
+      const shots = this.extractShotData(matchData);
 
-      // Get team colors
       const homeColors = this.getTeamColors(homeTeam.name);
       const awayColors = this.getTeamColors(awayTeam.name);
 
-      logger.info('Drawing team info with badges...');
-      // Draw team badges and names
-      await this.drawTeamInfo(image, homeTeam, awayTeam, homeScore, awayScore, homeColors, awayColors, fontLarge, fontMedium);
-
-      logger.info('Drawing pitch visualizations...');
-      // Draw football pitch halves
-      await this.drawPitchVisualization(image, matchData, homeColors, awayColors);
-
-      logger.info('Drawing stats...');
-      // Draw match stats in center
-      const stats = matchData.content.stats?.Periods?.All || [];
-      if (stats.length > 0) {
-        await this.drawStats(image, stats, fontSmall, homeColors, awayColors);
-      }
+      await this.drawScoreboard({
+        image,
+        homeTeam,
+        awayTeam,
+        homeScore,
+        awayScore,
+        homeColors,
+        awayColors,
+        stats,
+        fonts
+      });
+
+      await this.drawPitches({
+        image,
+        homeColors,
+        awayColors,
+        shots,
+        fonts
+      });
+
+      await this.drawStatsPanel({
+        image,
+        stats,
+        fonts,
+        homeColors,
+        awayColors
+      });
+
+      await this.drawLegend(image, fonts.tiny);
+      await this.drawFooter(image, matchData, fonts.small);
 
-      logger.info('Drawing xG legend...');
-      // Draw xG legend
-      await this.drawXGLegend(image, fontTiny);
-
-      logger.info('Drawing league info...');
-      // Draw league info
-      await this.drawLeagueInfo(image, matchData, fontSmall);
-
-      logger.info('Converting to buffer...');
-      // Return as buffer
       const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
-      
       logger.info(`Generated match graphic for ${homeTeam.name} vs ${awayTeam.name}`);
       return buffer;
     } catch (error) {
       logger.error('Error generating match graphic:', error);
       throw error;
     }
   }
 
-  /**
-   * Get team colors based on team name
-   * @param {string} teamName - Name of the team
-   * @returns {Object} Team colors object
-   */
-  getTeamColors(teamName) {
-    const normalizedName = teamName.toLowerCase();
-    for (const [key, colors] of Object.entries(this.teamColors)) {
-      if (normalizedName.includes(key) || key.includes(normalizedName)) {
-        return colors;
-      }
-    }
-    return this.teamColors.default;
+  async loadFonts() {
+    const [large, medium, small, tiny] = await Promise.all([
+      Jimp.loadFont(Jimp.FONT_SANS_64_WHITE),
+      Jimp.loadFont(Jimp.FONT_SANS_32_WHITE),
+      Jimp.loadFont(Jimp.FONT_SANS_16_WHITE),
+      Jimp.loadFont(Jimp.FONT_SANS_12_WHITE)
+    ]);
+
+    return {
+      large,
+      medium,
+      small,
+      tiny
+    };
   }
 
-  /**
-   * Draw team information with badges
-   */
-  async drawTeamInfo(image, homeTeam, awayTeam, homeScore, awayScore, homeColors, awayColors, fontLarge, fontMedium) {
-    // Download team logos
-    const homeLogoPath = await this.downloadLogo(homeTeam.logoUrl, homeTeam.id);
-    const awayLogoPath = await this.downloadLogo(awayTeam.logoUrl, awayTeam.id);
+  extractStats(matchData) {
+    const rawStats = matchData.content?.stats?.Periods?.All || [];
+    const processed = [];
+
+    const statsWithKeys = rawStats.map(stat => ({
+      ...stat,
+      normalized: this.normalizeTitle(stat.title)
+    }));
+
+    for (const config of STAT_CONFIG) {
+      const statEntry = statsWithKeys.find(item =>
+        config.matchers.some(keyword =>
+          item.normalized.includes(keyword) &&
+          !(config.id === 'totalShots' && item.normalized.includes('ontarget'))
+        )
+      );
 
-    // Load and position logos
-    let homeLogo, awayLogo;
-    try {
-      if (homeLogoPath) {
-        homeLogo = await Jimp.read(homeLogoPath);
-        homeLogo.resize(80, 80);
-        image.composite(homeLogo, 100, 50);
-      }
-      
-      if (awayLogoPath) {
-        awayLogo = await Jimp.read(awayLogoPath);
-        awayLogo.resize(80, 80);
-        image.composite(awayLogo, 1220, 50);
+      if (statEntry) {
+        processed.push({
+          id: config.id,
+          label: config.label,
+          home: statEntry.stats?.[0] ?? '-',
+          away: statEntry.stats?.[1] ?? '-'
+        });
       }
-    } catch (error) {
-      logger.error('Error loading team logos:', error);
     }
 
-    // Draw team names with team colors
-    image.print(fontMedium, 100, 140, homeTeam.name);
-    image.print(fontMedium, 1100, 140, awayTeam.name);
-
-    // Draw scores with team colors
-    image.print(fontLarge, 100, 180, homeScore);
-    image.print(fontLarge, 1200, 180, awayScore);
-
-    // Draw 'Goals' label in center
-    image.print(fontMedium, 600, 200, 'Goals');
+    return processed;
   }
 
-  /**
-   * Draw football pitch visualization with shot locations
-   */
-  async drawPitchVisualization(image, matchData, homeColors, awayColors) {
-    // Left pitch (home team attacking)
-    const leftPitchX = 50;
-    const leftPitchY = 300;
-    const pitchWidth = 200;
-    const pitchHeight = 300;
-
-    // Right pitch (away team attacking)
-    const rightPitchX = 1150;
-    const rightPitchY = 300;
-
-    // Draw pitch outlines
-    this.drawPitchOutline(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight);
-    this.drawPitchOutline(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight);
-
-    // Draw goal areas
-    this.drawGoalArea(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight);
-    this.drawGoalArea(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight);
-
-    // Draw shot locations (mock data for now - would need real shot data from API)
-    this.drawShotLocations(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight, homeColors, 'home');
-    this.drawShotLocations(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight, awayColors, 'away');
+  normalizeTitle(title) {
+    return (title || '')
+      .toString()
+      .toLowerCase()
+      .replace(/[^a-z0-9]/g, '');
   }
 
-  /**
-   * Draw pitch outline
-   */
-  drawPitchOutline(image, x, y, width, height) {
-    // Draw pitch border
-    for (let i = 0; i < width; i++) {
-      image.setPixelColor(0xffffffff, x + i, y);
-      image.setPixelColor(0xffffffff, x + i, y + height);
-    }
-    for (let i = 0; i < height; i++) {
-      image.setPixelColor(0xffffffff, x, y + i);
-      image.setPixelColor(0xffffffff, x + width, y + i);
+  extractShotData(matchData) {
+    const shotmap = matchData.content?.shotmap;
+    if (!shotmap) {
+      return { home: [], away: [] };
     }
 
-    // Draw center line
-    for (let i = 0; i < height; i++) {
-      image.setPixelColor(0xffffffff, x + width / 2, y + i);
+    let shots = [];
+    if (Array.isArray(shotmap)) {
+      shots = shotmap;
+    } else if (Array.isArray(shotmap.shots)) {
+      shots = shotmap.shots;
+    } else if (Array.isArray(shotmap.home) || Array.isArray(shotmap.away)) {
+      shots = [
+        ...(shotmap.home || []).map(shot => ({ ...shot, isHome: true })),
+        ...(shotmap.away || []).map(shot => ({ ...shot, isHome: false }))
+      ];
     }
 
-    // Draw penalty area
-    const penaltyWidth = width * 0.6;
-    const penaltyHeight = height * 0.3;
-    const penaltyX = x + (width - penaltyWidth) / 2;
-    const penaltyY = y + height - penaltyHeight;
+    const formatted = shots
+      .map(shot => {
+        const x = this.normaliseShotCoordinate(shot.x);
+        const y = this.normaliseShotCoordinate(shot.y);
+        if (x === null || y === null) {
+          return null;
+        }
 
-    for (let i = 0; i < penaltyWidth; i++) {
-      image.setPixelColor(0xffffffff, penaltyX + i, penaltyY);
-    }
-    for (let i = 0; i < penaltyHeight; i++) {
-      image.setPixelColor(0xffffffff, penaltyX, penaltyY + i);
-      image.setPixelColor(0xffffffff, penaltyX + penaltyWidth, penaltyY + i);
-    }
+        const xg = this.parseNumber(shot.xg ?? shot.expectedGoals ?? shot.xG) ?? 0.05;
+        const isGoal = Boolean(
+          shot.isGoal ||
+          shot.goal ||
+          (typeof shot.result === 'string' && shot.result.toLowerCase().includes('goal'))
+        );
+
+        return {
+          x,
+          y,
+          xg,
+          isGoal,
+          isHome: this.isHomeShot(matchData, shot)
+        };
+      })
+      .filter(Boolean);
+
+    return {
+      home: formatted.filter(shot => shot.isHome),
+      away: formatted.filter(shot => !shot.isHome)
+    };
   }
 
-  /**
-   * Draw goal area
-   */
-  drawGoalArea(image, x, y, width, height) {
-    const goalWidth = width * 0.3;
-    const goalX = x + (width - goalWidth) / 2;
-    const goalY = y + height - 10;
+  isHomeShot(matchData, shot) {
+    if (typeof shot.isHome === 'boolean') {
+      return shot.isHome;
+    }
 
-    for (let i = 0; i < goalWidth; i++) {
-      image.setPixelColor(0xffffffff, goalX + i, goalY);
+    if (typeof shot.teamId !== 'undefined') {
+      return String(shot.teamId) === String(matchData.general.homeTeam.id);
     }
+
+    if (typeof shot.team === 'string') {
+      return shot.team.toLowerCase().includes(matchData.general.homeTeam.name.toLowerCase());
+    }
+
+    return Boolean(shot.home);
   }
 
-  /**
-   * Draw shot locations on pitch
-   */
-  drawShotLocations(image, x, y, width, height, colors, side) {
-    // Mock shot locations (in real implementation, this would come from match data)
-    const shots = [
-      { x: 0.3, y: 0.7, xg: 0.3, isGoal: false },
-      { x: 0.5, y: 0.8, xg: 0.1, isGoal: false },
-      { x: 0.7, y: 0.6, xg: 0.5, isGoal: true },
-      { x: 0.4, y: 0.9, xg: 0.2, isGoal: false }
-    ];
+  normaliseShotCoordinate(value) {
+    if (value === null || typeof value === 'undefined') {
+      return null;
+    }
 
-    shots.forEach(shot => {
-      const shotX = x + (shot.x * width);
-      const shotY = y + (shot.y * height);
-      const radius = Math.max(5, Math.min(15, shot.xg * 20));
+    const numeric = this.parseNumber(value);
+    if (numeric === null) {
+      return null;
+    }
 
-      // Draw shot circle
-      this.drawCircle(image, shotX, shotY, radius, colors.primary);
+    if (numeric > 1) {
+      return Math.max(0, Math.min(1, numeric / 100));
+    }
 
-      // Draw goal indicator
-      if (shot.isGoal) {
-        this.drawStar(image, shotX, shotY, radius + 5, 0xffffffff);
-      }
-    });
+    return Math.max(0, Math.min(1, numeric));
   }
 
-  /**
-   * Draw a circle
-   */
-  drawCircle(image, x, y, radius, color) {
-    for (let i = -radius; i <= radius; i++) {
-      for (let j = -radius; j <= radius; j++) {
-        if (i * i + j * j <= radius * radius) {
-          const pixelX = Math.round(x + i);
-          const pixelY = Math.round(y + j);
-          if (pixelX >= 0 && pixelX < image.bitmap.width && pixelY >= 0 && pixelY < image.bitmap.height) {
-            image.setPixelColor(color, pixelX, pixelY);
-          }
-        }
-      }
-    }
+  parseNumber(value) {
+    const numeric = Number(value);
+    return Number.isFinite(numeric) ? numeric : null;
   }
 
-  /**
-   * Draw a star
-   */
-  drawStar(image, x, y, radius, color) {
-    const points = 8;
-    for (let i = 0; i < points; i++) {
-      const angle = (i * Math.PI * 2) / points;
-      const endX = x + Math.cos(angle) * radius;
-      const endY = y + Math.sin(angle) * radius;
-      
-      this.drawLine(image, x, y, endX, endY, color);
+  async drawScoreboard({ image, homeTeam, awayTeam, homeScore, awayScore, homeColors, awayColors, stats, fonts }) {
+    const headerHeight = 220;
+
+    const homePanel = await new Jimp(Math.floor(this.width / 2), headerHeight, this.addOpacity(homeColors.primary, 0.9));
+    const awayPanel = await new Jimp(Math.ceil(this.width / 2), headerHeight, this.addOpacity(awayColors.primary, 0.9));
+
+    image.composite(homePanel, 0, 0);
+    image.composite(awayPanel, Math.floor(this.width / 2), 0);
+
+    const overlay = await new Jimp(this.width, headerHeight, 0x00000055);
+    image.composite(overlay, 0, 0);
+
+    const divider = await new Jimp(4, headerHeight, 0xffffffff);
+    image.composite(divider, Math.floor(this.width / 2) - 2, 0);
+
+    await this.drawTeamBadge(image, homeTeam, 120, 60, 110);
+    await this.drawTeamBadge(image, awayTeam, this.width - 230, 60, 110);
+
+    const halfWidth = Math.floor(this.width / 2);
+
+    image.print(
+      fonts.medium,
+      220,
+      40,
+      {
+        text: homeTeam.name.toUpperCase(),
+        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT
+      },
+      halfWidth - 260,
+      40
+    );
+
+    image.print(
+      fonts.medium,
+      halfWidth + 40,
+      40,
+      {
+        text: awayTeam.name.toUpperCase(),
+        alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT
+      },
+      halfWidth - 160,
+      40
+    );
+
+    image.print(
+      fonts.large,
+      0,
+      100,
+      {
+        text: homeScore,
+        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
+      },
+      halfWidth,
+      80
+    );
+
+    image.print(
+      fonts.large,
+      halfWidth,
+      100,
+      {
+        text: awayScore,
+        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
+      },
+      halfWidth,
+      80
+    );
+
+    image.print(
+      fonts.small,
+      halfWidth - 140,
+      170,
+      {
+        text: 'Goals',
+        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
+      },
+      280,
+      30
+    );
+
+    const xg = stats.find(stat => stat.id === 'xg');
+    if (xg) {
+      image.print(
+        fonts.small,
+        0,
+        200,
+        {
+          text: `xG ${xg.home}`,
+          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
+        },
+        halfWidth,
+        30
+      );
+
+      image.print(
+        fonts.small,
+        halfWidth,
+        200,
+        {
+          text: `xG ${xg.away}`,
+          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
+        },
+        halfWidth,
+        30
+      );
     }
   }
 
-  /**
-   * Draw a line
-   */
-  drawLine(image, x1, y1, x2, y2, color) {
-    const dx = Math.abs(x2 - x1);
-    const dy = Math.abs(y2 - y1);
-    const sx = x1 < x2 ? 1 : -1;
-    const sy = y1 < y2 ? 1 : -1;
-    let err = dx - dy;
-
-    let x = x1;
-    let y = y1;
-
-    while (true) {
-      if (x >= 0 && x < image.bitmap.width && y >= 0 && y < image.bitmap.height) {
-        image.setPixelColor(color, x, y);
+  async drawTeamBadge(image, team, x, y, size = 100) {
+    try {
+      if (!team.logoUrl) {
+        return;
       }
 
-      if (x === x2 && y === y2) break;
-
-      const e2 = 2 * err;
-      if (e2 > -dy) {
-        err -= dy;
-        x += sx;
-      }
-      if (e2 < dx) {
-        err += dx;
-        y += sy;
+      const logoPath = await this.downloadLogo(team.logoUrl, team.id);
+      if (!logoPath) {
+        return;
       }
+
+      const badge = await Jimp.read(logoPath);
+      badge.contain(size, size, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
+      image.composite(badge, x, y);
+    } catch (error) {
+      logger.warn(`Unable to render badge for ${team.name}: ${error.message}`);
     }
   }
 
-  /**
-   * Draw xG legend
-   */
-  async drawXGLegend(image, font) {
-    const legendX = 600;
-    const legendY = 650;
+  addOpacity(color, alpha = 1) {
+    const rgba = Jimp.intToRGBA(color);
+    const a = Math.max(0, Math.min(255, Math.round(255 * alpha)));
+    return Jimp.rgbaToInt(rgba.r, rgba.g, rgba.b, a);
+  }
 
-    // Draw legend title
-    image.print(font, legendX, legendY, 'xG Legend');
+  async drawPitches({ image, homeColors, awayColors, shots, fonts }) {
+    const pitchY = 260;
+    const leftPitchX = 110;
+    const rightPitchX = this.width - this.pitchDimensions.width - 110;
+
+    this.drawPitchBase(image, leftPitchX, pitchY, this.pitchDimensions.width, this.pitchDimensions.height);
+    this.drawPitchBase(image, rightPitchX, pitchY, this.pitchDimensions.width, this.pitchDimensions.height);
+
+    image.print(
+      fonts.small,
+      leftPitchX,
+      pitchY - 30,
+      {
+        text: 'Home shots',
+        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT
+      },
+      this.pitchDimensions.width,
+      20
+    );
+
+    image.print(
+      fonts.small,
+      rightPitchX,
+      pitchY - 30,
+      {
+        text: 'Away shots',
+        alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT
+      },
+      this.pitchDimensions.width,
+      20
+    );
+
+    this.drawShotLocationsOnPitch({
+      image,
+      offsetX: leftPitchX,
+      offsetY: pitchY,
+      width: this.pitchDimensions.width,
+      height: this.pitchDimensions.height,
+      shots: shots.home,
+      teamColor: homeColors.primary,
+      mirror: false
+    });
 
-    // Draw circles of different sizes
-    const circleSizes = [5, 10, 15];
-    const labels = ['Low xG', 'Medium xG', 'High xG'];
+    this.drawShotLocationsOnPitch({
+      image,
+      offsetX: rightPitchX,
+      offsetY: pitchY,
+      width: this.pitchDimensions.width,
+      height: this.pitchDimensions.height,
+      shots: shots.away,
+      teamColor: awayColors.primary,
+      mirror: true
+    });
 
-    for (let i = 0; i < circleSizes.length; i++) {
-      const circleX = legendX - 60 + (i * 40);
-      const circleY = legendY + 30;
-      
-      this.drawCircle(image, circleX, circleY, circleSizes[i], 0xffffffff);
-      
-      image.print(font, circleX, circleY + 20, labels[i]);
+    if (!shots.home.length) {
+      image.print(
+        fonts.tiny,
+        leftPitchX,
+        pitchY + Math.floor(this.pitchDimensions.height / 2) - 10,
+        {
+          text: 'No shot data',
+          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
+        },
+        this.pitchDimensions.width,
+        20
+      );
     }
-  }
 
-  /**
-   * Draw league information
-   */
-  async drawLeagueInfo(image, matchData, fontSmall) {
-    const matchDate = new Date(matchData.general.matchTimeUTC);
-    const formattedDate = matchDate.toLocaleDateString('en-ZA', {
-      month: 'long',
-      day: 'numeric',
-      year: 'numeric'
-    });
-    
-    // Left side - Data attribution
-    image.print(fontSmall, 50, 950, '|Data via Fotmob: @SAFootyAnalyst|');
-    
-    // Right side - League and date
-    image.print(fontSmall, 950, 950, '| Premier Soccer League 2025-2026');
-    image.print(fontSmall, 950, 970, `On ${formattedDate} |`);
+    if (!shots.away.length) {
+      image.print(
+        fonts.tiny,
+        rightPitchX,
+        pitchY + Math.floor(this.pitchDimensions.height / 2) - 10,
+        {
+          text: 'No shot data',
+          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
+        },
+        this.pitchDimensions.width,
+        20
+      );
+    }
   }
 
-  /**
-   * Draw football pitch visualization with shot locations
-   * @param {Jimp} image - Jimp image object
-   * @param {Object} matchData - Match data
-   * @param {Object} homeColors - Home team colors
-   * @param {Object} awayColors - Away team colors
-   */
-  async drawPitchVisualization(image, matchData, homeColors, awayColors) {
-    // Left pitch (home team attacking)
-    const leftPitchX = 50;
-    const leftPitchY = 300;
-    const pitchWidth = 200;
-    const pitchHeight = 300;
-
-    // Right pitch (away team attacking)
-    const rightPitchX = 1150;
-    const rightPitchY = 300;
-
-    // Draw pitch outlines
-    this.drawPitchOutline(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight);
-    this.drawPitchOutline(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight);
-
-    // Draw goal areas
-    this.drawGoalArea(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight);
-    this.drawGoalArea(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight);
-
-    // Draw shot locations (mock data for now - would need real shot data from API)
-    this.drawShotLocations(image, leftPitchX, leftPitchY, pitchWidth, pitchHeight, homeColors, 'home');
-    this.drawShotLocations(image, rightPitchX, rightPitchY, pitchWidth, pitchHeight, awayColors, 'away');
+  drawPitchBase(image, x, y, width, height) {
+    const surface = new Jimp(width, height, 0x111418ff);
+    image.composite(surface, x, y);
+
+    const lineColor = 0xd4d4d4ff;
+    this.drawPitchLines(image, x, y, width, height, lineColor);
   }
 
-  /**
-   * Draw pitch outline
-   * @param {Jimp} image - Jimp image object
-   * @param {number} x - X position
-   * @param {number} y - Y position
-   * @param {number} width - Width
-   * @param {number} height - Height
-   */
-  drawPitchOutline(image, x, y, width, height) {
-    // Draw pitch border
-    for (let i = 0; i < width; i++) {
-      image.setPixelColor(0xffffffff, x + i, y);
-      image.setPixelColor(0xffffffff, x + i, y + height);
+  drawPitchLines(image, x, y, width, height, color) {
+    // Outer border
+    for (let i = 0; i <= width; i++) {
+      image.setPixelColor(color, x + i, y);
+      image.setPixelColor(color, x + i, y + height);
     }
-    for (let i = 0; i < height; i++) {
-      image.setPixelColor(0xffffffff, x, y + i);
-      image.setPixelColor(0xffffffff, x + width, y + i);
+    for (let i = 0; i <= height; i++) {
+      image.setPixelColor(color, x, y + i);
+      image.setPixelColor(color, x + width, y + i);
     }
 
-    // Draw center line
-    for (let i = 0; i < height; i++) {
-      image.setPixelColor(0xffffffff, x + width / 2, y + i);
+    // Center line
+    for (let i = 0; i <= height; i++) {
+      image.setPixelColor(color, x + Math.floor(width / 2), y + i);
     }
 
-    // Draw penalty area
-    const penaltyWidth = width * 0.6;
-    const penaltyHeight = height * 0.3;
-    const penaltyX = x + (width - penaltyWidth) / 2;
-    const penaltyY = y + height - penaltyHeight;
+    // Penalty boxes and goal boxes
+    const penaltyWidth = Math.floor(width * 0.6);
+    const penaltyHeight = Math.floor(height * 0.2);
+    const penaltyX = x + Math.floor((width - penaltyWidth) / 2);
 
-    for (let i = 0; i < penaltyWidth; i++) {
-      image.setPixelColor(0xffffffff, penaltyX + i, penaltyY);
+    for (let i = 0; i <= penaltyWidth; i++) {
+      image.setPixelColor(color, penaltyX + i, y);
+      image.setPixelColor(color, penaltyX + i, y + height - penaltyHeight);
+      image.setPixelColor(color, penaltyX + i, y + penaltyHeight);
+      image.setPixelColor(color, penaltyX + i, y + height);
     }
-    for (let i = 0; i < penaltyHeight; i++) {
-      image.setPixelColor(0xffffffff, penaltyX, penaltyY + i);
-      image.setPixelColor(0xffffffff, penaltyX + penaltyWidth, penaltyY + i);
-    }
-  }
 
-  /**
-   * Draw goal area
-   * @param {Jimp} image - Jimp image object
-   * @param {number} x - X position
-   * @param {number} y - Y position
-   * @param {number} width - Width
-   * @param {number} height - Height
-   */
-  drawGoalArea(image, x, y, width, height) {
-    const goalWidth = width * 0.3;
-    const goalX = x + (width - goalWidth) / 2;
-    const goalY = y + height - 10;
-
-    for (let i = 0; i < goalWidth; i++) {
-      image.setPixelColor(0xffffffff, goalX + i, goalY);
+    for (let i = 0; i <= penaltyHeight; i++) {
+      image.setPixelColor(color, penaltyX, y + i);
+      image.setPixelColor(color, penaltyX + penaltyWidth, y + i);
+      image.setPixelColor(color, penaltyX, y + height - i);
+      image.setPixelColor(color, penaltyX + penaltyWidth, y + height - i);
     }
+
+    // Center circle
+    const circleRadius = Math.floor(width * 0.13);
+    this.drawCircle(image, x + Math.floor(width / 2), y + Math.floor(height / 2), circleRadius, color, false);
   }
 
-  /**
-   * Draw shot locations on pitch
-   * @param {Jimp} image - Jimp image object
-   * @param {number} x - X position
-   * @param {number} y - Y position
-   * @param {number} width - Width
-   * @param {number} height - Height
-   * @param {Object} colors - Team colors
-   * @param {string} side - 'home' or 'away'
-   */
-  drawShotLocations(image, x, y, width, height, colors, side) {
-    // Mock shot locations (in real implementation, this would come from match data)
-    const shots = [
-      { x: 0.3, y: 0.7, xg: 0.3, isGoal: false },
-      { x: 0.5, y: 0.8, xg: 0.1, isGoal: false },
-      { x: 0.7, y: 0.6, xg: 0.5, isGoal: true },
-      { x: 0.4, y: 0.9, xg: 0.2, isGoal: false }
-    ];
+  drawShotLocationsOnPitch({ image, offsetX, offsetY, width, height, shots, teamColor, mirror }) {
+    if (!shots || shots.length === 0) {
+      return;
+    }
 
     shots.forEach(shot => {
-      const shotX = x + (shot.x * width);
-      const shotY = y + (shot.y * height);
-      const radius = Math.max(5, Math.min(15, shot.xg * 20));
+      const relativeX = mirror ? 1 - shot.x : shot.x;
+      const pointX = offsetX + Math.round(relativeX * width);
+      const pointY = offsetY + Math.round((1 - shot.y) * height);
 
-      // Draw shot circle
-      this.drawCircle(image, shotX, shotY, radius, colors.primary);
+      const radius = Math.max(6, Math.min(18, shot.xg * 22));
+      this.drawCircle(image, pointX, pointY, radius, this.addOpacity(teamColor, 0.85));
 
-      // Draw goal indicator
       if (shot.isGoal) {
-        this.drawStar(image, shotX, shotY, radius + 5, 0xffffffff);
+        this.drawRing(image, pointX, pointY, radius + 4, 2, 0xffffffff);
       }
     });
   }
 
-  /**
-   * Draw a circle
-   * @param {Jimp} image - Jimp image object
-   * @param {number} x - X position
-   * @param {number} y - Y position
-   * @param {number} radius - Circle radius
-   * @param {number} color - Circle color
-   */
-  drawCircle(image, x, y, radius, color) {
-    for (let i = -radius; i <= radius; i++) {
-      for (let j = -radius; j <= radius; j++) {
-        if (i * i + j * j <= radius * radius) {
-          const pixelX = Math.round(x + i);
-          const pixelY = Math.round(y + j);
-          if (pixelX >= 0 && pixelX < image.bitmap.width && pixelY >= 0 && pixelY < image.bitmap.height) {
-            image.setPixelColor(color, pixelX, pixelY);
+  drawCircle(image, centerX, centerY, radius, color, filled = true) {
+    for (let x = -radius; x <= radius; x++) {
+      for (let y = -radius; y <= radius; y++) {
+        if (x * x + y * y <= radius * radius) {
+          const px = centerX + x;
+          const py = centerY + y;
+          if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
+            if (filled) {
+              image.setPixelColor(color, px, py);
+            }
           }
         }
       }
     }
-  }
 
-  /**
-   * Draw a star
-   * @param {Jimp} image - Jimp image object
-   * @param {number} x - X position
-   * @param {number} y - Y position
-   * @param {number} radius - Star radius
-   * @param {number} color - Star color
-   */
-  drawStar(image, x, y, radius, color) {
-    const points = 8;
-    for (let i = 0; i < points; i++) {
-      const angle = (i * Math.PI * 2) / points;
-      const endX = x + Math.cos(angle) * radius;
-      const endY = y + Math.sin(angle) * radius;
-      
-      // Draw line from center to point
-      this.drawLine(image, x, y, endX, endY, color);
+    if (!filled) {
+      this.drawRing(image, centerX, centerY, radius, 1, color);
     }
   }
 
-  /**
-   * Draw a line
-   * @param {Jimp} image - Jimp image object
-   * @param {number} x1 - Start X
-   * @param {number} y1 - Start Y
-   * @param {number} x2 - End X
-   * @param {number} y2 - End Y
-   * @param {number} color - Line color
-   */
-  drawLine(image, x1, y1, x2, y2, color) {
-    const dx = Math.abs(x2 - x1);
-    const dy = Math.abs(y2 - y1);
-    const sx = x1 < x2 ? 1 : -1;
-    const sy = y1 < y2 ? 1 : -1;
-    let err = dx - dy;
-
-    let x = x1;
-    let y = y1;
-
-    while (true) {
-      if (x >= 0 && x < image.bitmap.width && y >= 0 && y < image.bitmap.height) {
-        image.setPixelColor(color, x, y);
+  drawRing(image, centerX, centerY, radius, thickness, color) {
+    for (let r = radius - thickness; r <= radius; r++) {
+      for (let angle = 0; angle < 360; angle++) {
+        const rad = (angle * Math.PI) / 180;
+        const px = Math.round(centerX + r * Math.cos(rad));
+        const py = Math.round(centerY + r * Math.sin(rad));
+        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
+          image.setPixelColor(color, px, py);
+        }
       }
+    }
+  }
 
-      if (x === x2 && y === y2) break;
+  drawStatsPanel({ image, stats, fonts, homeColors, awayColors }) {
+    if (!stats.length) {
+      return;
+    }
 
-      const e2 = 2 * err;
-      if (e2 > -dy) {
-        err -= dy;
-        x += sx;
-      }
-      if (e2 < dx) {
-        err += dx;
-        y += sy;
-      }
+    const panelWidth = 520;
+    const panelHeight = stats.length * 46 + 60;
+    const startX = Math.floor((this.width - panelWidth) / 2);
+    const startY = 260;
+
+    const panel = new Jimp(panelWidth, panelHeight, 0x111418ff);
+    image.composite(panel, startX, startY);
+
+    for (let i = 0; i <= panelWidth; i++) {
+      image.setPixelColor(0x33363eff, startX + i, startY);
+      image.setPixelColor(0x33363eff, startX + i, startY + panelHeight);
     }
+
+    const homeColor = this.addOpacity(homeColors?.primary ?? this.teamColors.default.primary, 0.9);
+    const awayColor = this.addOpacity(awayColors?.primary ?? this.teamColors.default.primary, 0.9);
+
+    stats.forEach((stat, index) => {
+      const rowY = startY + 30 + index * 46;
+      if (index % 2 === 1) {
+        for (let x = 0; x < panelWidth; x++) {
+          image.setPixelColor(0x1b1e28ff, startX + x, rowY - 10);
+        }
+      }
+
+      const circleY = rowY + 12;
+      this.drawCircle(image, startX + 18, circleY, 6, homeColor);
+      this.drawCircle(image, startX + panelWidth - 18, circleY, 6, awayColor);
+
+      image.print(
+        fonts.small,
+        startX + 38,
+        rowY,
+        {
+          text: stat.home,
+          alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT
+        },
+        140,
+        30
+      );
+
+      image.print(
+        fonts.small,
+        startX + (panelWidth - 160) / 2,
+        rowY,
+        {
+          text: stat.label,
+          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
+        },
+        160,
+        30
+      );
+
+      image.print(
+        fonts.small,
+        startX + panelWidth - 182,
+        rowY,
+        {
+          text: stat.away,
+          alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT
+        },
+        140,
+        30
+      );
+    });
+
+    const legendY = startY + panelHeight - 22;
+    this.drawCircle(image, startX + 40, legendY, 6, homeColor);
+    image.print(
+      fonts.tiny,
+      startX + 52,
+      legendY - 8,
+      'Home'
+    );
+
+    this.drawCircle(image, startX + panelWidth - 80, legendY, 6, awayColor);
+    image.print(
+      fonts.tiny,
+      startX + panelWidth - 68,
+      legendY - 8,
+      'Away'
+    );
   }
 
-  /**
-   * Draw xG legend
-   * @param {Jimp} image - Jimp image object
-   * @param {Font} font - Font to use
-   */
-  async drawXGLegend(image, font) {
-    const legendX = 600;
-    const legendY = 650;
-
-    // Draw legend title
-    image.print(font, legendX, legendY, {
-      text: 'xG Legend',
-      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
-    }, 200, 20);
-
-    // Draw circles of different sizes
-    const circleSizes = [5, 10, 15];
+  async drawLegend(image, font) {
+    const legendY = this.height - 150;
+    const legendX = Math.floor((this.width - 320) / 2);
+
+    image.print(font, legendX, legendY, 'xG Legend');
+
+    const sizes = [6, 12, 18];
     const labels = ['Low xG', 'Medium xG', 'High xG'];
 
-    for (let i = 0; i < circleSizes.length; i++) {
-      const circleX = legendX - 60 + (i * 40);
-      const circleY = legendY + 30;
-      
-      this.drawCircle(image, circleX, circleY, circleSizes[i], 0xffffffff);
-      
-      image.print(font, circleX, circleY + 20, {
-        text: labels[i],
-        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
-      }, 60, 15);
-    }
+    sizes.forEach((size, index) => {
+      const cx = legendX + 30 + index * 110;
+      const cy = legendY + 40;
+      this.drawCircle(image, cx, cy, size, 0xffffffff);
+      image.print(font, cx - 40, cy + 25, labels[index]);
+    });
   }
 
-  /**
-   * Draw match statistics on the graphic
-   * @param {Jimp} image - Jimp image object
-   * @param {Array} stats - Match statistics
-   * @param {Font} fontSmall - Small sized font
-   * @param {Object} homeColors - Home team colors
-   * @param {Object} awayColors - Away team colors
-   */
-  async drawStats(image, stats, fontSmall, homeColors, awayColors) {
-    const statY = 650;
-    const statGap = 35;
-    let currentY = statY;
-
-    // Key stats to display (matching the example)
-    const keyStats = [
-      { name: 'Possession %', home: null, away: null },
-      { name: 'Total shots', home: null, away: null },
-      { name: 'Shots on target', home: null, away: null },
-      { name: 'Succ. Passes %', home: null, away: null },
-      { name: 'xG', home: null, away: null },
-      { name: 'xG open play', home: null, away: null },
-      { name: 'xG set play', home: null, away: null },
-      { name: 'Passes Opp. half', home: null, away: null },
-      { name: 'Touches Opp. box', home: null, away: null }
-    ];
-
-    // Map stats to our key stats
-    stats.forEach(stat => {
-      const keyStatIndex = keyStats.findIndex(ks => 
-        ks.name.toLowerCase() === stat.title.toLowerCase() ||
-        ks.name.toLowerCase().includes(stat.title.toLowerCase()) ||
-        stat.title.toLowerCase().includes(ks.name.toLowerCase())
-      );
-
-      if (keyStatIndex !== -1) {
-        keyStats[keyStatIndex].home = stat.stats[0];
-        keyStats[keyStatIndex].away = stat.stats[1];
-      }
+  async drawFooter(image, matchData, font) {
+    const footerY = this.height - 60;
+    const matchDate = new Date(matchData.general.matchTimeUTC);
+    const formattedDate = matchDate.toLocaleDateString('en-ZA', {
+      month: 'long',
+      day: 'numeric',
+      year: 'numeric'
     });
 
-    // Draw each stat
-    for (const stat of keyStats) {
-      if (stat.home !== null && stat.away !== null) {
-        // Stat name (centered)
-        image.print(fontSmall, 600, currentY, stat.name);
+    image.print(font, 60, footerY, '|Data via Fotmob| @SAFootyAnalyst');
+
+    const competition = matchData.general.competitionName || 'Premier Soccer League';
+    image.print(
+      font,
+      this.width - 500,
+      footerY,
+      {
+        text: `| ${competition} | On ${formattedDate} |`,
+        alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT
+      },
+      440,
+      20
+    );
+  }
+
+  async downloadLogo(logoUrl, teamId) {
+    if (!logoUrl) {
+      return null;
+    }
 
-        // Home stat (left side, white text)
-        image.print(fontSmall, 300, currentY, stat.home);
+    const logoPath = path.join(this.assetsDir, `team_${teamId}.png`);
+    if (fs.existsSync(logoPath)) {
+      return logoPath;
+    }
 
-        // Away stat (right side, team color)
-        image.print(fontSmall, 900, currentY, stat.away);
+    try {
+      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
+      fs.writeFileSync(logoPath, Buffer.from(response.data));
+      return logoPath;
+    } catch (error) {
+      logger.warn(`Failed to download logo for ${teamId}: ${error.message}`);
+      return null;
+    }
+  }
 
-        currentY += statGap;
+  getTeamColors(teamName) {
+    const normalizedName = teamName.toLowerCase();
+    for (const [key, value] of Object.entries(this.teamColors)) {
+      if (normalizedName.includes(key)) {
+        return value;
       }
     }
+
+    return this.teamColors.default;
   }
 }
 
-module.exports = new ImageGenerator();
+module.exports = new ImageGenerator();
 
EOF
)

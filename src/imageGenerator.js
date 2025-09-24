const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const logger = require('./logger');

const STAT_CONFIG = [
  { id: 'possession', label: 'Possession %', matchers: ['possession'] },
  { id: 'totalShots', label: 'Total shots', matchers: ['totalshots', 'shotstotal', 'allshots'] },
  { id: 'shotsOnTarget', label: 'Shots on target', matchers: ['ontarget'] },
  { id: 'passesCompleted', label: 'Succ. Passes %', matchers: ['succpasses', 'passsuccess', 'passaccuracy'] },
  { id: 'xg', label: 'xG', matchers: ['xg', 'expectedgoals'] },
  { id: 'xgOpenPlay', label: 'xG open play', matchers: ['xgopen', 'openplayxg'] },
  { id: 'xgSetPlay', label: 'xG set play', matchers: ['xgset', 'setplayxg'] },
  { id: 'passesOppHalf', label: 'Passes Opp. half', matchers: ['passesopphalf', 'attackhalfpasses', 'finalthirdpasses'] },
  { id: 'touchesOppBox', label: 'Touches Opp. box', matchers: ['touchesoppbox', 'touchesattackingbox', 'touchesbox'] }
];

class ImageGenerator {
  constructor() {
    this.width = 1400;
    this.height = 900;
    this.backgroundColor = 0x1e1f2aff;
    this.assetsDir = path.join(__dirname, '../assets');
    this.pitchDimensions = { width: 340, height: 440 };

    this.teamColors = {
      'kaizer chiefs': { primary: 0xffd700ff, secondary: 0x222222ff },
      'mamelodi sundowns': { primary: 0xffff00ff, secondary: 0x0057ffff },
      'orlando pirates': { primary: 0x111111ff, secondary: 0xffffffff },
      'supersport united': { primary: 0x0057ffff, secondary: 0xffffffff },
      'sekhukhune united': { primary: 0xc41e3aff, secondary: 0xffffffff },
      'ts galaxy': { primary: 0x9932ccff, secondary: 0xffffffff },
      'cape town city': { primary: 0x003b8bff, secondary: 0xffd700ff },
      'stellenbosch': { primary: 0x7b241cff, secondary: 0xffe4b5ff },
      'royal am': { primary: 0x0000ffff, secondary: 0xffd700ff },
      'chippa united': { primary: 0x0033a0ff, secondary: 0xffffffff },
      'default': { primary: 0x364156ff, secondary: 0xf1f1f1ff }
    };

    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true });
    }
  }

  async generateMatchGraphic(matchData) {
    try {
      logger.info('Creating match graphic...');

      const image = new Jimp(this.width, this.height, this.backgroundColor);
      const fonts = await this.loadFonts();

      const homeTeam = matchData.general.homeTeam;
      const awayTeam = matchData.general.awayTeam;
      const [homeScore, awayScore] = matchData.header.status.scoreStr
        .split('-')
        .map(value => value.trim());

      const stats = this.extractStats(matchData);
      const shots = this.extractShotData(matchData);

      const homeColors = this.getTeamColors(homeTeam.name);
      const awayColors = this.getTeamColors(awayTeam.name);

      await this.drawScoreboard({
        image,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        homeColors,
        awayColors,
        stats,
        fonts
      });

      await this.drawPitches({
        image,
        homeColors,
        awayColors,
        shots,
        fonts
      });

      await this.drawStatsPanel({
        image,
        stats,
        fonts,
        homeColors,
        awayColors
      });

      await this.drawLegend(image, fonts.tiny);
      await this.drawFooter(image, matchData, fonts.small);

      const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
      logger.info(`Generated match graphic for ${homeTeam.name} vs ${awayTeam.name}`);
      return buffer;
    } catch (error) {
      logger.error('Error generating match graphic:', error);
      throw error;
    }
  }

  async loadFonts() {
    const [large, medium, small, tiny] = await Promise.all([
      Jimp.loadFont(Jimp.FONT_SANS_64_WHITE),
      Jimp.loadFont(Jimp.FONT_SANS_32_WHITE),
      Jimp.loadFont(Jimp.FONT_SANS_16_WHITE),
      Jimp.loadFont(Jimp.FONT_SANS_12_WHITE)
    ]);

    return {
      large,
      medium,
      small,
      tiny
    };
  }

  extractStats(matchData) {
    const rawStats = matchData.content?.stats?.Periods?.All || [];
    const processed = [];

    const statsWithKeys = rawStats.map(stat => ({
      ...stat,
      normalized: this.normalizeTitle(stat.title)
    }));

    for (const config of STAT_CONFIG) {
      const statEntry = statsWithKeys.find(item =>
        config.matchers.some(keyword =>
          item.normalized.includes(keyword) &&
          !(config.id === 'totalShots' && item.normalized.includes('ontarget'))
        )
      );

      if (statEntry) {
        processed.push({
          id: config.id,
          label: config.label,
          home: statEntry.stats?.[0] ?? '-',
          away: statEntry.stats?.[1] ?? '-'
        });
      }
    }

    return processed;
  }

  normalizeTitle(title) {
    return (title || '')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  extractShotData(matchData) {
    const shotmap = matchData.content?.shotmap;
    if (!shotmap) {
      return { home: [], away: [] };
    }

    let shots = [];
    if (Array.isArray(shotmap)) {
      shots = shotmap;
    } else if (Array.isArray(shotmap.shots)) {
      shots = shotmap.shots;
    } else if (Array.isArray(shotmap.home) || Array.isArray(shotmap.away)) {
      shots = [
        ...(shotmap.home || []).map(shot => ({ ...shot, isHome: true })),
        ...(shotmap.away || []).map(shot => ({ ...shot, isHome: false }))
      ];
    }

    const formatted = shots
      .map(shot => {
        const x = this.normaliseShotCoordinate(shot.x);
        const y = this.normaliseShotCoordinate(shot.y);
        if (x === null || y === null) {
          return null;
        }

        const xg = this.parseNumber(shot.xg ?? shot.expectedGoals ?? shot.xG) ?? 0.05;
        const isGoal = Boolean(
          shot.isGoal ||
          shot.goal ||
          (typeof shot.result === 'string' && shot.result.toLowerCase().includes('goal'))
        );

        return {
          x,
          y,
          xg,
          isGoal,
          isHome: this.isHomeShot(matchData, shot)
        };
      })
      .filter(Boolean);

    return {
      home: formatted.filter(shot => shot.isHome),
      away: formatted.filter(shot => !shot.isHome)
    };
  }

  isHomeShot(matchData, shot) {
    if (typeof shot.isHome === 'boolean') {
      return shot.isHome;
    }

    if (typeof shot.teamId !== 'undefined') {
      return String(shot.teamId) === String(matchData.general.homeTeam.id);
    }

    if (typeof shot.team === 'string') {
      return shot.team.toLowerCase().includes(matchData.general.homeTeam.name.toLowerCase());
    }

    return Boolean(shot.home);
  }

  normaliseShotCoordinate(value) {
    if (value === null || typeof value === 'undefined') {
      return null;
    }

    const numeric = this.parseNumber(value);
    if (numeric === null) {
      return null;
    }

    if (numeric > 1) {
      return Math.max(0, Math.min(1, numeric / 100));
    }

    return Math.max(0, Math.min(1, numeric));
  }

  parseNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  async drawScoreboard({ image, homeTeam, awayTeam, homeScore, awayScore, homeColors, awayColors, stats, fonts }) {
    const headerHeight = 220;

    const homePanel = await new Jimp(Math.floor(this.width / 2), headerHeight, this.addOpacity(homeColors.primary, 0.9));
    const awayPanel = await new Jimp(Math.ceil(this.width / 2), headerHeight, this.addOpacity(awayColors.primary, 0.9));

    image.composite(homePanel, 0, 0);
    image.composite(awayPanel, Math.floor(this.width / 2), 0);

    const overlay = await new Jimp(this.width, headerHeight, 0x00000055);
    image.composite(overlay, 0, 0);

    const divider = await new Jimp(4, headerHeight, 0xffffffff);
    image.composite(divider, Math.floor(this.width / 2) - 2, 0);

    await this.drawTeamBadge(image, homeTeam, 120, 60, 110);
    await this.drawTeamBadge(image, awayTeam, this.width - 230, 60, 110);

    const halfWidth = Math.floor(this.width / 2);

    image.print(
      fonts.medium,
      220,
      40,
      {
        text: homeTeam.name.toUpperCase(),
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT
      },
      halfWidth - 260,
      40
    );

    image.print(
      fonts.medium,
      halfWidth + 40,
      40,
      {
        text: awayTeam.name.toUpperCase(),
        alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT
      },
      halfWidth - 160,
      40
    );

    image.print(
      fonts.large,
      0,
      100,
      {
        text: homeScore,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      },
      halfWidth,
      80
    );

    image.print(
      fonts.large,
      halfWidth,
      100,
      {
        text: awayScore,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      },
      halfWidth,
      80
    );

    image.print(
      fonts.small,
      halfWidth - 140,
      170,
      {
        text: 'Goals',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
      },
      280,
      30
    );

    const xg = stats.find(stat => stat.id === 'xg');
    if (xg) {
      image.print(
        fonts.small,
        0,
        200,
        {
          text: `xG ${xg.home}`,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        },
        halfWidth,
        30
      );

      image.print(
        fonts.small,
        halfWidth,
        200,
        {
          text: `xG ${xg.away}`,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        },
        halfWidth,
        30
      );
    }
  }

  async drawTeamBadge(image, team, x, y, size = 100) {
    try {
      if (!team.logoUrl) {
        return;
      }

      const logoPath = await this.downloadLogo(team.logoUrl, team.id);
      if (!logoPath) {
        return;
      }

      const badge = await Jimp.read(logoPath);
      badge.contain(size, size, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
      image.composite(badge, x, y);
    } catch (error) {
      logger.warn(`Unable to render badge for ${team.name}: ${error.message}`);
    }
  }

  addOpacity(color, alpha = 1) {
    const rgba = Jimp.intToRGBA(color);
    const a = Math.max(0, Math.min(255, Math.round(255 * alpha)));
    return Jimp.rgbaToInt(rgba.r, rgba.g, rgba.b, a);
  }

  async drawPitches({ image, homeColors, awayColors, shots, fonts }) {
    const pitchY = 260;
    const leftPitchX = 110;
    const rightPitchX = this.width - this.pitchDimensions.width - 110;

    this.drawPitchBase(image, leftPitchX, pitchY, this.pitchDimensions.width, this.pitchDimensions.height);
    this.drawPitchBase(image, rightPitchX, pitchY, this.pitchDimensions.width, this.pitchDimensions.height);

    image.print(
      fonts.small,
      leftPitchX,
      pitchY - 30,
      {
        text: 'Home shots',
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT
      },
      this.pitchDimensions.width,
      20
    );

    image.print(
      fonts.small,
      rightPitchX,
      pitchY - 30,
      {
        text: 'Away shots',
        alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT
      },
      this.pitchDimensions.width,
      20
    );

    this.drawShotLocationsOnPitch({
      image,
      offsetX: leftPitchX,
      offsetY: pitchY,
      width: this.pitchDimensions.width,
      height: this.pitchDimensions.height,
      shots: shots.home,
      teamColor: homeColors.primary,
      mirror: false
    });

    this.drawShotLocationsOnPitch({
      image,
      offsetX: rightPitchX,
      offsetY: pitchY,
      width: this.pitchDimensions.width,
      height: this.pitchDimensions.height,
      shots: shots.away,
      teamColor: awayColors.primary,
      mirror: true
    });

    if (!shots.home.length) {
      image.print(
        fonts.tiny,
        leftPitchX,
        pitchY + Math.floor(this.pitchDimensions.height / 2) - 10,
        {
          text: 'No shot data',
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        },
        this.pitchDimensions.width,
        20
      );
    }

    if (!shots.away.length) {
      image.print(
        fonts.tiny,
        rightPitchX,
        pitchY + Math.floor(this.pitchDimensions.height / 2) - 10,
        {
          text: 'No shot data',
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        },
        this.pitchDimensions.width,
        20
      );
    }
  }

  drawPitchBase(image, x, y, width, height) {
    const surface = new Jimp(width, height, 0x111418ff);
    image.composite(surface, x, y);

    const lineColor = 0xd4d4d4ff;
    this.drawPitchLines(image, x, y, width, height, lineColor);
  }

  drawPitchLines(image, x, y, width, height, color) {
    // Outer border
    for (let i = 0; i <= width; i++) {
      image.setPixelColor(color, x + i, y);
      image.setPixelColor(color, x + i, y + height);
    }
    for (let i = 0; i <= height; i++) {
      image.setPixelColor(color, x, y + i);
      image.setPixelColor(color, x + width, y + i);
    }

    // Center line
    for (let i = 0; i <= height; i++) {
      image.setPixelColor(color, x + Math.floor(width / 2), y + i);
    }

    // Penalty boxes and goal boxes
    const penaltyWidth = Math.floor(width * 0.6);
    const penaltyHeight = Math.floor(height * 0.2);
    const penaltyX = x + Math.floor((width - penaltyWidth) / 2);

    for (let i = 0; i <= penaltyWidth; i++) {
      image.setPixelColor(color, penaltyX + i, y);
      image.setPixelColor(color, penaltyX + i, y + height - penaltyHeight);
      image.setPixelColor(color, penaltyX + i, y + penaltyHeight);
      image.setPixelColor(color, penaltyX + i, y + height);
    }

    for (let i = 0; i <= penaltyHeight; i++) {
      image.setPixelColor(color, penaltyX, y + i);
      image.setPixelColor(color, penaltyX + penaltyWidth, y + i);
      image.setPixelColor(color, penaltyX, y + height - i);
      image.setPixelColor(color, penaltyX + penaltyWidth, y + height - i);
    }

    // Center circle
    const circleRadius = Math.floor(width * 0.13);
    this.drawCircle(image, x + Math.floor(width / 2), y + Math.floor(height / 2), circleRadius, color, false);
  }

  drawShotLocationsOnPitch({ image, offsetX, offsetY, width, height, shots, teamColor, mirror }) {
    if (!shots || shots.length === 0) {
      return;
    }

    shots.forEach(shot => {
      const relativeX = mirror ? 1 - shot.x : shot.x;
      const pointX = offsetX + Math.round(relativeX * width);
      const pointY = offsetY + Math.round((1 - shot.y) * height);

      const radius = Math.max(6, Math.min(18, shot.xg * 22));
      this.drawCircle(image, pointX, pointY, radius, this.addOpacity(teamColor, 0.85));

      if (shot.isGoal) {
        this.drawRing(image, pointX, pointY, radius + 4, 2, 0xffffffff);
      }
    });
  }

  drawCircle(image, centerX, centerY, radius, color, filled = true) {
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        if (x * x + y * y <= radius * radius) {
          const px = centerX + x;
          const py = centerY + y;
          if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
            if (filled) {
              image.setPixelColor(color, px, py);
            }
          }
        }
      }
    }

    if (!filled) {
      this.drawRing(image, centerX, centerY, radius, 1, color);
    }
  }

  drawRing(image, centerX, centerY, radius, thickness, color) {
    for (let r = radius - thickness; r <= radius; r++) {
      for (let angle = 0; angle < 360; angle++) {
        const rad = (angle * Math.PI) / 180;
        const px = Math.round(centerX + r * Math.cos(rad));
        const py = Math.round(centerY + r * Math.sin(rad));
        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
          image.setPixelColor(color, px, py);
        }
      }
    }
  }

  drawStatsPanel({ image, stats, fonts, homeColors, awayColors }) {
    if (!stats.length) {
      return;
    }

    const panelWidth = 520;
    const panelHeight = stats.length * 46 + 60;
    const startX = Math.floor((this.width - panelWidth) / 2);
    const startY = 260;

    const panel = new Jimp(panelWidth, panelHeight, 0x111418ff);
    image.composite(panel, startX, startY);

    for (let i = 0; i <= panelWidth; i++) {
      image.setPixelColor(0x33363eff, startX + i, startY);
      image.setPixelColor(0x33363eff, startX + i, startY + panelHeight);
    }

    const homeColor = this.addOpacity(homeColors?.primary ?? this.teamColors.default.primary, 0.9);
    const awayColor = this.addOpacity(awayColors?.primary ?? this.teamColors.default.primary, 0.9);

    stats.forEach((stat, index) => {
      const rowY = startY + 30 + index * 46;
      if (index % 2 === 1) {
        for (let x = 0; x < panelWidth; x++) {
          image.setPixelColor(0x1b1e28ff, startX + x, rowY - 10);
        }
      }

      const circleY = rowY + 12;
      this.drawCircle(image, startX + 18, circleY, 6, homeColor);
      this.drawCircle(image, startX + panelWidth - 18, circleY, 6, awayColor);

      image.print(
        fonts.small,
        startX + 38,
        rowY,
        {
          text: stat.home,
          alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT
        },
        140,
        30
      );

      image.print(
        fonts.small,
        startX + (panelWidth - 160) / 2,
        rowY,
        {
          text: stat.label,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
        },
        160,
        30
      );

      image.print(
        fonts.small,
        startX + panelWidth - 182,
        rowY,
        {
          text: stat.away,
          alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT
        },
        140,
        30
      );
    });

    const legendY = startY + panelHeight - 22;
    this.drawCircle(image, startX + 40, legendY, 6, homeColor);
    image.print(
      fonts.tiny,
      startX + 52,
      legendY - 8,
      'Home'
    );

    this.drawCircle(image, startX + panelWidth - 80, legendY, 6, awayColor);
    image.print(
      fonts.tiny,
      startX + panelWidth - 68,
      legendY - 8,
      'Away'
    );
  }

  async drawLegend(image, font) {
    const legendY = this.height - 150;
    const legendX = Math.floor((this.width - 320) / 2);

    image.print(font, legendX, legendY, 'xG Legend');

    const sizes = [6, 12, 18];
    const labels = ['Low xG', 'Medium xG', 'High xG'];

    sizes.forEach((size, index) => {
      const cx = legendX + 30 + index * 110;
      const cy = legendY + 40;
      this.drawCircle(image, cx, cy, size, 0xffffffff);
      image.print(font, cx - 40, cy + 25, labels[index]);
    });
  }

  async drawFooter(image, matchData, font) {
    const footerY = this.height - 60;
    const matchDate = new Date(matchData.general.matchTimeUTC);
    const formattedDate = matchDate.toLocaleDateString('en-ZA', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    image.print(font, 60, footerY, '|Data via Fotmob| @SAFootyAnalyst');

    const competition = matchData.general.competitionName || 'Premier Soccer League';
    image.print(
      font,
      this.width - 500,
      footerY,
      {
        text: `| ${competition} | On ${formattedDate} |`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT
      },
      440,
      20
    );
  }

  async downloadLogo(logoUrl, teamId) {
    if (!logoUrl) {
      return null;
    }

    const logoPath = path.join(this.assetsDir, `team_${teamId}.png`);
    if (fs.existsSync(logoPath)) {
      return logoPath;
    }

    try {
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(logoPath, Buffer.from(response.data));
      return logoPath;
    } catch (error) {
      logger.warn(`Failed to download logo for ${teamId}: ${error.message}`);
      return null;
    }
  }

  getTeamColors(teamName) {
    const normalizedName = teamName.toLowerCase();
    for (const [key, value] of Object.entries(this.teamColors)) {
      if (normalizedName.includes(key)) {
        return value;
      }
    }

    return this.teamColors.default;
  }
}

module.exports = new ImageGenerator();

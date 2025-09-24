const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const config = require('../config/config');
const logger = require('./logger');

class FotmobScraper {
  constructor() {
    this.baseUrl = 'https://www.fotmob.com';
    this.leagueId = config.fotmob.leagueId;
    this.leagueUrl = `${this.baseUrl}/leagues/537/Premier-Soccer-League/overview`;
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize the browser
   */
  async initialize() {
    try {
      if (!this.browser) {
        logger.info('Initializing browser for web scraping');
        this.browser = await puppeteer.launch({
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        });
      }
      
      if (!this.page) {
        this.page = await this.browser.newPage();
        
        // Set viewport and user agent
        await this.page.setViewport({ width: 1366, height: 768 });
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
        
        // Set longer timeouts
        this.page.setDefaultTimeout(120000); // 2 minutes
        this.page.setDefaultNavigationTimeout(120000); // 2 minutes
        
        // Set request interception to block unnecessary resources
        await this.page.setRequestInterception(true);
        this.page.on('request', (request) => {
          if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
            request.abort();
          } else {
            request.continue();
          }
        });
        
        // Add error handling for page errors
        this.page.on('error', (error) => {
          logger.error('Page error:', error);
        });
        
        this.page.on('pageerror', (error) => {
          logger.error('Page script error:', error);
        });
      }
    } catch (error) {
      logger.error('Error initializing browser:', error);
      throw error;
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      logger.info('Browser closed');
    }
  }

  /**
   * Navigate to a URL with retry logic
   * @param {string} url - The URL to navigate to
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<void>}
   */
  async navigateWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Navigation attempt ${attempt}/${maxRetries} to: ${url}`);
        
        // Try different wait conditions
        const waitConditions = ['domcontentloaded', 'networkidle0', 'networkidle2'];
        const waitCondition = waitConditions[Math.min(attempt - 1, waitConditions.length - 1)];
        
        await this.page.goto(url, { 
          waitUntil: waitCondition, 
          timeout: 120000 
        });
        
        // Wait a bit for dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        logger.info(`Successfully navigated to ${url}`);
        return;
      } catch (error) {
        logger.warn(`Navigation attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Fetch matches for the South African league
   * @returns {Promise<Array>} Array of matches
   */
  async getLeagueMatches() {
    try {
      await this.initialize();
      
      logger.info(`Navigating to league page: ${this.leagueUrl}`);
      await this.navigateWithRetry(this.leagueUrl);
      
      // Try multiple selectors for matches
      const possibleSelectors = [
        'article',
        '.css-1m9dpu0',
        '[data-testid="match-row"]',
        '.match-row',
        '.match',
        '[class*="match"]',
        '[class*="fixture"]',
        'div[class*="table"]',
        'div[class*="standings"]'
      ];
      
      let matchSelector = null;
      for (const selector of possibleSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 10000 });
          matchSelector = selector;
          logger.info(`Found matches using selector: ${selector}`);
          break;
        } catch (error) {
          logger.debug(`Selector ${selector} not found, trying next...`);
        }
      }
      
      if (!matchSelector) {
        logger.warn('No match selectors found, trying to extract from page content');
      }
      
      // Get the page content
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      // Extract matches
      const matches = [];
      
      // Try to find match elements with multiple approaches
      let matchElements = [];
      
      if (matchSelector) {
        matchElements = $(matchSelector);
      } else {
        // Fallback: look for any elements that might contain match data
        matchElements = $('article, div, section').filter((i, el) => {
          const text = $(el).text().toLowerCase();
          return text.includes('vs') || text.includes('v ') || text.includes('match') ||
                 text.includes('premier soccer league') || text.includes('south africa');
        });
      }
      
      logger.info(`Found ${matchElements.length} potential match elements`);
      
      // Extract match data with improved filtering
      matchElements.each((i, element) => {
        try {
          const matchElement = $(element);
          const elementText = matchElement.text().trim();
          
          // Skip if element doesn't look like a match
          if (!elementText || elementText.length < 10) {
            return;
          }
          
          // Skip elements that are clearly not matches
          const skipPatterns = [
            /FotMob is the essential football app/i,
            /Get the app/i,
            /About us/i,
            /Careers/i,
            /Advertise/i,
            /Lineup Builder/i,
            /FAQ/i,
            /FIFA Rankings/i,
            /Predictor/i,
            /Newsletter/i,
            /The South African/i,
            /Full round of Heritage Day matches/i,
            /LIVE \| Kaizer Chiefs vs Marumo Gallants/i
          ];
          
          if (skipPatterns.some(pattern => pattern.test(elementText))) {
            return;
          }
          
          // Look for actual match patterns
          const matchPatterns = [
            // Pattern: Team1 vs Team2
            /^([A-Za-z\s]+?)\s+(?:vs|v|VS|V)\s+([A-Za-z\s]+?)$/,
            // Pattern: Team1 - Team2
            /^([A-Za-z\s]+?)\s*-\s*([A-Za-z\s]+?)$/,
            // Pattern with score: Team1 2-1 Team2
            /^([A-Za-z\s]+?)\s+\d+-\d+\s+([A-Za-z\s]+?)$/,
            // Pattern for table data: "1Sekhukhune UnitedSekhukhune United0 - 0"
            /(\d+)([A-Za-z\s]+?)\s+([A-Za-z\s]+?)\s+(\d+)\s*-\s*(\d+)/
          ];
          
          let homeTeam = '';
          let awayTeam = '';
          let status = '';
          let scoreStr = '0-0';
          
          // Try to match against known patterns
          for (let i = 0; i < matchPatterns.length; i++) {
            const pattern = matchPatterns[i];
            const match = elementText.match(pattern);
            if (match) {
              if (i === 3) { // Table format pattern
                homeTeam = match[2].trim();
                awayTeam = match[3].trim();
                scoreStr = `${match[4]}-${match[5]}`;
              } else {
                homeTeam = match[1].trim();
                awayTeam = match[2].trim();
              }
              break;
            }
          }
          
          // If no pattern match, try to extract from structured elements
          if (!homeTeam || !awayTeam) {
            // Look for team names in various ways
            const teamSelectors = [
              '.css-1mflhw9',
              '[class*="team"]',
              '[class*="name"]',
              'span',
              'div'
            ];
            
            for (const selector of teamSelectors) {
              const teamElements = matchElement.find(selector);
              if (teamElements.length >= 2) {
                const team1 = teamElements.eq(0).text().trim();
                const team2 = teamElements.eq(1).text().trim();
                
                // Validate team names (should be reasonable length and not contain common non-team words)
                if (team1.length > 2 && team1.length < 50 && 
                    team2.length > 2 && team2.length < 50 &&
                    !team1.toLowerCase().includes('app') &&
                    !team1.toLowerCase().includes('fotmob') &&
                    !team2.toLowerCase().includes('app') &&
                    !team2.toLowerCase().includes('fotmob')) {
                  homeTeam = team1;
                  awayTeam = team2;
                  break;
                }
              }
            }
          }
          
          // Look for status
          const statusSelectors = ['.css-1y32s38', '[class*="status"]', '[class*="time"]'];
          for (const selector of statusSelectors) {
            const statusText = matchElement.find(selector).text().trim();
            if (statusText && statusText.length < 20) {
              status = statusText;
              break;
            }
          }
          
          // Look for score
          const scoreSelectors = ['.css-8atqhb', '[class*="score"]', '[class*="result"]'];
          for (const selector of scoreSelectors) {
            const scoreText = matchElement.find(selector).text().trim();
            if (scoreText && scoreText.match(/\d+/) && scoreText.includes('-')) {
              scoreStr = scoreText;
              break;
            }
          }
          
          // Only create match if we have valid team names
          if (homeTeam && awayTeam && 
              homeTeam.length > 2 && homeTeam.length < 50 &&
              awayTeam.length > 2 && awayTeam.length < 50 &&
              homeTeam !== awayTeam) {
            
            // Generate a proper match ID
            let matchId = matchElement.attr('data-match-id') || 
                         matchElement.attr('data-id') ||
                         matchElement.find('a').attr('href')?.split('/').pop();
            
            if (!matchId || matchId.startsWith('#')) {
              matchId = `${homeTeam.replace(/\s+/g, '_').toLowerCase()}_vs_${awayTeam.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
            }
            
            const match = {
              id: matchId,
              home: { name: homeTeam },
              away: { name: awayTeam },
              status: { 
                finished: status.toLowerCase() === 'ft' || status.toLowerCase() === 'full time',
                scoreStr
              }
            };
            
            matches.push(match);
            logger.debug(`Extracted match: ${homeTeam} vs ${awayTeam}`);
          }
        } catch (error) {
          logger.error('Error parsing match element:', error);
        }
      });
      
      logger.info(`Successfully extracted ${matches.length} matches`);
      return matches;
    } catch (error) {
      logger.error('Error fetching league matches:', error);
      return [];
    }
  }

  /**
   * Fetch detailed match statistics
   * @param {string} matchId - The match ID
   * @returns {Promise<Object>} Match details
   */
  async getMatchDetails(matchId) {
    try {
      await this.initialize();
      
      const matchUrl = `${this.baseUrl}/match/${matchId}`;
      logger.info(`Navigating to match page: ${matchUrl}`);
      await this.navigateWithRetry(matchUrl);
      
      // Wait for the match details to load with multiple selector attempts
      const detailSelectors = [
        '.css-1m9dpu0',
        '[data-testid="match-details"]',
        '.match-details',
        '.match-info'
      ];
      
      let detailSelector = null;
      for (const selector of detailSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 10000 });
          detailSelector = selector;
          logger.info(`Found match details using selector: ${selector}`);
          break;
        } catch (error) {
          logger.debug(`Detail selector ${selector} not found, trying next...`);
        }
      }
      
      // Get the page content
      const content = await this.page.content();
      const $ = cheerio.load(content);
      
      // Extract match details
      const homeTeamElement = $('.css-1mflhw9').eq(0);
      const awayTeamElement = $('.css-1mflhw9').eq(1);
      const homeTeamName = homeTeamElement.text().trim();
      const awayTeamName = awayTeamElement.text().trim();
      
      // Extract score
      const scoreElement = $('.css-8atqhb');
      const homeScore = scoreElement.find('.css-1mflhw9').eq(0).text().trim();
      const awayScore = scoreElement.find('.css-1mflhw9').eq(1).text().trim();
      const scoreStr = `${homeScore}-${awayScore}`;
      
      // Extract team logos
      const homeTeamLogo = $('.css-1m9dpu0').find('img').eq(0).attr('src');
      const awayTeamLogo = $('.css-1m9dpu0').find('img').eq(1).attr('src');
      
      // Extract match time
      const matchTimeStr = $('.css-1y32s38').text().trim();
      const matchTimeUTC = new Date().toISOString();
      
      // Extract stats
      const stats = [];
      $('.css-1m9dpu0').each((i, element) => {
        const statElement = $(element);
        const statTitle = statElement.find('.css-1y32s38').text().trim();
        
        if (statTitle && statTitle.includes('%') || statTitle.toLowerCase().includes('possession') || 
            statTitle.toLowerCase().includes('shots') || statTitle.toLowerCase().includes('passes')) {
          const homeStat = statElement.find('.css-1mflhw9').eq(0).text().trim();
          const awayStat = statElement.find('.css-1mflhw9').eq(1).text().trim();
          
          stats.push({
            title: statTitle,
            stats: [homeStat, awayStat]
          });
        }
      });
      
      // Create match details object
      const matchDetails = {
        general: {
          matchId,
          matchTimeUTC,
          homeTeam: {
            id: `home_${matchId}`,
            name: homeTeamName,
            logoUrl: homeTeamLogo || ''
          },
          awayTeam: {
            id: `away_${matchId}`,
            name: awayTeamName,
            logoUrl: awayTeamLogo || ''
          }
        },
        header: {
          status: {
            scoreStr
          }
        },
        content: {
          stats: {
            Periods: {
              All: stats
            }
          }
        }
      };
      
      logger.info(`Successfully scraped details for match ${matchId}`);
      return matchDetails;
    } catch (error) {
      logger.error(`Error fetching match details for match ${matchId}:`, error);
      
      // Return a minimal match object if scraping fails
      return {
        general: {
          matchId,
          matchTimeUTC: new Date().toISOString(),
          homeTeam: { id: `home_${matchId}`, name: 'Home Team', logoUrl: '' },
          awayTeam: { id: `away_${matchId}`, name: 'Away Team', logoUrl: '' }
        },
        header: {
          status: { scoreStr: '0-0' }
        },
        content: {
          stats: { Periods: { All: [] } }
        }
      };
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

module.exports = new FotmobScraper();


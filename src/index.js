require('dotenv').config();
const cron = require('node-cron');
const fotmobScraper = require('./fotmobScraper');
const imageGenerator = require('./imageGenerator');
const twitterService = require('./twitterService');
const config = require('../config/config');
const logger = require('./logger');

// Log startup
logger.info('Starting South African Football Match Bot');
logger.info(`Monitoring league ID: ${config.fotmob.leagueId}`);

/**
 * Check for completed matches and post them to Twitter
 */
async function checkAndPostMatches() {
  try {
    logger.info('Checking for completed matches...');
    
    // Get matches that haven't been posted yet
    const completedMatches = await fotmobScraper.getCompletedMatches(twitterService.postedMatches);
    
    if (completedMatches.length === 0) {
      logger.info('No new completed matches found');
      return;
    }

    logger.info(`Found ${completedMatches.length} new completed matches`);

    // Process each match
    for (const match of completedMatches) {
      try {
        logger.info(`Processing match: ${match.home.name} vs ${match.away.name}`);
        
        // Get detailed match data
        const matchDetails = await fotmobScraper.getMatchDetails(match.id);
        
        // Generate match graphic
        logger.info('Generating match graphic...');
        const imageBuffer = await imageGenerator.generateMatchGraphic(matchDetails);
        
        // Post to Twitter
        logger.info('Posting to Twitter...');
        await twitterService.postMatchGraphic(imageBuffer, matchDetails);
        
        logger.success(`Successfully posted match: ${match.home.name} vs ${match.away.name}`);
      } catch (error) {
        logger.error(`Error processing match ${match.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error in checkAndPostMatches:', error);
  } finally {
    // Close the browser after processing
    try {
      await fotmobScraper.close();
    } catch (error) {
      logger.error('Error closing browser:', error);
    }
  }
}

// Schedule the job to run every hour
cron.schedule('0 * * * *', checkAndPostMatches);

// Also run once at startup
checkAndPostMatches();

// Keep the process running
logger.info('Bot is running. Press Ctrl+C to exit.');

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Bot is shutting down...');
  try {
    await fotmobScraper.close();
  } catch (error) {
    logger.error('Error closing browser during shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Bot is shutting down...');
  try {
    await fotmobScraper.close();
  } catch (error) {
    logger.error('Error closing browser during shutdown:', error);
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception:', error);
  try {
    await fotmobScraper.close();
  } catch (closeError) {
    logger.error('Error closing browser after exception:', closeError);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
});
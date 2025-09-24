/**
 * Test script to verify the Fotmob web scraper
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fotmobScraper = require('../src/fotmobScraper');
const logger = require('../src/logger');

console.log('Testing Fotmob web scraper...');

// Test function to check if the scraper is working
async function testScraper() {
  try {
    console.log('1. Testing league matches retrieval...');
    const matches = await fotmobScraper.getLeagueMatches();
    console.log(`   Success! Found ${matches.length} matches.`);
    
    if (matches.length > 0) {
      // Save the matches data for inspection
      const matchesPath = path.join(__dirname, '../test-matches.json');
      fs.writeFileSync(matchesPath, JSON.stringify(matches, null, 2), 'utf8');
      console.log(`   Matches data saved to: ${matchesPath}`);
      
      // Get details for the first match
      const sampleMatch = matches[0];
      console.log(`2. Testing match details retrieval for match ID ${sampleMatch.id}...`);
      console.log(`   Match: ${sampleMatch.home.name} vs ${sampleMatch.away.name}`);
      
      const matchDetails = await fotmobScraper.getMatchDetails(sampleMatch.id);
      
      // Save the match details for inspection
      const detailsPath = path.join(__dirname, '../test-match-details.json');
      fs.writeFileSync(detailsPath, JSON.stringify(matchDetails, null, 2), 'utf8');
      console.log(`   Match details saved to: ${detailsPath}`);
      
      console.log('\nAll scraper tests passed! The web scraper is working correctly.');
    } else {
      console.log('No matches found. This could be normal if there are no matches scheduled or if the scraper needs adjustment.');
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    // Close the browser
    await fotmobScraper.close();
  }
}

// Run the test
testScraper();


/**
 * Test script to verify the bot is working correctly
 */
require('dotenv').config();
const fotmobService = require('../src/fotmobService');
const imageGenerator = require('../src/imageGenerator');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

console.log('Testing South African Football Match Graphics Bot...');

// Test function to check if the bot components are working
async function runTest() {
  try {
    console.log('1. Testing Fotmob API connection...');
    const matches = await fotmobService.getLeagueMatches();
    console.log(`   Success! Found ${matches.length} matches.`);
    
    if (matches.length > 0) {
      const sampleMatch = matches[0];
      console.log(`2. Testing match details retrieval for match ID ${sampleMatch.id}...`);
      const matchDetails = await fotmobService.getMatchDetails(sampleMatch.id);
      console.log('   Success! Match details retrieved.');
      
      console.log('3. Testing image generation...');
      const imageBuffer = await imageGenerator.generateMatchGraphic(matchDetails);
      
      // Save the test image
      const testImagePath = path.join(__dirname, '../test-image.png');
      fs.writeFileSync(testImagePath, imageBuffer);
      console.log(`   Success! Test image saved to: ${testImagePath}`);
      
      console.log('\nAll tests passed! The bot is working correctly.');
      console.log('You can view the generated test image to verify the graphics generation.');
    } else {
      console.log('No matches found to test with. This could be normal if there are no matches scheduled.');
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
runTest();

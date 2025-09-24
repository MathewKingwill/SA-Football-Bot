/**
 * Test script to verify Twitter API integration
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const twitterService = require('../src/twitterService');
const logger = require('../src/logger');

console.log('Testing Twitter API integration...');

// Test function to check if Twitter API credentials are working
async function testTwitterCredentials() {
  try {
    console.log('1. Verifying Twitter API credentials...');
    
    // Get the current user to verify credentials
    const user = await twitterService.rwClient.v2.me();
    
    console.log(`   Success! Authenticated as: @${user.data.username}`);
    console.log(`   User ID: ${user.data.id}`);
    console.log(`   Name: ${user.data.name}`);
    
    console.log('\nTwitter API credentials are valid and working correctly!');
    console.log('You can now run the bot with confidence that it will be able to post tweets.');
    
    return true;
  } catch (error) {
    console.error('\nError verifying Twitter credentials:', error.message);
    console.log('\nPlease check your Twitter API credentials in the .env file:');
    console.log('1. Make sure all four credentials are correct (API key, API secret, access token, access secret)');
    console.log('2. Verify that your Twitter Developer App has the necessary permissions (read/write)');
    console.log('3. Check if your Twitter Developer App is still active');
    
    return false;
  }
}

// Run the test
testTwitterCredentials();

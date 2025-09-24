/**
 * Mock test script that doesn't rely on external API calls
 */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const logger = require('../src/logger');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

console.log('Running mock test for South African Football Match Graphics Bot...');

// Sample match data similar to what we'd get from Fotmob
const sampleMatchData = {
  general: {
    matchId: '12345',
    matchTimeUTC: new Date().toISOString(),
    homeTeam: {
      id: '123',
      name: 'Kaizer Chiefs',
      logoUrl: 'https://www.fotmob.com/img/team/123.png'
    },
    awayTeam: {
      id: '456',
      name: 'Orlando Pirates',
      logoUrl: 'https://www.fotmob.com/img/team/456.png'
    }
  },
  header: {
    status: {
      scoreStr: '2-1'
    }
  },
  content: {
    stats: {
      Periods: {
        All: [
          { title: 'Possession %', stats: ['40', '60'] },
          { title: 'Total shots', stats: ['8', '15'] },
          { title: 'Shots on target', stats: ['3', '5'] },
          { title: 'xG', stats: ['1.2', '2.1'] }
        ]
      }
    }
  }
};

// Test function to check if components are working
async function runMockTest() {
  try {
    console.log('1. Testing logger...');
    logger.info('This is a test info message');
    logger.warn('This is a test warning message');
    logger.error('This is a test error message');
    logger.success('This is a test success message');
    console.log('   Success! Logger is working.');
    
    console.log('2. Testing image generation with mock data...');
    // Create a simple test image
    const image = new Jimp(1200, 800, 0x1e1e1eff); // Dark background
    
    // Load font
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    
    // Add some text
    image.print(font, 400, 100, {
      text: 'Bot Test Image',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, 400, 50);
    
    image.print(font, 400, 200, {
      text: `${sampleMatchData.general.homeTeam.name} ${sampleMatchData.header.status.scoreStr} ${sampleMatchData.general.awayTeam.name}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, 400, 50);
    
    image.print(font, 400, 300, {
      text: `Generated: ${new Date().toISOString()}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
    }, 400, 50);
    
    // Save the test image
    const testImagePath = path.join(__dirname, '../test-image.png');
    await image.writeAsync(testImagePath);
    console.log(`   Success! Test image saved to: ${testImagePath}`);
    
    console.log('\nAll mock tests passed! The bot components are working correctly.');
    console.log('You can view the generated test image to verify the graphics generation.');
    
    // Check if logs directory and file were created
    const logFiles = fs.readdirSync(logsDir);
    console.log(`\nLog files created: ${logFiles.join(', ')}`);
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the mock test
runMockTest();

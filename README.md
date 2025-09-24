# South African Football Match Graphics Bot

## Overview
This bot automatically generates and tweets match graphics for South African football matches using data from Fotmob. The graphics are similar to the example provided, showing match statistics, scores, and team information.

## Features
- Scrapes completed match data from Fotmob website
- Generates match graphics with team logos, scores, and statistics
- Posts graphics to Twitter with appropriate hashtags
- Tracks posted matches to avoid duplicates
- Logs all activities for monitoring and debugging

## Prerequisites
- Node.js (v14 or higher)
- Twitter Developer Account with API credentials
- Internet connection to access Fotmob website

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fotmob-sa-bot.git
   cd fotmob-sa-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   # Twitter API Credentials
   TWITTER_API_KEY=your_api_key
   TWITTER_API_SECRET=your_api_secret
   TWITTER_ACCESS_TOKEN=your_access_token
   TWITTER_ACCESS_SECRET=your_access_secret

   # FotMob Settings
   FOTMOB_LEAGUE_ID=292 # South African Premier Division ID
   FOTMOB_REFRESH_INTERVAL=3600000 # 1 hour in milliseconds

   # Bot Settings
   TIMEZONE=Africa/Johannesburg
   ```

## Usage

1. Start the bot:
   ```bash
   npm start
   ```

   For development mode (runs in foreground):
   ```bash
   npm run dev
   ```

2. The bot will automatically:
   - Check for completed matches hourly
   - Generate match graphics for new completed matches
   - Post the graphics to Twitter
   - Log all activities

3. Stop the bot:
   ```bash
   npm stop
   ```

4. Testing the bot:
   ```bash
   # Run a mock test that doesn't require web access
   npm test
   
   # Test Twitter API integration
   npm run test:twitter
   
   # Test the web scraper
   node scripts/scraper-test.js
   ```

## Configuration

- Edit `config/config.js` to customize bot behavior
- Adjust the graphic template in `src/imageGenerator.js`
- Modify tweet format in `src/twitterService.js`

## Logging

Logs are stored in the `logs` directory with the following format:
- `bot-YYYY-MM-DD.log`

## Web Scraping

This bot uses Puppeteer and Cheerio to scrape match data from the Fotmob website. This approach was chosen because:

1. The unofficial Fotmob API endpoints may have access restrictions (401 errors)
2. Web scraping provides more reliable access to the data
3. It allows for more flexibility in extracting the specific data we need

Note that web scraping is dependent on the website's structure, so if Fotmob changes their website layout, the scraper may need to be updated.

## Project Structure

```
├── assets/          # Stored team logos and posted match IDs
├── config/          # Configuration files
├── logs/            # Log files
├── scripts/         # Start/stop/test scripts
├── src/
│   ├── fotmobScraper.js  # Fotmob web scraping
│   ├── imageGenerator.js # Match graphic generation
│   ├── index.js          # Main application
│   ├── logger.js         # Logging utility
│   └── twitterService.js # Twitter API integration
├── .env             # Environment variables (not in repo)
├── package.json     # Project dependencies
└── README.md        # This file
```

## Technical Notes

- This project uses Jimp for image processing instead of canvas to avoid native compilation dependencies
- Puppeteer is used for web scraping, which requires a Chromium browser (automatically installed with puppeteer)
- The bot runs on a schedule using node-cron to check for new matches hourly

## Troubleshooting

If you encounter issues:

1. Check the log files in the `logs` directory
2. Run the mock test to verify component functionality
3. Test the Twitter API integration separately
4. Test the web scraper separately
5. Ensure your Twitter API credentials are correct
6. If the web scraper is not working, it may need to be updated to match changes in the Fotmob website structure
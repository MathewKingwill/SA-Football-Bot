require('dotenv').config();

module.exports = {
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET
  },
  fotmob: {
    leagueId: process.env.FOTMOB_LEAGUE_ID || 292, // South African Premier Division
    refreshInterval: parseInt(process.env.FOTMOB_REFRESH_INTERVAL) || 3600000 // 1 hour
  },
  timezone: process.env.TIMEZONE || 'Africa/Johannesburg'
};

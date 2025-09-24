/**
 * Startup script for the South African Football Match Graphics Bot
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to the main application
const appPath = path.join(__dirname, '../src/index.js');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFilePath = path.join(logsDir, `bot-${new Date().toISOString().split('T')[0]}.log`);

console.log('Starting South African Football Match Graphics Bot...');
console.log(`Logs will be written to: ${logFilePath}`);

// Spawn the process
const botProcess = spawn('node', [appPath], {
  detached: true,
  stdio: ['ignore', 'ignore', 'ignore']
});

// Detach the process
botProcess.unref();

console.log('Bot is running in the background.');
console.log('Use "npm stop" to stop the bot.');
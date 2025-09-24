/**
 * Development run script for the South African Football Match Graphics Bot
 * This runs the bot in the foreground with console output
 */
const path = require('path');
const { spawn } = require('child_process');

// Path to the main application
const appPath = path.join(__dirname, '../src/index.js');

console.log('Starting South African Football Match Graphics Bot in development mode...');

// Spawn the process in the foreground
const botProcess = spawn('node', [appPath], {
  stdio: 'inherit'
});

// Handle process exit
botProcess.on('exit', (code) => {
  console.log(`Bot exited with code ${code}`);
});

// Forward signals to the child process
process.on('SIGINT', () => {
  botProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  botProcess.kill('SIGTERM');
});

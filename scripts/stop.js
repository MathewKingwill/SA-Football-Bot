/**
 * Script to stop the South African Football Match Graphics Bot
 */
const { exec } = require('child_process');
const os = require('os');

// Different commands based on operating system
const isWindows = os.platform() === 'win32';
const command = isWindows
  ? 'taskkill /F /IM node.exe /T /FI "WINDOWTITLE eq *fotmob-sa-bot*"'
  : "pkill -f 'node.*fotmob-sa-bot'";

console.log('Stopping South African Football Match Graphics Bot...');

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error stopping bot: ${error.message}`);
    console.log('Bot may not be running or could not be stopped.');
    return;
  }
  
  if (stderr) {
    console.error(`Error: ${stderr}`);
    return;
  }
  
  console.log('Bot has been stopped successfully.');
});

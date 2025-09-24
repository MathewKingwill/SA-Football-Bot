const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '../logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    this.logFile = path.join(this.logsDir, `bot-${new Date().toISOString().split('T')[0]}.log`);
  }

  /**
   * Format a log message
   * @param {string} level - Log level (INFO, ERROR, etc.)
   * @param {string} message - Log message
   * @returns {string} Formatted log message
   */
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  /**
   * Write a message to the log file
   * @param {string} message - Message to log
   */
  writeToFile(message) {
    fs.appendFileSync(this.logFile, message + '\n');
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   */
  info(message) {
    const formattedMessage = this.formatMessage('INFO', message);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   * @param {Error} [error] - Optional error object
   */
  error(message, error) {
    let formattedMessage = this.formatMessage('ERROR', message);
    
    if (error) {
      formattedMessage += `\n${error.stack || error.message}`;
    }
    
    console.error(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   */
  warn(message) {
    const formattedMessage = this.formatMessage('WARN', message);
    console.warn(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log a success message
   * @param {string} message - Message to log
   */
  success(message) {
    const formattedMessage = this.formatMessage('SUCCESS', message);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   */
  debug(message) {
    const formattedMessage = this.formatMessage('DEBUG', message);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  }
}

module.exports = new Logger();
const chalk = require('chalk')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(text) {
  console.log(chalk.green.bold(text))
}

function logIssue(text) {
  console.log(chalk.red.bold(text));
}

module.exports = {
  sleep,
  log,
  logIssue
}
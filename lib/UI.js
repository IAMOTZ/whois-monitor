/* eslint-disable class-methods-use-this */
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

class UI {

  // askQuetion
  // askForDates
  // display stats

  askQuestion(question) {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  }

  async askForDates(dateFormat, moment) {
    console.info(''
      + 'Enter the start date and end date to filter data from AWS.\n'
      + 'Type d to use the default values.\n'
      + 'For start date, the default value is today.\n'
      + 'For end date, the default value is 1 month ago.\n');
    let startDate = '';
    let endDate = '';
    const defaultStartDate = moment().subtract(1, 'months');
    const defaultEndDate = moment();
    do {
      startDate = await askQuestion('Start date(YYYY-MM-DD)?: ');
    } while (startDate.toLowerCase() !== 'd' && !moment(startDate, dateFormat).isValid()); // @improvement: I should be able to output an info when date given is not valid
    do {
      endDate = await askQuestion('End date(YYYY-MM-DD)?: ');
    } while (endDate.toLowerCase() !== 'd' && !moment(endDate, dateFormat).isValid());
    startDate = startDate.toLocaleLowerCase() === 'd' ? defaultStartDate : moment(startDate, dateFormat);
    endDate = endDate.toLocaleLowerCase() === 'd' ? defaultEndDate : moment(endDate, dateFormat);
    const dateDiffInhrs = endDate.diff(startDate, 'hours');
    return { startDate: startDate.format(dateFormat), endDate: endDate.format(dateFormat), dateDiffInhrs };
  }

  displayStats(stats) {
    // Not yet implemented
  }
}


module.exports = UI;

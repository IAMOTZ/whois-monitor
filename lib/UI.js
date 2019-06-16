/* eslint-disable class-methods-use-this */
const readline = require('readline');

class UI {
  askQuestion(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
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
      // eslint-disable-next-line no-await-in-loop
      startDate = await this.askQuestion(`Start date(${dateFormat})?: `);
    } while (startDate.toLowerCase() !== 'd' && !moment(startDate, dateFormat).isValid()); // @improvement: I should be able to output an info when date given is not valid
    do {
      // eslint-disable-next-line no-await-in-loop
      endDate = await this.askQuestion(`End date(${dateFormat})?: `);
    } while (endDate.toLowerCase() !== 'd' && !moment(endDate, dateFormat).isValid());
    startDate = startDate.toLocaleLowerCase() === 'd' ? defaultStartDate : moment(startDate, dateFormat);
    endDate = endDate.toLocaleLowerCase() === 'd' ? defaultEndDate : moment(endDate, dateFormat);
    const dateDiffInhrs = endDate.diff(startDate, 'hours');
    return {
      startDate: startDate.format(dateFormat),
      endDate: endDate.format(dateFormat),
      dateDiffInhrs,
    };
  }

  displayStats(stats, startDate, endDate) {
    console.log(`${''
      + '===============\n'
      + 'WHOIS APP STATS\n'
      + 'From '}${startDate} to ${endDate}`);
    const routeNames = Object.keys(stats);
    routeNames.forEach((routeName) => {
      const { reqPerHour, reqPerDay, reqPerMonth } = stats[routeName];
      console.log(`${''
        + '>>> '}${routeName}\n`
        + `Req per hour: ${reqPerHour}\n`
        + `Req per day: ${reqPerDay}\n`
        + `Req per month: ${reqPerMonth}\n`);
    });
    console.log('===============');
  }
}


module.exports = UI;

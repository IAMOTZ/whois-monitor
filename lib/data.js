/* eslint-disable class-methods-use-this */
const stripAnsi = require('strip-ansi');
const moment = require('moment'); // @todo I need to find a smaller package
const FileIO = require('./fileIO');
const Aws = require('./aws');

const fileIO = new FileIO();
const aws = new Aws();

class Data {
  async fetchData(useFileData, fetchOptions) {
    let logData;
    if (useFileData) {
      // Fetching log data from file system.
      if (!fileIO.confirmDataFilesExist()) {
        throw Error('Data file does not exist... You should pull from AWS');
      }
      logData = await fileIO.readLogDatafromFile();
      return logData;
    }
    // Fetching log data from AWS
    const { startDate, dateDiffInhrs } = fetchOptions;
    const objects = await aws.listObjects(startDate, dateDiffInhrs);
    let objectsData = objects.map(object => aws.getObject(object.Key));
    objectsData = await Promise.all(objectsData);
    const headers = 'id\tgenerated_at\treceived_at\tsource_id\tsource_name\tsource_ip\tfacility_name\tseverity_name\tprogram\tmessage\n';
    logData = headers + objectsData.join('');
    return logData;
  }

  processData(data) {
    const result = {};
    const validLog = (log) => {
      if (!log.program.startsWith('app')) return false;
      if (!log.message) return false;
      if (!/^(.+?) \/(.+?) (.+?) .*/.test(log.message)) return false;
      return true;
    };
    data.forEach((value) => {
      if (validLog(value)) {
        const logMessage = stripAnsi(value.message);
        const [, method, route] = logMessage.match(/^(.+?) \/(.+?) (.+?) .*/);
        if (result[`${method}${route}`]) {
          result[`${method}${route}`].push({ message: logMessage, date: value.generated_at });
        } else {
          result[`${method}${route}`] = [{ message: logMessage, date: value.generated_at }];
        }
      }
    });
    return result;
  }

  calculateStats(processedLogData, startDate, endDate) {
    const startDateMoment = moment(startDate, 'YYYY-MM-DD HH:mm:ss');
    const endDateMoment = moment(endDate, 'YYYY-MM-DD HH:mm:ss');
    const timeRangeMonth = endDateMoment.diff(startDateMoment, 'month');
    const timeRangeDays = endDateMoment.diff(startDateMoment, 'days');
    const timeRangeHours = endDateMoment.diff(startDateMoment, 'hour');
    const logStats = {};
    const logRoutes = Object.keys(processedLogData);
    logRoutes.forEach((route) => {
      logStats[route] = {
        reqPerHour: timeRangeHours > 0 ? (processedLogData[route].length / timeRangeHours) : 'Not Available',
        reqPerDay: timeRangeDays > 0 ? (processedLogData[route].length / timeRangeDays) : 'Not Available',
        reqPerMonth: timeRangeMonth > 0 ? (processedLogData[route].length / timeRangeMonth) : 'Not Available',
      };
    });
    return logStats;
  }
}

module.exports = Data;

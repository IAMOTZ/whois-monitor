const dotenv = require('dotenv');
const AWS = require('aws-sdk');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const moment = require('moment'); //@todo I need to find a smaller package
const readline = require('readline');
const tabson = require('tabson');
const stripAnsi = require('strip-ansi');

dotenv.config();

const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
const bucket = process.env.AWS_BUCKET;
const logDataPath = path.join(__dirname, 'data', 'logData.tsv');
const lastUpdatedPath = path.join(__dirname, 'data', 'lastUpdated.txt');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const getObject = (key) => {
  const promise = s3.getObject({ Key: key, Bucket: bucket }).promise();
  return new Promise((resolve, reject) => {
    promise.then(
      (data) => {
        zlib.unzip(data.Body, (err, buffer) => {
          if (!err) {
            resolve(buffer.toString());
          } else {
            console.log('>>>Error occued unzipping data: ', err);
            reject(err);
          }
        })
      },
      (err) => {
        console.log('>>>>Error occured fetching object with the key: ', key, err);
        reject(err);
      }
    );
  });
}

const listObjects = (startDate, hrsCount) => {
  const params = {
    Bucket: bucket,
    StartAfter: `papertrail/logs/whois/dt=${startDate}`,
    MaxKeys: (hrsCount > 0) ? hrsCount : 100,
  };
  const promise = s3.listObjectsV2(params).promise();
  return new Promise((resolve, reject) => {
    promise.then(
      (data) => resolve(data.Contents),
      (err) => {
        console.log('>>>Error listing object: ', err);
        reject(err)
      }
    );
  })
}


// @improvement: I don't think I need to wrap the wrting in a proimse, I could just have done writeFileSync
const writeLogDataToFile = (logString) => {
  // const { startDate, endDate } = logRange;
  // const lastUpdatedInfo = `Log start date: ${startDate}}\nLog end date: ${endDate}\nLast updated: ${new Date()}`;

  return new Promise((resolve, reject) => {
    fs.writeFile(logDataPath, logString, (err) => {
      if (err) reject(err);
      resolve();
    });
  });

  // @todo: I would just get this details from the logDataFile itself
  // fs.writeFile(lastUpdatedPath, lastUpdatedInfo, (err) => {
  //   if (err) return console.log('>>>Error updating data-track file', err);
  //   console.log('>>>Updated data track file');
  // });
}

const confirmDataFilesExist = () => {
  return new Promise((resolve, reject) => {
    fs.access(logDataPath, fs.constants.R_OK, (err) => {
      if (err) resolve(false);
      fs.access(lastUpdatedPath, fs.constants.R_OK, (err) => {
        if (err) resolve(false);
        resolve(true);
      });
    });
  });
};

const readLogDatafromFile = () => {
  return new Promise((resolve, reject) => {
    fs.readFile(logDataPath, (err, logData) => {
      if (err) reject(err);
      fs.readFile(lastUpdatedPath, (err, lastUpdatedInfo) => {
        if (err) reject(err);
        resolve({
          logData: logData.toString(),
          lastUpdatedInfo: lastUpdatedInfo.toString(),
        });
      });
    });
  });
}

// @todo: I think I need to call rl.close somewhere
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

const askForDates = async () => {
  console.info('' +
    'Enter the start date and end date to filter data from AWS.\n' +
    'Type d to use the default values.\n' +
    'For start date, the default value is today.\n' +
    'For end date, the default value is 1 month ago.\n'
  );
  const dateFormat = 'YYYY-MM-DD';
  let startDate = '', endDate = '';
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

const main = async () => {
  const shouldUseFileData = await askQuestion('Would you like to use existing data if they exist?(y/n) ');
  const useFileData = shouldUseFileData.toLowerCase() === 'y' ? true : false;

  let logData;

  if (useFileData) {
    const dataFilesExist = await confirmDataFilesExist();
    if (dataFilesExist) {
      ({ logData, lastUpdatedInfo } = await readLogDatafromFile());
      // Processing the log data
      // @todo: The logic of processing the log data is duplicated, I should do something to avoid that
      const logDataJSON = await tsvToJSON(logDataPath);
      const processedLogData = processData(logDataJSON.data);
      const startDate = '2019-05-20';
      const endDate = '2019-05-24' // @todo: Take not that the last log gotten from Amazon is kinda a day behined the actual endDate given in the input
      // const startDate = processedLogData[0].date;
      // const endDate = processedLogData[processedLogData.length - 1].date;
      const logStats = calculateStats(processedLogData, startDate, endDate);
      displayStats(logStats);
    } else {
      // @todo Make a log to the console to inform the user that data files don't exist
      // and then call main with useFileData set as false
    }
  } else {
    const { startDate, endDate, dateDiffInhrs } = await askForDates();
    let objects = await listObjects(startDate, dateDiffInhrs);
    objects = objects.map(object => getObject(object.Key));
    objects = await Promise.all(objects);
    const headers = 'id\tgenerated_at\treceived_at\tsource_id\tsource_name\tsource_ip\tfacility_name\tseverity_name\tprogram\tmessage\n';
    logData = headers + objects.join('');
    await writeLogDataToFile(logData);
    // Processing the log data
    const logDataJSON = await tsvToJSON(logDataPath);
    const processedLogData = processData(logDataJSON);

    const logStats = calculateStats(processedLogData, startDate, endDate);
    displayStats(logStats);
  }

  console.log('>>>>DONEEEEEEEE');
}

const tsvToJSON = (tsvFilePath) => {
  return new Promise((resolve, reject) => {
    tabson(logDataPath, { type: 'object' }, (err, header, data) => {
      if (err) reject(err);
      resolve({ header, data });
    });
  })
}

const processData = (data) => {
  // const { data } = await tsvToJSON(dataFilePath);

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
      logMessageMatch = logMessage.match(/^(.+?) \/(.+?) (.+?) .*/);
      const [, method, route] = logMessageMatch;
      if (result[`${method}${route}`]) {
        result[`${method}${route}`].push({ message: logMessage, date: value.generated_at });
      } else {
        result[`${method}${route}`] = [{ message: logMessage, date: value.generated_at }];
      }
    }
  });
  return result;
};

const calculateStats = (processedLogData, startDate, endDate) => {
  const startDateMoment = moment(startDate, 'YYYY-MM-DD HH:mm:ss');
  const endDateMoment = moment(endDate, 'YYYY-MM-DD HH:mm:ss');
  const timeRangeMonth = endDateMoment.diff(startDateMoment, 'month');
  const timeRangeDays = endDateMoment.diff(startDateMoment, 'days');
  const timeRangeHours = endDateMoment.diff(startDateMoment, 'hour');

  const logStats = {};
  const logRoutes = Object.keys(processedLogData);
  logRoutes.forEach(route => {
    logStats[route] = {
      reqPerHour: timeRangeHours > 0 ? (processedLogData[route].length / timeRangeHours) : null,
      reqPerDay: timeRangeDays > 0 ? (processedLogData[route].length / timeRangeDays) : null,
      reqPerMonth: timeRangeMonth > 0 ? (processedLogData[route].length / timeRangeMonth) : null,
    }
  });

  return logStats;
}

const displayStats = (stats) => {
  console.log('' +
    '==========' +
    'WHOIS APP STATS\n' // @todo: from when to when 
  );
  const routes = Object.keys(stats);
  routes.forEach((route) => {
    const { reqPerHour, reqPerDay, reqPerMonth } = stats[route];
    console.log('' +
      '>>> ' + route + '\n' +
      'Req per hour: ' + reqPerHour + '\n' +
      'Req per day: ' + reqPerDay + '\n' +
      'Req per month: ' + reqPerMonth + '\n'
    );
  })
  console.log('=========='
  );

}



main();
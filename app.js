const dotenv = require('dotenv');
const AWS = require('aws-sdk');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const moment = require('moment'); //@todo I need to find a smaller package
const readline = require('readline');

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

const writeLogDataToFile = (logString, logRange) => {
  const { startDate, endDate } = logRange;
  const lastUpdatedInfo = `Log start date: ${startDate}}\nLog end date: ${endDate}\nLast updated: ${new Date()}`;

  // @todo: I might just want to wrap this in a promise
  fs.writeFile(logDataPath, logString, (err) => {
    if (err) return console.log('>>>Error writing to file', err);
    console.log('>>>Updated data file');
  });
  fs.writeFile(lastUpdatedPath, lastUpdatedInfo, (err) => {
    if (err) return console.log('>>>Error updating data-track file', err);
    console.log('>>>Updated data track file');
  });
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
  const defaultEndDate =  moment();
  do {
    startDate = await askQuestion('Start date(YYYY-MM-DD)?: '); 
  } while(startDate.toLowerCase() !== 'd' && !moment(startDate, dateFormat).isValid()); // @improvement: I should be able to output an info when date given is not valid 
  do {
    endDate = await askQuestion('End date(YYYY-MM-DD)?: '); 
  } while(endDate.toLowerCase() !== 'd' && !moment(endDate, dateFormat).isValid());
  startDate = startDate.toLocaleLowerCase() === 'd' ? defaultStartDate : moment(startDate, dateFormat);
  endDate = endDate.toLocaleLowerCase() === 'd' ? defaultEndDate : moment(endDate, dateFormat);
  const dateDiffInhrs = endDate.diff(startDate, 'hours');
  return { startDate: startDate.format(dateFormat), endDate: endDate.format(dateFormat), dateDiffInhrs };
}

const main = async () => {
  const shouldUseFileData = await askQuestion('Would you like to use existing data if they exist?(y/n) ');
  const useFileData = shouldUseFileData.toLowerCase() === 'y' ? true : false;

  let logData;

  if(useFileData) {
    const dataFilesExist = await confirmDataFilesExist();
    if(dataFilesExist) {
      ({ logData, lastUpdatedInfo } = await readLogDatafromFile());
    } else {
      // @todo Make a log to the console to inform the user that data files don't exist
      // and then call main with useFileData set as false
    }
  } else {
    const { startDate, endDate, dateDiffInhrs } = await askForDates();
    let objects = await listObjects(startDate, dateDiffInhrs);
    objects = objects.map(object =>  getObject(object.Key));
    objects = await Promise.all(objects);
    const headers = 'id\tgenerated_at\treceived_at\tsource_id\tsource_name\tsource_ip\tfacility_name\tseverity_name\tprogram\tmessage\n';
    logData = headers + objects.join('');
    const logRange = { startDate: startDate, endDate: endDate }; // @todo: This should not be hardcoded
    writeLogDataToFile(logData, logRange);
  }
  
  console.log('>>>>DONEEEEEEEE');
}


main();
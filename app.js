const dotenv = require('dotenv');
const AWS = require('aws-sdk');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

dotenv.config();

const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
const bucket = process.env.AWS_BUCKET;
const logDataPath = path.join(__dirname, 'data', 'logData.tsv');
const lastUpdatedPath = path.join(__dirname, 'data', 'lastUpdated.txt');


const headers = 'id\tgenerated_at\treceived_at\tsource_id\tsource_name\tsource_ip\tfacility_name\tseverity_name\tprogram\tmessage\n';

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

const listObjects = (startDate, endDate) => {
  const params = {
    Bucket: bucket,
    /*
    I can use a startAfger option to specify when I want the listing to start
    I can also use a maxKeys option to specify the max no of keys I want to be returned
    The combination of thae options above can help me implement my startDate and endDate filter
    */
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
    if (err) console.log('>>>Error writing to file', err);
    console.log('>>>Updated data file');
  });
  fs.writeFile(lastUpdatedPath, lastUpdatedInfo, (err) => {
    if (err) console.log('>>>Error updating data-track file', err);
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



const main = async (useFileData = true) => {
  let logData;

  if(useFileData) {
    const dataFilesExist = await confirmDataFilesExist();
    if(dataFilesExist) {
      ({ logData, lastUpdatedInfo } = await readLogDatafromFile());
    } else {
      // Make a log to the console to inform the user that data files don't exist
      // and then call main with useFileData set as false
    }
  } else {
    let objects = await listObjects();
    objects = objects.map((object) => {
      console.log('>>>Fetching object with key: ', object.Key);
      return getObject(object.Key);
    });
    objects = await Promise.all(objects);
    logData = headers + objects.join('');
    const logRange = { startDate: new Date(), endDate: new Date() }; // @todo: This should not be hardcoded
    writeLogDataToFile(logData, logRange);
  }
  
  console.log('>>>>DONEEEEEEEE');
}


main(true);
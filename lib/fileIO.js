/* eslint-disable class-methods-use-this */
const fs = require('fs');
const path = require('path');
const tabson = require('tabson');

const logDataPath = path.join(__dirname, '..', 'data', 'logData.tsv');

class IO {
  writeLogDataToFile(logString) {
    try {
      fs.writeFileSync(logDataPath, logString);
    } catch (err) {
      console.error('>>>Error writing logData to file.');
      throw (err);
    }
    return true;
  }

  confirmDataFilesExist() {
    try {
      fs.accessSync(logDataPath, fs.constants.R_OK);
    } catch (err) {
      console.error('>>>Error trying to access logData file');
      throw (err);
    }
    return true;
  }

  readLogDatafromFile() {
    let logData;
    try {
      logData = fs.readFileSync(logDataPath);
    } catch (err) {
      console.error('>>>Error reading logData from file');
      throw (err);
    }
    return logData;
  }

  tsvFileToJSONObject(filePath) {
    return new Promise((resolve, reject) => {
      tabson(filePath, { type: 'object' }, (err, header, data) => {
        if (err) reject(err);
        resolve({ header, data });
      });
    });
  }
}

module.exports = IO;

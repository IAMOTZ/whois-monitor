/* eslint-disable class-methods-use-this */
const fs = require('fs');
const path = require('path');
const tabson = require('tabson');

class IO {
  constructor() {
    this.logDataPath = path.join(__dirname, '..', 'data', 'logData.tsv');
  }

  writeLogDataToFile(logString) {
    try {
      fs.writeFileSync(this.logDataPath, logString);
    } catch (err) {
      console.error('>>>Error writing logData to file.');
      throw (err);
    }
    return true;
  }

  confirmDataFilesExist() {
    try {
      fs.accessSync(this.logDataPath, fs.constants.R_OK);
    } catch (err) {
      console.error('>>>Error trying to access logData file');
      throw (err);
    }
    return true;
  }

  readLogDatafromFile() {
    let logData;
    try {
      logData = fs.readFileSync(this.logDataPath);
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

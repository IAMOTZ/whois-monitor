/* eslint-disable class-methods-use-this */
const AWS_SDK = require('aws-sdk');
const zlib = require('zlib');

const s3 = new AWS_SDK.S3({ apiVersion: '2006-03-01' });
const bucket = process.env.AWS_BUCKET;

class AWS {
  getObject(key) {
    const promise = s3.getObject({ Key: key, Bucket: bucket }).promise();
    return new Promise((resolve, reject) => {
      promise.then(
        (data) => {
          zlib.unzip(data.Body, (err, buffer) => {
            if (!err) resolve(buffer.toString());
            else {
              console.log('>>>Error occued unzipping data: ', err);
              reject(err);
            }
          });
        },
        (err) => {
          console.log('>>>>Error occured fetching object with the key: ', key, err);
          reject(err);
        },
      );
    });
  }

  listObjects(startDate, hrsCount) {
    const params = {
      Bucket: bucket,
      StartAfter: `papertrail/logs/whois/dt=${startDate}`,
      MaxKeys: (hrsCount > 0) ? hrsCount : 100,
    };
    const promise = s3.listObjectsV2(params).promise();
    return new Promise((resolve, reject) => {
      promise.then(
        data => resolve(data.Contents),
        (err) => {
          console.log('>>>Error listing object: ', err);
          reject(err);
        },
      );
    });
  }
}

module.exports = AWS;

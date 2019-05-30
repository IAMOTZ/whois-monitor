const dotenv = require('dotenv');
const AWS = require('aws-sdk');
const zlib = require('zlib');
const fs = require('fs');

dotenv.config();

const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
const bucket = process.env.AWS_BUCKET;

const headers = 'id\tgenerated_at\treceived_at\tsource_id\tsource_name\tsource_ip\tfacility_name\tseverity_name\tprogram\tmessage\n';
let logData = headers + '';

const getObject = (key) => {
  const promise = s3.getObject({ Key: key, Bucket: bucket }).promise();
  promise.then(
    (data) => {
      zlib.unzip(data.Body, (err, buffer) => {
        if (!err) {
          logData += buffer.toString();
        } else {
          console.log('>>>Error occued unzipping data', err);
        }
      })
    },
    (err) => {
      console.log('>>>>Error occured fetching object with the key: ', key, err);
    }
  );
  return promise;
}

const params = {
  Bucket: bucket,
  /*
  I can use a startAfter option to specify when I want the listing to start
  I can also use a maxKeys option to specify the max no of keys I want to be returned
  The combination of the options above can help me implement my startDate and endDate filter
  */
};
s3.listObjectsV2(params, async function (err, data) {
  if (err) return console.log('>>>Error listing object: ', err);
  const promises = [];
  data.Contents.forEach((content) => {
    console.log('>>>Fetching object with key: ', content.Key);
    promises.push(getObject(content.Key));
  });
  await Promise.all(promises);
  fs.writeFileSync('./output.tsv', finalString, (err) => {
    if(err) console.log('>>>Error writing to file', err);
  });
  console.log('***Result oooooo', finalString);
});



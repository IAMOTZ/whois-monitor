require('dotenv').config();
const moment = require('moment');
const Data = require('./lib/data');
const UI = require('./lib/UI');
const IO = require('./lib/fileIO');

const main = async () => {
  const data = new Data();
  const ui = new UI();
  const io = new IO();
  let useFileData = await ui.askQuestion('Would you like to use existing data if they exist?(y/n) ');
  useFileData = useFileData.toLowerCase() === 'y' || false;
  let fetchOptions = {};
  if (!useFileData) {
    const dateFilters = await ui.askForDates('YYYY-MM-DD', moment);
    fetchOptions = {
      startDate: dateFilters.startDate,
      endDate: dateFilters.endDate,
      dateDiffInhrs: dateFilters.dateDiffInhrs,
    };
  }
  const logDataString = await data.fetchData(useFileData, fetchOptions);
  io.writeLogDataToFile(logDataString);
  const { data: logData } = await io.tsvFileToJSONObject(io.logDataPath);
  const processedLogData = data.processData(logData);
  /* @todo: If I am using file data,
  the fetchOptions.startDate and fetchOptions.endDate would be undefined, fix this!! */
  const stats = data.calculateStats(processedLogData, fetchOptions.startDate, fetchOptions.endDate);
  ui.displayStats(stats, fetchOptions.startDate, fetchOptions.endDate);
};

main();

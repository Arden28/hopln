const fs = require('fs');
const csv = require('csv-parser');

// Assuming you have installed 'csv-parser' via npm: npm install csv-parser
// This script reads 'stops.csv' from the current directory and generates 'stops.ts'

const data = [];

fs.createReadStream('stops.csv')
  .pipe(csv())
  .on('data', (row) => {
    // Parse specific fields to numbers
    row.STOP_LAT = parseFloat(row.STOP_LAT);
    row.STOP_LON = parseFloat(row.STOP_LON);
    row.LOCATION_T = parseInt(row.LOCATION_T, 10);
    row.TRIP_COUNT = parseInt(row.TRIP_COUNT, 10);

    // Convert space-separated strings to comma-separated for specific fields
    if (row.ROUTE_IDS && row.ROUTE_IDS !== 'NULL') {
      row.ROUTE_IDS = row.ROUTE_IDS.split(' ').join(',');
    }
    if (row.TRIP_IDS && row.TRIP_IDS !== 'NULL') {
      row.TRIP_IDS = row.TRIP_IDS.split(' ').join(',');
    }
    if (row.ROUTE_NAMS && row.ROUTE_NAMS !== 'NULL') {
      row.ROUTE_NAMS = row.ROUTE_NAMS.split(' ').join(',');
    }

    data.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed');

    // Generate TypeScript interface based on the first row's keys
    const keys = Object.keys(data[0]);
    const interfaceFields = keys.map(key => {
      let type = 'string';
      if (key === 'STOP_LAT' || key === 'STOP_LON') type = 'number';
      if (key === 'LOCATION_T' || key === 'TRIP_COUNT') type = 'number';
      return `  ${key}: ${type};`;
    }).join('\n');

    const tsContent = `
export interface Stop {
${interfaceFields}
}

export const stops: Stop[] = ${JSON.stringify(data, null, 2)};
    `;

    fs.writeFileSync('stops.ts', tsContent);
    console.log('Generated stops.ts');
  })
  .on('error', (err) => {
    console.error('Error processing CSV:', err);
  });
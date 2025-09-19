const fs = require('fs');
const csv = require('csv-parser');

// Assuming you have installed 'csv-parser' via npm: npm install csv-parser
// This script reads 'routes.csv' from the current directory and generates 'routes.ts'

const data = [];

fs.createReadStream('routes.csv')
  .pipe(csv())
  .on('data', (row) => {
    // Parse route_type to number
    row.route_type = parseInt(row.route_type, 10);
    data.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed');

    // Generate TypeScript interface based on the first row's keys
    const keys = Object.keys(data[0]);
    const interfaceFields = keys.map(key => {
      let type = 'string';
      if (key === 'route_type') type = 'number';
      return `  ${key}: ${type};`;
    }).join('\n');

    const tsContent = `
export interface Route {
${interfaceFields}
}

export const routes: Route[] = ${JSON.stringify(data, null, 2)};
    `;

    fs.writeFileSync('routes.ts', tsContent);
    console.log('Generated routes.ts');
  })
  .on('error', (err) => {
    console.error('Error processing CSV:', err);
  });
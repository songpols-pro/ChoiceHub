const fs = require('fs');
const xlsx = require('xlsx');
const workbook = xlsx.readFile('menu.xlsx');
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
fs.writeFileSync('output_utf8.json', JSON.stringify(data, null, 2), 'utf8');

const xlsx = require('xlsx');
const workbook = xlsx.readFile('menu.xlsx');
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
console.log(JSON.stringify(data, null, 2));

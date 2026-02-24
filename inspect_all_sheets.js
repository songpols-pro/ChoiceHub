const fs = require('fs');
const xlsx = require('xlsx');

const workbook = xlsx.readFile('menu.xlsx');
console.log('Sheet Names:', workbook.SheetNames);

const allData = {};

workbook.SheetNames.forEach(sheetName => {
    allData[sheetName] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
});

fs.writeFileSync('output_all_sheets_utf8.json', JSON.stringify(allData, null, 2), 'utf8');
console.log('Saved all sheets to output_all_sheets_utf8.json');

const path = require('path')
const fs = require('fs');

const Excel = require('exceljs')

const workbookPath = path.join(__dirname, 'measure.xlsx');

const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const defaultLeftOffset = 2;
const defaultTopOffset = 3;

const insertTitle = (worksheet, title, amountCols) => {
  worksheet.columns = [
    {header: '', key: cols[0], width: 27},
    {header: title, key: cols[0], width: 24, style: { alignment: { horizontal: 'center' }}},
  ];

  worksheet.mergeCells(`${cols[1]}1:${cols[amountCols]}1`);
};

const calculateAverage = (numbers) => {
  const sum = numbers.reduce((accum, num) => accum + num, 0);
  return (sum / numbers.length).toFixed(1);
}

const prepareTimings = (timings, amountCols) => {
  const preparedDataForColumns = new Array(amountCols).fill([]);
  let colIdx = 0;

  timings.forEach((time) => {
    if (colIdx === amountCols) {
      colIdx = 0;
    }

    const newArr =[...preparedDataForColumns[colIdx]];
    newArr.push(time);
    preparedDataForColumns[colIdx] = newArr;

    colIdx += 1;
  });

  return preparedDataForColumns;
};

const getMaxAmountCols = (preparedDataForColumns) => Math.max(...preparedDataForColumns.map(arr => arr.length));

const insertTimings = (worksheet, preparedDataForColumns = [], maxAmountCols) => {
  preparedDataForColumns.forEach((col, idx) => {
    const columnByIdx = worksheet.getColumn(idx + defaultLeftOffset);
    columnByIdx.values = [,,,...col];
    columnByIdx.alignment = { horizontal: 'left' };
  });

  preparedDataForColumns.forEach((col, idx) => {
    const cell = worksheet.getCell(`${cols[idx + defaultLeftOffset - 1]}:${maxAmountCols + defaultTopOffset}`);
    cell.value = calculateAverage(col);

    // +---------+
    // |cell     |
    // +---------+
    let border = {}
    if (idx === 0) {
       border = { left: { style:'medium' } };
    }

    border = {
      ...border,
      top: { style:'medium' },
      bottom: { style:'medium' }
    };

    if (preparedDataForColumns.length - 1 === idx) {
      border = { ...border, right: { style:'medium' } };
    }

    cell.border = border;
  });
};

const insertColTitles = (worksheet, colTitles) => {
  colTitles.forEach((item, idx) => {
    const column = worksheet.getColumn(cols[idx + 1]);
    column.width = 24;
    column.alignment = { horizontal: 'left' };
    worksheet.getCell(`${cols[idx + 1]}:2`).value = item;
  });
};

const insertDescription = (worksheet, description, maxAmountCols) => {
  const firstCell = `${cols[0]}3`;
  const lastCell = `${cols[0]}${maxAmountCols + 2}`;
  const rangeCells = `${firstCell}:${lastCell}`;

  worksheet.mergeCells(rangeCells);

  const cell = worksheet.getCell(firstCell);
  cell.value = description;
  cell.alignment = {
    horizontal: 'center',
    vertical: 'middle'
  };
};

const getWorksheet = async (workbook) => {
  try {
    if (fs.existsSync(workbookPath)) {
      const stream = fs.createReadStream(workbookPath);
      const existWorkbook = await workbook.xlsx.read(stream);
      const amountWorksheets = workbook.worksheets.length;
      return existWorkbook.addWorksheet(`Performance Measure №${amountWorksheets + 1}`);
    }

    return workbook.addWorksheet('Performance Measure №1');
  } catch (e) {
    console.error(e);
  }
}

const writeExcelFile = async (info, data = []) => {
  const { title, colTitles, description } = info;
  const amountCols = colTitles.length;
  const workbook = new Excel.Workbook();

  const worksheet = await getWorksheet(workbook);

  const preparedTimings = prepareTimings(data, amountCols);
  const maxAmountCols = getMaxAmountCols(preparedTimings);

  insertTimings(worksheet, preparedTimings, maxAmountCols);
  insertDescription(worksheet, description, maxAmountCols);
  insertTitle(worksheet, title, amountCols);
  insertColTitles(worksheet, colTitles);

  await workbook.xlsx.writeFile(workbookPath);
};

module.exports = writeExcelFile;
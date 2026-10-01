import readExcelFile from 'read-excel-file/browser';
import Papa from 'papaparse';

export const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const text = (value) => String(value ?? '').trim();
const nameHeader = (value) => /^(ho va ten|ho ten|ten nhan vien|ten bao ve|nhan vien|bao ve|ho ten nv|employee|employee name|staff name|full name|name|ten nv|ten)( full name| employee name)?$/i.test(normalize(value));
const dateHeader = (value) => /^(ngay|ngay cham cong|ngay cong|ngay lam|thoi gian|thoi gian cham cong|date|datetime|check in|checkin|attendance date|gio vao|vao ca)( date|datetime)?$/i.test(normalize(value));
const markHeader = (value) => /^(cong|ca|ca lam|so cong|so ca|trang thai|ky hieu|status|work|shift|cham cong)$/i.test(normalize(value));
const pad = (n) => String(n).padStart(2, '0');
export const monthKey = (period) => /^\d{4}-\d{2}$/.test(period) ? period : '2026-09';
export const columnLetter = index => { let letter = ''; for (let n = Number(index) + 1; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + (n - 1) % 26) + letter; return letter; };
export const cellPreview = value => value instanceof Date ? `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}` : text(value);
export const keyForDay = (period, day) => `${monthKey(period)}-${pad(day)}`;
export const isValidDay = (day, period) => Number.isInteger(+day) && +day >= 1 && +day <= new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate();

// Excel dates may arrive as a serial number, a Date, or a localized date string.
export function parseDate(value, period) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  if (typeof value === 'number' && value > 30000 && value < 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  const raw = text(value);
  if (!raw) return null;
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s|T|$)/);
  if (match) return validDate(+match[1], +match[2], +match[3]);
  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?(?:\s|T|$)/);
  if (match) {
    const year = match[3] ? (+match[3] < 100 ? 2000 + +match[3] : +match[3]) : +period.slice(0, 4);
    return validDate(year, +match[2], +match[1]);
  }
  match = raw.match(/^(?:ngay\s*)?(\d{1,2})$/i);
  if (match && isValidDay(+match[1], period)) return keyForDay(period, +match[1]);
  return null;
}
function validDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? `${year}-${pad(month)}-${pad(day)}` : null;
}
function dayFromHeader(value, period) {
  if (typeof value === 'number' && value >= 1 && value <= 31 && isValidDay(value, period)) return +value;
  const raw = text(value);
  if (/^\d{1,2}$/.test(raw) && isValidDay(+raw, period)) return +raw;
  const match = raw.match(/^(?:ngày|ngay|day|d)\s*0?(\d{1,2})$/i);
  if (match && isValidDay(+match[1], period)) return +match[1];
  const date = parseDate(value, period);
  return date?.startsWith(`${period}-`) ? +date.slice(-2) : null;
}
function isMarked(value) {
  // A signing date or footer text can occupy the same column as a daily shift.
  if (value instanceof Date) return false;
  if (typeof value === 'number') return value > 0 && (value <= 16 || value === 24);
  const raw = text(value);
  const v = normalize(raw);
  if (!v || /^(0|n|no|off|nghi|nghi phep|phep|p|np|vang|v|khong|absent|leave|holiday|le|cn|chua cham|chua co)$/.test(v)) return false;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(raw) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(raw)) return false;
  if (/^\d+(?:[.,]\d+)?$/.test(raw)) return +raw.replace(',', '.') > 0 && (+raw.replace(',', '.') <= 16 || +raw.replace(',', '.') === 24);
  // Short shift codes such as X, C, HC, CA NGÀY are accepted; prose is not.
  return raw.length <= 12 && !/^(cong ty|company|ngay |nguoi |dai dien|ky |xac nhan)/.test(v);
}
const footerName = /^(cong ty( |$)|company( |$)|tong( |$)|cong$|dai dien( |$)|nguoi (lap|ky|duyet|xac nhan|kiem tra)|xac nhan( |$)|chu ky( |$)|ky ten( |$)|giam doc( |$)|prepared by|approved by|signature)/;
const footerLabel = /^(tong( |$)|total( |$)|subtotal( |$)|xac nhan|chu ky|ky ten|ky va ghi ro|nguoi lap|nguoi duyet|nguoi ky|nguoi xac nhan|dai dien|approved by|prepared by|signature)/;
function isFooterRow(row, nameCol) {
  if (footerName.test(normalize(row[nameCol]))) return true;
  return row.some((cell, col) => col !== +nameCol && footerLabel.test(normalize(cell)));
}
export function rowsForSheet(workbook, sheetName) {
  return workbook.Sheets[sheetName] || [];
}
export async function readWorkbook(file) {
  let sheets;
  if (/\.csv$/i.test(file.name)) {
    const content = await file.text();
    const parsed = Papa.parse(content, { skipEmptyLines: 'greedy' });
    if (parsed.errors.length) throw new Error(`CSV không hợp lệ (dòng ${parsed.errors[0].row + 1}).`);
    sheets = [{ sheet: 'Dữ liệu CSV', data: parsed.data }];
  } else {
    sheets = await readExcelFile(file);
  }
  if (!sheets.length) throw new Error('File không có trang tính nào.');
  return { SheetNames: sheets.map(item => item.sheet), Sheets: Object.fromEntries(sheets.map(item => [item.sheet, item.data])) };
}
function guessNameCol(rows, headerRow) {
  const samples = rows.slice(headerRow + 1, headerRow + 26);
  const width = Math.min(70, Math.max(0, ...samples.map(row => row.length)));
  let bestCol = -1, bestScore = 0;
  for (let col = 0; col < width; col++) {
    const names = samples.map(row => text(row[col])).filter(value => {
      const words = normalize(value).split(' ');
      return isPerson(value) && words.length >= 2 && !/\d/.test(value) && value.length < 65;
    });
    const score = names.length * 2 + new Set(names.map(normalize)).size;
    if (names.length >= 2 && score > bestScore) { bestScore = score; bestCol = col; }
  }
  return bestCol;
}
function guessDateCol(rows, headerRow, nameCol, period) {
  const samples = rows.slice(headerRow + 1, headerRow + 31);
  const width = Math.min(70, Math.max(0, ...samples.map(row => row.length)));
  let bestCol = -1, bestScore = 0;
  for (let col = 0; col < width; col++) {
    if (col === nameCol) continue;
    const score = samples.filter(row => parseDate(row[col], period) != null).length;
    if (score >= 2 && score > bestScore) { bestScore = score; bestCol = col; }
  }
  return bestCol;
}
export function detectConfig(rows, type, period) {
  const preview = rows.slice(0, 25);
  let best = { score: -1, headerRow: 0, nameCol: 0, dateCol: 1, markCol: -1, mode: type === 'summary' ? 'matrix' : 'list' };
  preview.forEach((row, headerRow) => {
    const nameColInRow = row.findIndex(nameHeader);
    const dateCol = row.findIndex(dateHeader);
    const markCol = row.findIndex(markHeader);
    const dayCount = row.filter((cell, col) => col !== nameColInRow && dayFromHeader(cell, period) != null).length;
    const mode = type === 'summary' && dayCount >= 2 ? 'matrix' : 'list';
    // Many real timesheets have "Họ tên" in the row above the 1–31 date headers.
    const nameColAbove = mode === 'matrix' && nameColInRow < 0
      ? preview.slice(Math.max(0, headerRow - 3), headerRow).reverse().map(previous => previous.findIndex(nameHeader)).find(col => col >= 0)
      : undefined;
    const nameCol = nameColInRow >= 0 ? nameColInRow : nameColAbove ?? -1;
    const score = (nameCol >= 0 ? 8 : 0) + (dateCol >= 0 ? 4 : 0) + (markCol >= 0 ? 1 : 0) + (type === 'summary' ? Math.min(dayCount, 12) : 0);
    if (score > best.score) best = { score, headerRow, nameCol: nameCol >= 0 ? nameCol : 0, dateCol: dateCol >= 0 ? dateCol : 1, markCol, mode };
  });
  const guessedName = guessNameCol(rows, best.headerRow);
  const sample = rows.slice(best.headerRow + 1, best.headerRow + 13);
  const nameCol = sample.some(row => isPerson(row[best.nameCol])) ? best.nameCol : guessedName >= 0 ? guessedName : best.nameCol;
  const dateCol = best.mode === 'list' && !sample.some(row => parseDate(row[best.dateCol], period))
    ? guessDateCol(rows, best.headerRow, nameCol, period) : best.dateCol;
  return { headerRow: best.headerRow, nameCol, dateCol: dateCol >= 0 ? dateCol : best.dateCol, markCol: best.markCol, mode: best.mode, endRow: 0 };
}
function isPerson(value) {
  const n = normalize(value);
  return n.length >= 2 && /[a-z]/.test(n) && !(n.includes(' ') === false && /\d/.test(n)) && !footerName.test(n) && !/^(ghi chu( |$)|trung binh( |$)|note$|stt$|ho ten$|nhan vien$|bao ve$|ngay$)/.test(n);
}
export function inspectSource(rows, config, period) {
  const dataRows = rows.slice(+config.headerRow + 1, +config.endRow > 0 ? +config.endRow : undefined);
  const names = dataRows.map(row => text(row[config.nameCol])).filter(isPerson);
  const months = {};
  let validDates = 0;
  if (config.mode === 'list') dataRows.forEach(row => {
    const date = parseDate(row[config.dateCol], period);
    if (date) { validDates++; const month = date.slice(0, 7); months[month] = (months[month] || 0) + 1; }
  });
  const dayCount = config.mode === 'matrix' ? (rows[config.headerRow] || []).filter(cell => dayFromHeader(cell, period) != null).length : 0;
  return { nameCount: names.length, nameSamples: names.slice(0, 3), rawNameSample: dataRows.map(row => cellPreview(row[config.nameCol])).find(Boolean) || '', validDates, months, dayCount, rawDateSample: dataRows.map(row => cellPreview(row[config.dateCol])).find(Boolean) || '' };
}
export function sourceError(info, config, period) {
  if (info.nameCount === 0) return `Cột ${columnLetter(config.nameCol)} không chứa họ tên nhân viên${info.rawNameSample ? ` (ví dụ: "${info.rawNameSample.slice(0, 28)}")` : ''}. Hãy chọn cột Name / Họ tên trong Cấu hình cột.`;
  if (config.mode === 'list') {
    if (!info.validDates) return `Không đọc được ngày ở cột ${columnLetter(config.dateCol)}${info.rawDateSample ? ` (ví dụ: "${info.rawDateSample.slice(0, 28)}")` : ''}. Hãy chọn lại cột ngày / thời gian.`;
    if (!info.months[period]) return `Dữ liệu ngày ở cột ${columnLetter(config.dateCol)} thuộc tháng ${Object.keys(info.months).map(key => key.slice(5) + '/' + key.slice(0, 4)).slice(0, 3).join(', ')}, không phải ${period.slice(5)}/${period.slice(0, 4)}. Hãy đổi tháng đối soát hoặc cột ngày.`;
  }
  if (config.mode === 'matrix' && !info.dayCount) return 'Không tìm thấy các cột ngày 1–31. Hãy chọn đúng dòng tiêu đề hoặc đổi kiểu dữ liệu.';
  return null;
}
export function parseRecords(rows, type, config, period) {
  const { headerRow, nameCol, dateCol, markCol, mode } = config;
  const headers = rows[headerRow] || [];
  const records = [];
  let seenStaff = false;
  const days = mode === 'matrix' ? headers.map((value, col) => ({ col, day: dayFromHeader(value, period) })).filter(({ col, day }) => col !== +nameCol && day !== null) : [];
  if (mode === 'matrix' && !days.length) throw new Error('Không tìm thấy cột ngày (1–31). Hãy kiểm tra dòng tiêu đề trong Cấu hình cột.');
  if (mode === 'list' && (+nameCol === +dateCol || +dateCol < 0)) throw new Error('Cột họ tên và ngày phải khác nhau. Hãy kiểm tra Cấu hình cột.');
  for (let i = +headerRow + 1; i < rows.length; i++) {
    if (+config.endRow > 0 && i + 1 > +config.endRow) break;
    const row = rows[i];
    // The first totals/sign-off line ends the personnel block in a matrix timesheet.
    // Ignore a title/company line above the personnel block instead of ending it.
    if (mode === 'matrix' && isFooterRow(row, nameCol)) { if (seenStaff) break; else continue; }
    const name = text(row[nameCol]);
    if (!isPerson(name)) continue;
    if (mode === 'matrix') {
      const before = records.length;
      for (const { col, day } of days) if (isMarked(row[col])) records.push({ name, date: keyForDay(period, day), row: i + 1, value: text(row[col]) });
      if (records.length > before) seenStaff = true;
    } else {
      const date = parseDate(row[dateCol], period);
      if (!date || !date.startsWith(`${period}-`)) continue;
      if (+markCol >= 0 && !isMarked(row[markCol])) continue;
      records.push({ name, date, row: i + 1, value: +markCol >= 0 ? text(row[markCol]) : text(row[dateCol]) });
    }
  }
  return records;
}
export function compareRecords(summary, attendance) {
  const group = (records) => {
    const map = new Map();
    records.forEach(record => {
      const key = `${normalize(record.name)}|${record.date}`;
      if (!map.has(key)) map.set(key, record);
    });
    return map;
  };
  const s = group(summary);
  const a = group(attendance);
  const allKeys = new Set([...s.keys(), ...a.keys()]);
  const differences = [], matched = [];
  for (const key of allKeys) {
    const left = s.get(key), right = a.get(key);
    const item = { key, name: left?.name || right?.name, date: left?.date || right?.date, summary: left || null, attendance: right || null, kind: !right ? 'missing' : !left ? 'extra' : 'matched' };
    (item.kind === 'matched' ? matched : differences).push(item);
  }
  const sort = (x, y) => x.date.localeCompare(y.date) || x.name.localeCompare(y.name, 'vi');
  differences.sort(sort); matched.sort(sort);
  return { differences, matched, summaryCount: s.size, attendanceCount: a.size, peopleCount: new Set([...summary, ...attendance].map(r => normalize(r.name))).size };
}
export function createDemo(period) {
  const people = ['Phạm Văn Phương', 'Nguyễn Thị Minh Anh', 'Trần Quốc Bảo', 'Lê Văn Hùng', 'Đỗ Minh Tuấn', 'Vũ Hoàng Nam', 'Nguyễn Văn Đức', 'Bùi Thị Lan', 'Hoàng Anh Dũng', 'Phan Quốc Khánh', 'Đặng Hải Long', 'Trịnh Văn Sơn', 'Mai Thị Ngọc', 'Lương Minh Hiếu', 'Hồ Văn Tâm', 'Ngô Quang Huy', 'Đinh Thanh Tùng', 'Trần Thị Thu Hà'];
  const numberOfDays = new Date(+period.slice(0, 4), +period.slice(5, 7), 0).getDate();
  const summary = [], attendance = [];
  people.forEach((name, index) => {
    for (let day = 1; day <= numberOfDays; day++) {
      if ((day + index * 3) % 7 === 0) continue;
      const entry = { name, date: keyForDay(period, day), value: 'X', row: index + 2 };
      summary.push(entry); attendance.push({ ...entry, value: '07:02' });
    }
  });
  const missing = [[0, 1], [2, 4], [3, 12], [7, 18], [10, 24]];
  missing.forEach(([person, day]) => {
    const key = `${people[person]}|${keyForDay(period, day)}`;
    if (!summary.some(r => `${r.name}|${r.date}` === key)) summary.push({ name: people[person], date: keyForDay(period, day), value: 'X', row: person + 2 });
    const index = attendance.findIndex(r => `${r.name}|${r.date}` === key);
    if (index !== -1) attendance.splice(index, 1);
  });
  const extra = [[5, 7], [12, 15]];
  extra.forEach(([person, day]) => {
    const key = `${people[person]}|${keyForDay(period, day)}`;
    const index = summary.findIndex(r => `${r.name}|${r.date}` === key);
    if (index !== -1) summary.splice(index, 1);
    if (!attendance.some(r => `${r.name}|${r.date}` === key)) attendance.push({ name: people[person], date: keyForDay(period, day), value: '07:05', row: person + 2 });
  });
  return { summary, attendance };
}

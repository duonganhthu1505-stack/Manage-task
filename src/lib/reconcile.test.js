import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRecords, createDemo, detectConfig, normalize, parseDate, parseRecords, readWorkbook, rowsForSheet } from './reconcile.js';

const period = '2026-09';

test('normalizes Vietnamese names consistently', () => {
  assert.equal(normalize('  PHẠM   VĂN Phương '), normalize('Pham Van Phuong'));
});

test('parses Vietnamese date, ISO date and Excel serial date', () => {
  assert.equal(parseDate('01/09/2026 07:20', period), '2026-09-01');
  assert.equal(parseDate('2026-09-04T08:00:00', period), '2026-09-04');
  assert.equal(parseDate('Ngày 1', period), null);
  assert.equal(parseDate(46266, period), '2026-09-01');
  assert.equal(parseDate('31/09/2026', period), null);
});

test('detects matrix summary and list attendance, then flags missing punch', () => {
  const summaryRows = [['STT', 'Họ và tên', '1', '2', '3'], [1, 'Phạm Văn Phương', 'X', 'X', ''], [2, 'Nguyễn Văn Đức', 'X', '', 'X']];
  const attendanceRows = [['Họ tên', 'Ngày chấm công', 'Giờ vào'], ['Nguyễn Văn Đức', '01/09/2026', '07:01'], ['Phạm Văn Phương', '02/09/2026 07:00', '07:00'], ['Nguyễn Văn Đức', '03/09/2026', '07:05']];
  const summaryConfig = detectConfig(summaryRows, 'summary', period);
  const attendanceConfig = detectConfig(attendanceRows, 'attendance', period);
  assert.equal(summaryConfig.mode, 'matrix');
  assert.equal(summaryConfig.nameCol, 1);
  assert.equal(attendanceConfig.mode, 'list');
  const result = compareRecords(parseRecords(summaryRows, 'summary', summaryConfig, period), parseRecords(attendanceRows, 'attendance', attendanceConfig, period));
  assert.equal(result.differences.length, 1);
  assert.equal(result.differences[0].kind, 'missing');
  assert.equal(result.differences[0].name, 'Phạm Văn Phương');
  assert.equal(result.differences[0].date, '2026-09-01');
  assert.equal(result.matched.length, 3);
});

test('detects extra punch, ignores absence codes and de-duplicates multiple punches in a day', () => {
  const summary = [['Họ tên', 'Ngày', 'Công'], ['Lê Văn Hùng', '01/09/2026', 'P'], ['Lê Văn Hùng', '02/09/2026', 'X']];
  const attendance = [['Họ tên', 'Ngày'], ['Lê Văn Hùng', '02/09/2026 07:00'], ['Lê Văn Hùng', '02/09/2026 17:00'], ['Lê Văn Hùng', '03/09/2026 07:00']];
  const result = compareRecords(parseRecords(summary, 'summary', detectConfig(summary, 'summary', period), period), parseRecords(attendance, 'attendance', detectConfig(attendance, 'attendance', period), period));
  assert.equal(result.summaryCount, 1);
  assert.equal(result.attendanceCount, 2);
  assert.equal(result.matched.length, 1);
  assert.equal(result.differences.length, 1);
  assert.equal(result.differences[0].kind, 'extra');
});

test('reads CSV file and exposes it as a sheet', async () => {
  const file = new File(['Họ tên,Ngày\n"Phạm Văn Phương","01/09/2026"\n'], 'cham_cong.csv', { type: 'text/csv' });
  const workbook = await readWorkbook(file);
  assert.deepEqual(workbook.SheetNames, ['Dữ liệu CSV']);
  assert.equal(rowsForSheet(workbook, workbook.SheetNames[0])[1][0], 'Phạm Văn Phương');
});

test('sample data always contains the requested Phạm Văn Phương discrepancy', () => {
  const sample = createDemo(period);
  const result = compareRecords(sample.summary, sample.attendance);
  assert.ok(result.differences.some(item => item.name === 'Phạm Văn Phương' && item.date === '2026-09-01' && item.kind === 'missing'));
  assert.equal(result.differences.length, 7);
});

test('detects a split header with names above date columns', () => {
  const rows = [['BẢNG CÔNG THÁNG 09'], ['STT', 'Họ và tên'], ['', '', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], [1, 'Phạm Văn Phương', 'X']];
  const config = detectConfig(rows, 'summary', period);
  assert.equal(config.headerRow, 2);
  assert.equal(config.nameCol, 1);
  assert.equal(config.mode, 'matrix');
  assert.equal(parseRecords(rows, 'summary', config, period)[0].date, '2026-09-01');
});

test('recognizes real-world export with Employee ID, Name and Date columns', () => {
  const rows = [['Employee ID', 'Name', 'Department', 'Shift', 'Date'], ['BV001', 'Phạm Văn Phương', 'Security', 'Day', new Date(2026, 8, 1)], ['BV002', 'Trần Quốc Bảo', 'Security', 'Night', new Date(2026, 8, 2)]];
  const config = detectConfig(rows, 'attendance', period);
  assert.equal(config.nameCol, 1);
  assert.equal(config.dateCol, 4);
  assert.equal(parseRecords(rows, 'attendance', config, period).length, 2);
});

test('infers names from data when matrix header name cell is blank', () => {
  const rows = [
    ['BẢNG CÔNG BẢO VỆ'],
    ['', '', '', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    ['', 'Khu A', 'Phạm Văn Phương', 'X'],
    ['', 'Khu A', 'Trần Quốc Bảo', 'X'],
    ['', 'Khu A', 'Nguyễn Văn Đức', 'X'],
  ];
  const config = detectConfig(rows, 'summary', period);
  assert.equal(config.mode, 'matrix');
  assert.equal(config.nameCol, 2);
  assert.equal(parseRecords(rows, 'summary', config, period).length, 3);
});

test('diagnoses a selected employee ID column and wrong date month', async () => {
  const { inspectSource, sourceError } = await import('./reconcile.js');
  const rows = [['Employee ID', 'Name', 'Date'], ['BV001', 'Phạm Văn Phương', '01/10/2026'], ['BV002', 'Trần Quốc Bảo', '02/10/2026']];
  const incorrect = { headerRow: 0, nameCol: 0, dateCol: 2, markCol: -1, mode: 'list' };
  assert.match(sourceError(inspectSource(rows, incorrect, period), incorrect, period), /Cột A không chứa họ tên/);
  const corrected = { ...incorrect, nameCol: 1 };
  assert.match(sourceError(inspectSource(rows, corrected, period), corrected, period), /10\/2026/);
});

test('stops matrix timesheet at sign-off block instead of treating signers and companies as guards', () => {
  const rows = [
    ['Họ tên', 1, 2, 22],
    ['Phạm Văn Phương', 'X', 'X', 'X'],
    ['Trần Quốc Bảo', 'X', '', 'X'],
    ['TỔNG CỘNG', 2, 1, 2],
    ['Công ty TNHH Minh Họa', '', '', 22],
    ['NGUYEN VAN A', '', '', 'X'],
    ['Sample Security Company Limited', '', '', 'X'],
  ];
  const records = parseRecords(rows, 'summary', detectConfig(rows, 'summary', period), period);
  assert.equal(records.length, 5);
  assert.deepEqual(new Set(records.map(record => record.name)), new Set(['Phạm Văn Phương', 'Trần Quốc Bảo']));
});

test('ignores signature dates and footer labels occupying daily cells', () => {
  const rows = [
    ['Họ tên', 1, 2, 22],
    ['Phạm Văn Phương', 'X', '', 'X'],
    ['Người xác nhận', '', '', new Date(2026, 8, 22)],
    ['NGUYEN VAN A', '', '', 'X'],
  ];
  const records = parseRecords(rows, 'summary', detectConfig(rows, 'summary', period), period);
  assert.equal(records.length, 2);
  assert.ok(records.every(record => record.name === 'Phạm Văn Phương'));
});

test('manual last employee row excludes signers even if no footer label exists', () => {
  const rows = [['Họ tên', 1, 2], ['Phạm Văn Phương', 'X', 'X'], ['NGUYEN VAN A', 'X', 'X']];
  const config = { ...detectConfig(rows, 'summary', period), endRow: 2 };
  const records = parseRecords(rows, 'summary', config, period);
  assert.equal(records.length, 2);
  assert.ok(records.every(record => record.name === 'Phạm Văn Phương'));
});

test('reads two-level bilingual security acceptance timesheet and compares it with punch rows', () => {
  const rows = Array.from({ length: 11 }, () => []);
  rows.push(['STT', 'Vị trí', 'Họ và tên\n(Full name)', 'Vị trí\n(Position)', 'CÁC NGÀY TRONG THÁNG']); // Excel row 12
  const dayHeader = Array(35).fill('');
  for (let day = 1; day <= 30; day++) dayHeader[day + 3] = day; // E–AH, Excel row 13
  rows.push(dayHeader);
  rows.push(['12 giờ/ngày, 6 ngày/tuần']);
  const staffA = Array(35).fill(''); staffA[0] = 1; staffA[1] = 'A3 - VCV'; staffA[2] = 'PHẠM VĂN PHƯƠNG'; staffA[3] = '12/24 giờ'; staffA[4] = 12; staffA[6] = 12;
  rows.push(staffA); // Excel row 15
  rows.push(['24 giờ/ngày, 7 ngày/tuần']);
  const staffB = Array(35).fill(''); staffB[0] = 1; staffB[1] = 'A1 - VCV'; staffB[2] = 'VÕ VĂN RƯƠNG'; staffB[4] = 12;
  rows.push(staffB);
  rows.push(['Tổng cộng']);
  const signer = Array(35).fill(''); signer[2] = 'NGUYEN VAN A'; signer[25] = 'X'; rows.push(signer);
  const config = detectConfig(rows, 'summary', period);
  assert.equal(config.headerRow, 12);
  assert.equal(config.nameCol, 2);
  assert.equal(config.mode, 'matrix');
  const summary = parseRecords(rows, 'summary', config, period);
  assert.equal(summary.length, 3);
  assert.ok(summary.some(r => r.name === 'PHẠM VĂN PHƯƠNG' && r.date === '2026-09-01' && r.value === '12'));
  const punchRows = [['Employee ID', 'Name', 'Position', 'Time', 'Date'], ['BV01', 'Pham Van Phuong', 'Security', '07:10', '03/09/2026'], ['BV02', 'Vo Van Ruong', 'Security', '07:05', '01/09/2026']];
  const punches = parseRecords(punchRows, 'attendance', detectConfig(punchRows, 'attendance', period), period);
  const result = compareRecords(summary, punches);
  assert.ok(result.differences.some(r => r.name === 'PHẠM VĂN PHƯƠNG' && r.date === '2026-09-01' && r.kind === 'missing'));
  assert.equal(result.matched.length, 2);
});

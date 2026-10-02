import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRecords } from './reconcile.js';
import {
  branchOptionsFor,
  canonicalBranchName,
  countPersonnelInBranch,
  filterRecordsByBranch,
  sanitizePersonnel,
  unregisteredNames,
  validatePersonnel,
} from './personnel.js';

const personnel = [
  { id: '1', name: 'Phạm Văn Phương', branch: 'Chi nhánh 1' },
  { id: '2', name: 'Trần Quốc Bảo', branch: 'Chi nhánh 2' },
];
const records = [
  { name: 'Pham Van Phuong', date: '2026-09-01' },
  { name: 'Trần Quốc Bảo', date: '2026-09-01' },
  { name: 'Người chưa khai báo', date: '2026-09-01' },
];

test('cleans saved personnel and ignores incomplete rows', () => {
  assert.deepEqual(sanitizePersonnel([
    { id: '1', name: '  Phạm   Văn Phương ', branch: ' Chi nhánh 1 ' },
    { id: '2', name: '', branch: 'Chi nhánh 2' },
    null,
  ]), [{ id: '1', name: 'Phạm Văn Phương', branch: 'Chi nhánh 1' }]);
});

test('creates custom branch options and resolves names without accent or case differences', () => {
  const branches = branchOptionsFor([
    ...personnel,
    { id: '3', name: 'Lê Văn Hùng', branch: 'CHI NHANH 1' },
  ]);
  assert.equal(branches.length, 2);
  assert.equal(canonicalBranchName('chi nhánh 1', personnel), 'Chi nhánh 1');
});

test('validates required fields and prevents duplicate normalized employee names', () => {
  assert.match(validatePersonnel({ name: '', branch: 'Chi nhánh 1' }, personnel), /họ và tên/);
  assert.match(validatePersonnel({ name: 'Pham Van Phuong', branch: 'Chi nhánh 1' }, personnel), /đã có/);
  assert.equal(validatePersonnel({ name: 'Phạm Văn Phương', branch: 'Chi nhánh 2' }, personnel, '1'), null);
});

test('filters records to a selected branch but keeps all records in the all scope', () => {
  assert.deepEqual(filterRecordsByBranch(records, personnel, 'branch:chi nhanh 1'), [records[0]]);
  assert.equal(filterRecordsByBranch(records, personnel, 'all'), records);
  assert.equal(countPersonnelInBranch(personnel, 'branch:chi nhanh 2'), 1);
});

test('branch reconciliation excludes other locations so their missing file does not create false differences', () => {
  const summary = [
    { name: 'Phạm Văn Phương', date: '2026-09-01', value: 'X' },
    { name: 'Trần Quốc Bảo', date: '2026-09-01', value: 'X' },
  ];
  const attendance = [{ name: 'Pham Van Phuong', date: '2026-09-01', value: '07:00' }];
  const branchOne = compareRecords(
    filterRecordsByBranch(summary, personnel, 'branch:chi nhanh 1'),
    filterRecordsByBranch(attendance, personnel, 'branch:chi nhanh 1'),
  );
  const allBranches = compareRecords(summary, attendance);
  assert.equal(branchOne.differences.length, 0);
  assert.equal(branchOne.matched.length, 1);
  assert.equal(allBranches.differences.length, 1);
  assert.equal(allBranches.differences[0].name, 'Trần Quốc Bảo');
});

test('finds unique names in uploaded records that are missing from the personnel list', () => {
  assert.deepEqual(unregisteredNames([
    ...records,
    { name: 'NGƯỜI CHƯA KHAI BÁO', date: '2026-09-02' },
  ], personnel), ['Người chưa khai báo']);
});

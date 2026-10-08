import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMealCell, parseCanteenDetail, parseCanteenPivot, parseCanteenPayment, checkCanteen, createCanteenDemo } from './canteen.js';

// Synthetic rows mimicking the real "Meal Daily report" layout:
// detail sheets are employee x date matrices with date serials in row 0.
const detailRows = [
  [null, null, null, null, null, null, null, null, 46266, 46267],
  [null, null, null, null, null, null, null, null, null, null],
  ['Status', 'Code', 'Fullname VN', 'Department', 'Section', null, null, null, 'Last day', null],
  ['Active', 'E1', 'Nguyễn Văn A', 'PMC - WH', null, null, null, null, 'Sáng - Mặn - Xưởng', 'Sáng - Mặn - Xưởng'],
  ['Active', 'E2', 'Trần Thị B', 'Pro - Expat', null, null, null, null, 'CT', 'Sáng - Trung'],
];
const pivotRows = [
  ['PRIOVOT - Sáng', null, null],
  ['Row Labels', 'Sum of meals', null],
  ['PMC - WH', 2, null],
  ['Pro - Expat', 1, null],
  ['Grand Total', 3, null],
];
const paymentRows = [
  ['Date', 'Expat Meals', 'Expat Meals - Overtime', 'Shift1+Normal', 'Shift2', 'OT', 'Total Meals per day'],
  [46266, 0, 0, 1, 0, 0, 1],
  [46267, 1, 0, 1, 0, 0, 2],
  ['Total Meals', null, null, null, null, null, 3],
  ['Category', 'Cost per Meal (VND)', 'Total Meals', 'Total Amount (VND)'],
  ['Expat Meals', 50000, 1, 50000],
  ['Vietnamese Meals', 25000, 2, 50000],
  ['Amount to pay', null, 3, 100000],
  ['3. Cost per Department', null, null, null],
  ['Deparment', 'Total Meal per deaprtment', 'Cos per Meal', 'Total Amount per Department'],
  ['PMC - WH', 2, 25000, 50000],
  ['Pro - Expat', 1, 50000, 50000],
  ['Total Amount per Department', null, null, 100000],
];

test('detail parser counts meal cells only (CT excluded, Trung flagged)', () => {
  const detail = parseCanteenDetail(detailRows);
  assert.equal(detail.employees.length, 2);
  assert.equal(detail.totalMeals, 3);
  assert.equal(detail.totalTrung, 1);
  assert.equal(detail.employees[1].meals, 1, 'CT cell must not count as a meal');
  assert.equal(detail.totalTrip, 1, 'CT is counted as a business trip note, not a meal');
  assert.deepEqual([...detail.perDay.keys()], ['2026-09-01', '2026-09-02']);
});

test('meal cell classification: công tác (CT) and báo cắt cơm never count as portions', () => {
  assert.equal(classifyMealCell('CT'), 'trip');
  assert.equal(classifyMealCell('ct'), 'trip');
  assert.equal(classifyMealCell('CT - công tác'), 'trip');
  assert.equal(classifyMealCell('Đi công tác'), 'trip');
  assert.equal(classifyMealCell('Báo cắt cơm'), 'cut');
  assert.equal(classifyMealCell('báo cắt cơm'), 'cut');
  assert.equal(classifyMealCell('Cắt cơm'), 'cut');
  assert.equal(classifyMealCell('Báo cắt'), 'cut');
  assert.equal(classifyMealCell('Hủy cơm'), 'cut');
  assert.equal(classifyMealCell('Không ăn'), 'cut');
  assert.equal(classifyMealCell('Sáng - Mặn - Xưởng'), 'meal');
  assert.equal(classifyMealCell('Sáng - Chay - VP'), 'meal');
  assert.equal(classifyMealCell('Sáng - Trung'), 'meal');
  assert.equal(classifyMealCell('Cơm ca 2'), 'meal');
  assert.equal(classifyMealCell('Cơm tăng Ca - TQ'), 'meal');
  assert.equal(classifyMealCell(2), 'meal');
  assert.equal(classifyMealCell(0), null);
  assert.equal(classifyMealCell('Tổng cộng'), null);
  assert.equal(classifyMealCell(''), null);
});

test('detail parser leaves báo cắt cơm and công tác cells out of the meal total', () => {
  const rows = [
    [null, null, null, null, null, null, null, null, 46266, 46267, 46268, 46269],
    ['Status', 'Code', 'Fullname VN', 'Department', null, null, null, null, 'Last day', null],
    ['Active', 'E1', 'Nguyễn Văn A', 'PMC - WH', null, null, null, null, 'Sáng - Mặn - Xưởng', 'Báo cắt cơm', 'CT', 'Cơm ca 2'],
    ['Active', 'E2', 'Trần Thị B', 'PMC - WH', null, null, null, null, 'Cắt cơm', 'Hủy cơm', 'Đi công tác', 'Sáng - Trung'],
  ];
  const detail = parseCanteenDetail(rows);
  assert.equal(detail.totalMeals, 3, 'only the 3 real portions count');
  assert.equal(detail.totalTrip, 2);
  assert.equal(detail.totalCut, 3);
  // Ngày chỉ có "báo cắt cơm" hoặc "công tác" không sinh phần ăn nào.
  assert.deepEqual([...detail.perDay.keys()], ['2026-09-01', '2026-09-04']);
  assert.equal(detail.perDay.get('2026-09-01').meals, 1);
  assert.equal(detail.perDay.get('2026-09-04').meals, 2);
  assert.equal(detail.perDay.has('2026-09-02'), false);
  assert.equal(detail.perDay.has('2026-09-03'), false);
});

test('pivot and payment ignore CT / báo cắt cơm rows instead of treating them as departments', () => {
  const rows = [
    ['PRIOVOT - Sáng', null, null],
    ['Row Labels', 'Sum of meals', null],
    ['PMC - WH', 3, null],
    ['CT', 5, null],
    ['Báo cắt cơm', 2, null],
    ['Grand Total', 3, null],
  ];
  const pivot = parseCanteenPivot(rows);
  assert.equal(pivot.blocks[0].entries.size, 1);
  assert.equal(pivot.blocks[0].entries.get('PMC - WH'), 3);
  assert.deepEqual(pivot.blocks[0].ignored.map(item => item.label), ['CT', 'Báo cắt cơm']);
  const payment = parseCanteenPayment([
    ['Deparment', 'Total Meal per deaprtment', 'Cos per Meal', 'Total Amount per Department'],
    ['PMC - WH', 3, 25000, 75000],
    ['Báo cắt cơm', 4, 25000, 100000],
    ['Total Amount per Department', null, null, 75000],
  ]);
  assert.equal(payment.perDepartment.size, 1);
  assert.deepEqual(payment.ignored.map(item => item.label), ['Báo cắt cơm']);
});

test('pivot parser reads PRIOVOT blocks with grand totals', () => {
  const pivot = parseCanteenPivot(pivotRows);
  assert.equal(pivot.blocks.length, 1);
  assert.equal(pivot.blocks[0].grand, 3);
  assert.equal(pivot.blocks[0].entries.get('PMC - WH'), 2);
  assert.equal(pivot.blocks[0].entries.get('Pro - Expat'), 1);
});

test('payment parser handles typo headers and cost summary', () => {
  const payment = parseCanteenPayment(paymentRows);
  assert.equal(payment.expatPrice, 50000);
  assert.equal(payment.vietPrice, 25000);
  assert.equal(payment.costSummary.totalAmount, 100000);
  assert.equal(payment.perDepartment.get('pmc-wh').meals, 2);
  assert.equal(payment.perDepartment.get('pro-expat').meals, 1);
  assert.equal(payment.totalAmount, 100000);
  assert.equal(payment.daily.length, 2);
});

test('checkCanteen passes a fully consistent file', () => {
  const detail = parseCanteenDetail(detailRows);
  const check = checkCanteen([detail], parseCanteenPivot(pivotRows), parseCanteenPayment(paymentRows));
  assert.equal(check.differences.length, 0);
  assert.equal(check.matched.length, 2);
  assert.equal(check.missing.length, 0);
  assert.equal(check.reconciliationIssues.length, 0, 'all month totals and category subtotals agree');
  assert.equal(check.dailyIssues.length, 0);
  assert.equal(check.totals.detailTotal, 3);
  assert.equal(check.totals.pivotTotal, 3);
});

test('checkCanteen flags payment below pivot and wrong expat unit price', () => {
  const detail = parseCanteenDetail(detailRows);
  const payment = parseCanteenPayment(paymentRows);
  payment.perDepartment.set('pmc-wh', { dept: 'PMC - WH', meals: 1, price: 25000, amount: 25000 });
  payment.perDepartment.set('pro-expat', { dept: 'Pro - Expat', meals: 1, price: 25000, amount: 25000 });
  const check = checkCanteen([detail], parseCanteenPivot(pivotRows), payment);
  const wh = check.rows.find(row => row.dept === 'PMC - WH');
  assert.deepEqual(wh.deltas.map(d => d.kind), ['payment-pivot']);
  assert.equal(wh.deltas[0].delta, -1);
  const expat = check.rows.find(row => row.dept === 'Pro - Expat');
  assert.ok(expat.deltas.some(d => d.kind === 'price' && d.delta === -25000));
});

test('checkCanteen flags a daily total mismatch', () => {
  const detail = parseCanteenDetail(detailRows);
  const payment = parseCanteenPayment(paymentRows);
  payment.daily[0].total = 5;
  const check = checkCanteen([detail], parseCanteenPivot(pivotRows), payment);
  assert.equal(check.dailyIssues.length, 1);
  assert.equal(check.dailyIssues[0].date, '2026-09-01');
});

test('demo dataset parses and reports the planted differences', () => {
  const demo = createCanteenDemo();
  const check = checkCanteen(demo.details, demo.pivot, demo.payment);
  assert.ok(check.differences.length >= 2);
  assert.equal(check.totals.expatPrice, 50000);
  assert.equal(check.totals.vietPrice, 25000);
});

test('per-department row reports how many CT / cắt cơm cells were left out', () => {
  const rows = [
    [null, null, null, null, null, null, null, null, 46266, 46267, 46268],
    ['Status', 'Code', 'Fullname VN', 'Department', null, null, null, null, 'Last day', null],
    ['Active', 'E1', 'Nguyễn Văn A', 'PMC - WH', null, null, null, null, 'Sáng - Mặn - Xưởng', 'CT', 'Báo cắt cơm'],
    ['Active', 'E2', 'Trần Thị B', 'PMC - WH', null, null, null, null, 'Cơm ca 2', 'Đi công tác', 'Cắt cơm'],
  ];
  const detail = parseCanteenDetail(rows);
  assert.equal(detail.totalMeals, 2);
  assert.equal(detail.totalTrip, 2);
  assert.equal(detail.totalCut, 2);
  const check = checkCanteen([detail], { blocks: [] }, { perDepartment: new Map(), daily: [] });
  const row = check.rows.find(item => item.dept === 'PMC - WH');
  assert.equal(row.detail, 2);
  assert.equal(row.detailTrip, 2);
  assert.equal(row.detailCut, 2);
  assert.equal(check.totals.detailTrip, 2);
  assert.equal(check.totals.detailCut, 2);
});

test('detail treats "Cơm tăng ca - TQ" as a Chinese/Expat meal', () => {
  const rows = [
    [null, null, null, null, null, null, null, null, 46266],
    ['Status', 'Code', 'Fullname VN', 'Department', null, null, null, null, 'Last day'],
    ['Active', 'E1', 'Nguyễn Văn A', 'Pro - Expat', null, null, null, null, 'Cơm tăng ca - TQ'],
  ];
  const detail = parseCanteenDetail(rows);
  assert.equal(detail.totalMeals, 1);
  assert.equal(detail.totalTrung, 1);
  assert.equal(detail.totalMeals - detail.totalTrung, 0, 'TQ overtime portion must not fall into Vietnamese meals');
});

test('checkCanteen catches a Vietnamese/Expat allocation mismatch even when grand totals match', () => {
  const detail = {
    employees: [{ name: 'NV 1', department: 'Pro - Expat', meals: 1, trung: 0, trip: 0, cut: 0 }],
    perDay: new Map([['2026-09-01', { meals: 1, trung: 0 }]]),
  };
  const pivot = { blocks: [{ name: 'VCV', grand: 1, entries: new Map([['Pro - Expat', 1]]) }] };
  const payment = {
    daily: [{ date: '2026-09-01', expat: 1, total: 1 }],
    dailyTotal: 1,
    expatPrice: 50000,
    vietPrice: 25000,
    totalAmount: 50000,
    costSummary: { expatMeals: 1, vietMeals: 0, expatAmount: 50000, vietAmount: 0, totalMeals: 1, totalAmount: 50000 },
    perDepartment: new Map([['pro-expat', { dept: 'Pro - Expat', meals: 1, price: 50000, amount: 50000 }]]),
  };
  const check = checkCanteen([detail], pivot, payment);
  assert.equal(check.differences.length, 0, 'the department and total quantities still agree');
  assert.deepEqual(check.reconciliationIssues.map(item => item.id).filter(id => id.startsWith('detail-payment-')), [
    'detail-payment-expat', 'detail-payment-viet',
  ]);
  assert.equal(check.dailyIssues.length, 1, 'the date-level meal-type split is also reported');
});

test('department matching keeps COO - Assistant distinct from COO Assistant', () => {
  const detail = {
    employees: [
      { name: 'NV 1', department: 'COO - Assistant', meals: 23, trung: 0 },
      { name: 'NV 2', department: 'COO Assistant', meals: 24, trung: 0 },
    ],
    perDay: new Map(),
  };
  const pivot = parseCanteenPivot([
    ['PRIOVOT VCV', null],
    ['Row Labels', 'Sum of meals'],
    ['COO - Assistant', 23],
    ['COO Assistant', 24],
    ['Grand Total', 47],
  ]);
  const payment = parseCanteenPayment([
    ['Deparment', 'Total Meal per deaprtment', 'Cos per Meal', 'Total Amount per Department'],
    ['COO - Assistant', 23, 25000, 575000],
    ['COO Assistant', 24, 25000, 600000],
    ['Total Amount per Department', null, null, 1175000],
  ]);
  const check = checkCanteen([detail], pivot, payment);
  assert.equal(check.rows.length, 2);
  assert.equal(check.totals.detailTotal, 47);
  assert.equal(check.totals.pivotTotal, 47);
  assert.equal(check.totals.payMeals, 47);
  assert.equal(check.differences.length, 0);
  assert.equal(check.missing.length, 0);
});

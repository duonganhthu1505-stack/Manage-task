import { normalize } from './reconcile.js';

const text = value => String(value ?? '').trim();
const round2 = number => Math.round(number * 100) / 100;
const isBlankDept = key => !key || /blank/.test(key);
const isDateSerial = value => (typeof value === 'number' && value > 30000 && value < 60000) || value instanceof Date;
const dateKey = value => {
  const pad = n => String(n).padStart(2, '0');
  if (value instanceof Date) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
// Only real meal categories mark a portion ("Sáng - Mặn - Xưởng", "Ca chiều",
// "Cơm ca đêm", "Sáng - Trung"...); stray codes like "CT" are not meals.
const isMealCell = value => typeof value === 'number' ? value > 0 && value <= 3 : /(^| )(man|chay|trung|com|ca)( |$)/.test(normalize(value));
const deptWord = n => /department|deparment|dept|phong ban|bo phan/.test(n);

// ---------- Detail sheets: employee x date matrix ----------
export function parseCanteenDetail(rows) {
  const headerRow = rows.findIndex(row => (row || []).some(cell => /full ?name|ho va ten/.test(normalize(cell))) && (row || []).some(cell => deptWord(normalize(cell))));
  if (headerRow < 0) return null;
  const header = rows[headerRow] || [];
  const findCol = predicate => header.findIndex(cell => predicate(normalize(cell)));
  const statusCol = findCol(n => /status|trang thai/.test(n));
  const codeCol = findCol(n => /code|ma nv|^ma$/.test(n));
  const nameCol = findCol(n => /full ?name|ho va ten|ho ten/.test(n));
  const deptCol = findCol(deptWord);
  const dateCols = [];
  (rows[0] || []).forEach((cell, col) => { if (isDateSerial(cell)) dateCols.push(col); });
  const employees = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = text(row[nameCol]);
    if (!name) continue;
    if (/^(total|grand total|tong cong)/.test(normalize(name))) break;
    const department = text(row[deptCol]);
    if (isBlankDept(normalize(department))) continue;
    let meals = 0, trung = 0;
    const days = {};
    for (const col of dateCols) {
      const value = row[col];
      if (value == null || text(value) === '' || !isMealCell(value)) continue;
      const count = typeof value === 'number' && value > 0 ? value : 1;
      meals += count;
      const isTrung = /trung|expat|cn food/.test(normalize(value));
      if (isTrung) trung += count;
      days[dateKey((rows[0] || [])[col])] = { count, trung: isTrung };
    }
    employees.push({ code: text(row[codeCol]), name, department, status: text(row[statusCol]), meals, trung, days });
  }
  const perDay = new Map();
  for (const employee of employees) for (const [day, info] of Object.entries(employee.days)) {
    const item = perDay.get(day) || { meals: 0, trung: 0 };
    item.meals += info.count; item.trung += info.trung;
    perDay.set(day, item);
  }
  return {
    headerRow, employees,
    totalMeals: employees.reduce((sum, e) => sum + e.meals, 0),
    totalTrung: employees.reduce((sum, e) => sum + e.trung, 0),
    perDay,
  };
}

// ---------- Pivot sheet: several side-by-side pivot blocks ----------
export function parseCanteenPivot(rows) {
  const blocks = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    for (let col = 0; col < row.length; col++) {
      const title = text(row[col]);
      if (!/prio?vot/i.test(title)) continue;
      const name = title.replace(/^.*?prio?vot/i, '').trim() || title;
      const labelCol = (rows[i + 1] || []).findIndex((cell, cj) => cj >= col - 1 && /row labels/.test(normalize(cell)));
      if (labelCol < 0) continue;
      const entries = new Map();
      let grand = null;
      for (let r = i + 2; r < rows.length; r++) {
        const label = text((rows[r] || [])[labelCol]);
        if (!label) continue;
        const value = Number((rows[r] || [])[labelCol + 1]) || 0;
        if (/grand total/i.test(label)) { grand = value; break; }
        if (isBlankDept(normalize(label))) continue;
        entries.set(label, value);
      }
      if (entries.size) blocks.push({ name, entries, grand });
    }
  }
  return { blocks };
}

// ---------- Payment sheet: daily totals, cost summary, cost per department ----------
export function parseCanteenPayment(rows) {
  const out = { daily: [], costSummary: null, perDepartment: new Map(), totalAmount: null, expatPrice: null, vietPrice: null };
  const dailyHeader = rows.findIndex(row => (row || []).some(cell => /^date$/.test(normalize(cell))) && (row || []).some(cell => /total meals per day/.test(normalize(cell))));
  if (dailyHeader >= 0) {
    const header = rows[dailyHeader];
    const dateCol = header.findIndex(cell => /^date$/.test(normalize(cell)));
    const expatCol = header.findIndex(cell => /expat meals(?!.*overtime)/.test(normalize(cell)));
    const expatOtCol = header.findIndex(cell => /expat.*overtime/.test(normalize(cell)));
    const totalCol = header.findIndex(cell => /total meals per day/.test(normalize(cell)));
    for (let i = dailyHeader + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      if (!isDateSerial(row[dateCol])) { if (/total meals/i.test(text(row[dateCol]))) out.dailyTotal = Number(row[totalCol]) || 0; continue; }
      out.daily.push({ date: dateKey(row[dateCol]), expat: (Number(row[expatCol]) || 0) + (Number(row[expatOtCol]) || 0), total: Number(row[totalCol]) || 0 });
    }
  }
  const costHeader = rows.findIndex(row => (row || []).some(cell => /cost per meal/.test(normalize(cell))));
  if (costHeader >= 0) {
    const summary = { expatMeals: 0, vietMeals: 0, expatAmount: 0, vietAmount: 0, totalMeals: 0, totalAmount: 0 };
    for (let i = costHeader + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const label = normalize(row[0]);
      if (/amount to pay/.test(label)) { summary.totalMeals = Number(row[2]) || summary.totalMeals; summary.totalAmount = Number(row[3]) || summary.totalAmount; break; }
      if (/expat/.test(label)) { out.expatPrice = Number(row[1]) || out.expatPrice; summary.expatMeals = Number(row[2]) || 0; summary.expatAmount = Number(row[3]) || 0; }
      if (/vietnamese|viet\b/.test(label)) { out.vietPrice = Number(row[1]) || out.vietPrice; summary.vietMeals = Number(row[2]) || 0; summary.vietAmount = Number(row[3]) || 0; }
    }
    out.costSummary = summary;
  }
  const deptHeader = rows.findIndex(row => (row || []).some(cell => deptWord(normalize(cell))) && (row || []).some(cell => /total amount/.test(normalize(cell))));
  if (deptHeader >= 0) {
    const header = rows[deptHeader];
    const deptCol = header.findIndex(cell => deptWord(normalize(cell)));
    const mealCol = header.findIndex(cell => /total meal/.test(normalize(cell)));
    const priceCol = header.findIndex(cell => /cos?t? per meal|cost per meal/.test(normalize(cell)));
    const amountCol = header.findIndex(cell => /total amount/.test(normalize(cell)));
    for (let i = deptHeader + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const dept = text(row[deptCol]);
      if (!dept) continue;
      if (/total amount/.test(normalize(dept))) { out.totalAmount = Number(row[amountCol]) || out.totalAmount; break; }
      const key = normalize(dept);
      if (isBlankDept(key)) continue;
      out.perDepartment.set(key, { dept, meals: Number(row[mealCol]) || 0, price: Number(row[priceCol]) || 0, amount: Number(row[amountCol]) || 0 });
    }
  }
  return out;
}

// Tiny synthetic dataset so the page can be demoed without a real file.
export function createCanteenDemo() {
  const emp = (department, meals, trung = 0) => ({ name: `NV ${department}`, department, meals, trung, days: {} });
  const details = [{
    name: 'VP SÁNG (minh họa)',
    employees: [emp('Pro - Packaging', 100), emp('Pro - Expat', 50, 50), emp('COO - IT', 30)],
    totalMeals: 180, totalTrung: 50, perDay: new Map(),
  }];
  const pivot = { blocks: [{ name: 'VCV Sáng (minh họa)', grand: 178, entries: new Map([['Pro - Packaging', 100], ['Pro - Expat', 50], ['COO - IT', 28]]) }] };
  const payment = {
    daily: [], expatPrice: 50000, vietPrice: 25000, totalAmount: 5750000,
    costSummary: { expatMeals: 50, vietMeals: 130, expatAmount: 2500000, vietAmount: 3250000, totalMeals: 180, totalAmount: 5750000 },
    perDepartment: new Map([
      ['pro packaging', { dept: 'Pro - Packaging', meals: 100, price: 25000, amount: 2550000 }],
      ['pro expat', { dept: 'Pro - Expat', meals: 50, price: 50000, amount: 2500000 }],
      ['coo it', { dept: 'COO - IT', meals: 28, price: 25000, amount: 700000 }],
    ]),
  };
  return { details, pivot, payment };
}

// ---------- The monthly check ----------
export function checkCanteen(detailSheets, pivot, payment, tolerance = 0) {
  const deptDetail = new Map();
  const perDay = new Map();
  for (const sheet of detailSheets) {
    for (const employee of sheet.employees) {
      const key = normalize(employee.department);
      const item = deptDetail.get(key) || { dept: employee.department, meals: 0, trung: 0, people: 0 };
      item.meals += employee.meals; item.trung += employee.trung; item.people += 1;
      deptDetail.set(key, item);
    }
    for (const [day, info] of sheet.perDay) {
      const item = perDay.get(day) || { meals: 0, trung: 0 };
      item.meals += info.meals; item.trung += info.trung;
      perDay.set(day, item);
    }
  }
  const deptPivot = new Map();
  const deptPivotLabel = new Map();
  for (const block of pivot.blocks) for (const [label, value] of block.entries) {
    const key = normalize(label);
    if (isBlankDept(key)) continue;
    deptPivot.set(key, (deptPivot.get(key) || 0) + value);
    if (!deptPivotLabel.has(key)) deptPivotLabel.set(key, label);
  }
  const deptKeys = new Set([...deptDetail.keys(), ...deptPivot.keys(), ...payment.perDepartment.keys()]);
  const expatPrice = payment.expatPrice ?? 50000;
  const vietPrice = payment.vietPrice ?? 25000;
  const rows = [];
  for (const dept of deptKeys) {
    const detail = deptDetail.get(dept) || null;
    const entry = {
      dept: detail?.dept || payment.perDepartment.get(dept)?.dept || deptPivotLabel.get(dept) || dept,
      detail: detail?.meals ?? null,
      detailTrung: detail?.trung ?? null,
      people: detail?.people ?? null,
      pivot: deptPivot.get(dept) ?? null,
      payment: payment.perDepartment.get(dept) || null,
      deltas: [], notes: [],
    };
    const isExpatDept = /expat/.test(normalize(dept)) || (detail && detail.meals > 0 && detail.trung / detail.meals >= 0.5);
    entry.expectedPrice = isExpatDept ? expatPrice : vietPrice;
    if (entry.detail != null && entry.pivot != null) {
      const delta = entry.pivot - entry.detail;
      if (Math.abs(delta) > tolerance) entry.deltas.push({ kind: 'pivot-detail', delta });
    } else if (entry.detail != null || entry.pivot != null) entry.notes.push(entry.detail == null ? 'Không có ở Detail' : 'Không có ở Pivot');
    if (entry.payment && entry.pivot != null) {
      const delta = entry.payment.meals - entry.pivot;
      if (Math.abs(delta) > tolerance) entry.deltas.push({ kind: 'payment-pivot', delta });
    } else if (entry.payment && entry.pivot == null) entry.notes.push('Không có ở Pivot');
    else if (!entry.payment) entry.notes.push('Không có ở Payment');
    if (entry.payment) {
      if (entry.payment.price !== entry.expectedPrice) entry.deltas.push({ kind: 'price', delta: entry.payment.price - entry.expectedPrice });
      const expectedAmount = entry.payment.meals * entry.payment.price;
      if (Math.abs(expectedAmount - entry.payment.amount) > tolerance) entry.deltas.push({ kind: 'amount', delta: round2(entry.payment.amount - expectedAmount) });
    }
    entry.kind = entry.deltas.length ? 'diff' : entry.notes.length ? 'missing' : 'matched';
    entry.maxAbsDelta = entry.deltas.reduce((max, d) => Math.max(max, Math.abs(d.delta)), 0);
    rows.push(entry);
  }
  rows.sort((a, b) => b.maxAbsDelta - a.maxAbsDelta || a.dept.localeCompare(b.dept, 'vi'));
  const detailTotal = [...deptDetail.values()].reduce((sum, item) => sum + item.meals, 0);
  const detailTrung = [...deptDetail.values()].reduce((sum, item) => sum + item.trung, 0);
  const pivotTotal = [...deptPivot.values()].reduce((sum, value) => sum + value, 0);
  const payMeals = [...payment.perDepartment.values()].reduce((sum, item) => sum + item.meals, 0);
  const payAmount = [...payment.perDepartment.values()].reduce((sum, item) => sum + item.amount, 0);
  const dailyIssues = [];
  for (const day of payment.daily) {
    const fromDetail = perDay.get(day.date);
    if (!fromDetail) { if (day.total > tolerance) dailyIssues.push({ date: day.date, detail: null, payment: day.total }); continue; }
    if (Math.abs(fromDetail.meals - day.total) > tolerance) dailyIssues.push({ date: day.date, detail: fromDetail.meals, payment: day.total });
  }
  const totals = {
    detailTotal, detailTrung, detailViet: detailTotal - detailTrung,
    pivotTotal,
    payMeals, payAmount,
    payExpatMeals: payment.costSummary?.expatMeals ?? null,
    payVietMeals: payment.costSummary?.vietMeals ?? null,
    expatPrice, vietPrice,
    costSummaryAmount: payment.costSummary?.totalAmount ?? null,
    expectedAmount: round2((payment.costSummary?.expatMeals ?? 0) * expatPrice + (payment.costSummary?.vietMeals ?? 0) * vietPrice),
  };
  const differences = rows.filter(row => row.kind === 'diff');
  return {
    rows, differences,
    matched: rows.filter(row => row.kind === 'matched'),
    missing: rows.filter(row => row.kind === 'missing'),
    dailyIssues, totals,
    pivotBlocks: pivot.blocks.map(block => ({ name: block.name, grand: block.grand ?? [...block.entries.values()].reduce((a, b) => a + b, 0) })),
  };
}

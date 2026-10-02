import { normalize } from './reconcile.js';

export const PERSONNEL_STORAGE_KEY = 'workly-personnel-v1';
export const ALL_BRANCHES_SCOPE = 'all';

export function sanitizePersonnel(value) {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set();
  return value.flatMap((employee, index) => {
    if (!employee || typeof employee !== 'object') return [];
    const name = String(employee.name ?? '').trim().replace(/\s+/g, ' ');
    const branch = String(employee.branch ?? '').trim().replace(/\s+/g, ' ');
    if (!name || !branch) return [];

    let id = String(employee.id ?? '').trim() || `staff-${index + 1}`;
    while (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);
    return [{ id, name, branch }];
  });
}

export function branchOptionsFor(personnel) {
  const branches = new Map();
  for (const employee of personnel) {
    const name = String(employee.branch ?? '').trim().replace(/\s+/g, ' ');
    const key = normalize(name);
    if (key && !branches.has(key)) branches.set(key, name);
  }
  return [...branches.entries()]
    .map(([key, name]) => ({ id: `branch:${key}`, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function validatePersonnel(employee, personnel, editingId = null) {
  const name = String(employee.name ?? '').trim().replace(/\s+/g, ' ');
  const branch = String(employee.branch ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return 'Vui lòng nhập họ và tên nhân viên.';
  if (!branch) return 'Vui lòng nhập chi nhánh hoặc nơi làm việc.';
  const duplicate = personnel.find(person => person.id !== editingId && normalize(person.name) === normalize(name));
  if (duplicate) return `Tên này đã có trong danh sách (${duplicate.name}). Hệ thống đối soát theo họ tên nên mỗi nhân viên cần một tên riêng.`;
  return null;
}

export function canonicalBranchName(value, personnel) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  const key = normalize(name);
  return branchOptionsFor(personnel).find(branch => branch.id === `branch:${key}`)?.name || name;
}

export function filterRecordsByBranch(records, personnel, scope = ALL_BRANCHES_SCOPE) {
  if (scope === ALL_BRANCHES_SCOPE) return records;
  const selectedBranch = scope.startsWith('branch:') ? scope.slice('branch:'.length) : normalize(scope);
  const branchByName = new Map(personnel.map(person => [normalize(person.name), normalize(person.branch)]));
  return records.filter(record => branchByName.get(normalize(record.name)) === selectedBranch);
}

export function unregisteredNames(records, personnel) {
  const registered = new Set(personnel.map(person => normalize(person.name)));
  const names = new Map();
  for (const record of records) {
    const key = normalize(record.name);
    if (key && !registered.has(key) && !names.has(key)) names.set(key, record.name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'vi'));
}

export function countPersonnelInBranch(personnel, scope = ALL_BRANCHES_SCOPE) {
  if (scope === ALL_BRANCHES_SCOPE) return personnel.length;
  const selectedBranch = scope.startsWith('branch:') ? scope.slice('branch:'.length) : normalize(scope);
  return personnel.filter(person => normalize(person.branch) === selectedBranch).length;
}

import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownToLine, ArrowRight, Bell, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock3, CloudUpload, FileSpreadsheet, FileText, FolderKanban, HelpCircle, LayoutDashboard, ListFilter, Menu, MoreHorizontal, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, UploadCloud, UsersRound, X } from 'lucide-react';
import { cellPreview, columnLetter, compareRecords, createDemo, detectConfig, inspectSource, monthKey, normalize, parseRecords, readWorkbook, rowsForSheet, sourceError } from './lib/reconcile';
import './style.css';

const now = new Date();
const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const initialPeriod = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;
const labels = { summary: 'Bảng công tổng hợp', attendance: 'Dữ liệu chấm công' };
const demoFile = type => ({ kind: 'demo', name: type === 'summary' ? 'Bang_cong_bao_ve_mau.xlsx' : 'Cham_cong_bao_ve_mau.xlsx' });
const formatNumber = number => new Intl.NumberFormat('vi-VN').format(number);
const formatDate = date => { const [year, month, day] = date.split('-'); return `${day}/${month}/${year}`; };
function initials(name) { return name.trim().split(/\s+/).slice(-2).map(s => s[0]).join('').toUpperCase(); }
function csvCell(value) { const safe = String(value ?? '').replace(/^[\s]*[=+@-]/, match => `'${match}`); return `"${safe.replaceAll('"', '""')}"`; }
function exportCSV(items, period) {
  const rows = [['Nhân viên', 'Ngày', 'Bảng công tổng hợp', 'Dữ liệu chấm công', 'Loại chênh lệch', 'Dòng bảng công', 'Dòng chấm công'], ...items.map(item => [item.name, formatDate(item.date), item.summary ? 'Có công' : 'Không có', item.attendance ? 'Có chấm công' : 'Không có', item.kind === 'missing' ? 'Thiếu chấm công' : 'Công phát sinh', item.summary?.row || '', item.attendance?.row || ''])];
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `doi-soat-bao-ve-${period}.csv`; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Sidebar({ mobileOpen, close, notify }) {
  const nav = [
    { icon: LayoutDashboard, label: 'Tổng quan' },
    { icon: FolderKanban, label: 'Quản lý công việc' },
    { icon: UsersRound, label: 'Nhân sự' },
    { icon: ShieldCheck, label: 'Quản lý bảo vệ', active: true },
    { icon: Activity, label: 'Báo cáo & phân tích' },
  ];
  return <>
    {mobileOpen && <div className="mobile-backdrop" onClick={close} />}
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><span /></span><span>workly<span className="brand-dot">.</span></span><button className="mobile-close icon-btn" onClick={close} aria-label="Đóng menu"><X size={19} /></button></div>
      <div className="workspace"><div className="workspace-avatar">W</div><div className="workspace-copy"><strong>Workspace</strong><span>Không gian làm việc</span></div><ChevronDown size={15} className="muted" /></div>
      <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav className="nav-list" aria-label="Điều hướng chính">{nav.map(({ icon: Icon, label, active }) => <button key={label} className={`nav-link ${active ? 'active' : ''}`} onClick={() => active ? close() : notify('Mục này đang được phát triển.')}><Icon size={19} strokeWidth={1.9} /><span>{label}</span>{active && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-label">HỖ TRỢ</div><button className="nav-link" onClick={() => notify('Phần cài đặt đang được phát triển.')}><Settings2 size={19} strokeWidth={1.9} /><span>Cài đặt</span></button><button className="nav-link" onClick={() => notify('Bạn có thể tải lên Excel hoặc dùng dữ liệu mẫu để thử đối soát.')}><HelpCircle size={19} strokeWidth={1.9} /><span>Trung tâm trợ giúp</span></button><div className="sidebar-profile"><div className="profile-avatar">AD</div><div className="profile-copy"><strong>Admin Workspace</strong><span>Quản trị viên</span></div><MoreHorizontal size={18} className="muted" /></div></div>
    </aside>
  </>;
}

function ConfigPanel({ data, config, onChange, period, type, diagnostics }) {
  const [previewPosition, setPreviewPosition] = useState('top');
  const rows = rowsForSheet(data.workbook, data.sheet);
  const header = rows[config.headerRow] || [];
  const width = Math.max(...rows.slice(0, 20).map(row => row.length), 2);
  const columns = Array.from({ length: Math.min(width, 100) }, (_, i) => { const sample = rows.slice(config.headerRow + 1, config.headerRow + 5).map(row => cellPreview(row[i])).find(Boolean); return { value: i, label: `${columnLetter(i)} · ${(cellPreview(header[i]) || sample || '(trống)').slice(0, 27)}` }; });
  const previewColumns = [...new Set([...Array(Math.min(width, 9)).keys(), config.nameCol, ...(config.mode === 'list' ? [config.dateCol] : [])])].filter(col => col >= 0 && col < width).sort((a, b) => a - b);
  const firstPreviewRow = previewPosition === 'bottom' ? Math.max(config.headerRow + 1, rows.length - 7) : Math.max(0, config.headerRow - 1);
  const previewRows = rows.slice(firstPreviewRow, firstPreviewRow + 7);
  const patch = changes => onChange({ ...config, ...changes });
  const selectCol = (title, key, optional = false) => <label className="config-field"><span>{title}</span><select value={config[key]} onChange={e => patch({ [key]: +e.target.value })}>{optional && <option value={-1}>Không dùng</option>}{columns.map(col => <option key={col.value} value={col.value}>{col.label}</option>)}</select></label>;
  return <div className="config-panel" onClick={e => e.stopPropagation()}>
    <div className="config-heading"><SlidersHorizontal size={15} /><strong>Cấu hình đọc file</strong></div>
    <div className="config-grid">
      <label className="config-field"><span>Trang tính</span><select value={data.sheet} onChange={e => { const sheet = e.target.value; const detected = detectConfig(rowsForSheet(data.workbook, sheet), type, period); onChange(detected, sheet); }}>{data.workbook.SheetNames.map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}</select></label>
      <label className="config-field"><span>Dòng tiêu đề</span><select value={config.headerRow} onChange={e => patch({ headerRow: +e.target.value })}>{rows.slice(0, Math.min(30, rows.length)).map((_, i) => <option key={i} value={i}>Dòng {i + 1}</option>)}</select></label>
      <label className="config-field"><span>Kiểu dữ liệu</span><select value={config.mode} onChange={e => patch({ mode: e.target.value })}><option value="matrix">Bảng ngày ngang (1–31)</option><option value="list">Danh sách theo dòng</option></select></label>
      {selectCol('Cột họ tên', 'nameCol')}
      {config.mode === 'list' && selectCol('Cột ngày / thời gian', 'dateCol')}
      {config.mode === 'list' && type === 'summary' && selectCol('Cột công / trạng thái', 'markCol', true)}
      {config.mode === 'matrix' && <label className="config-field"><span>Dòng cuối nhân viên</span><select value={config.endRow || 0} onChange={e => patch({ endRow: +e.target.value })}><option value={0}>Tự nhận diện phần ký</option>{rows.slice(config.headerRow + 1).map((_, i) => <option key={i} value={config.headerRow + 2 + i}>Dòng {config.headerRow + 2 + i}</option>)}</select></label>}
    </div>
    <div className="config-note">{formatNumber(Math.max(rows.length - config.headerRow - 1, 0))} dòng dữ liệu · {diagnostics?.nameCount || 0} dòng có tên{config.mode === 'list' ? ` · ${diagnostics?.validDates || 0} dòng có ngày` : ` · ${diagnostics?.dayCount || 0} cột ngày`} · Thay đổi cấu hình sẽ tự đối soát lại.</div>
    <div className="preview-heading"><span>Xem trước dữ liệu trong file</span><div className="preview-switch"><button className={previewPosition === 'top' ? 'selected' : ''} onClick={() => setPreviewPosition('top')}>Đầu bảng</button><button className={previewPosition === 'bottom' ? 'selected' : ''} onClick={() => setPreviewPosition('bottom')}>Cuối bảng</button></div></div>
    <div className="preview-scroll"><table className="preview-table"><thead><tr><th>DÒNG</th>{previewColumns.map(col => <th className={col === config.nameCol ? 'mapped-name' : config.mode === 'list' && col === config.dateCol ? 'mapped-date' : ''} key={col}>{columnLetter(col)}{col === config.nameCol ? ' · Họ tên' : config.mode === 'list' && col === config.dateCol ? ' · Ngày' : ''}</th>)}</tr></thead><tbody>{previewRows.map((row, i) => <tr key={i}><td>{firstPreviewRow + i + 1}{firstPreviewRow + i === config.headerRow ? ' ★' : ''}</td>{previewColumns.map(col => <td key={col} className={col === config.nameCol ? 'mapped-name' : config.mode === 'list' && col === config.dateCol ? 'mapped-date' : ''} title={cellPreview(row[col])}>{cellPreview(row[col]) || '—'}</td>)}</tr>)}</tbody></table></div>
  </div>;
}

function UploadCard({ type, index, data, config, onFile, onRemove, onConfig, period, error, diagnostics, notify }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [busy, setBusy] = useState(false);
  const handleFile = async file => {
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) { notify('Vui lòng chọn file .xlsx hoặc .csv.', true); return; }
    if (file.size > 15 * 1024 * 1024) { notify('File vượt quá giới hạn 15 MB.', true); return; }
    setBusy(true);
    try { const workbook = await readWorkbook(file); const sheet = workbook.SheetNames[0]; const config = detectConfig(rowsForSheet(workbook, sheet), type, period); onFile({ kind: 'file', name: file.name, size: file.size, workbook, sheet }, config); setShowConfig(true); }
    catch (e) { notify(`Không đọc được file: ${e.message}`, true); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  return <div className="upload-card">
    <div className="upload-card-top"><div className="step-number">0{index}</div><div className="upload-card-heading"><h3>{labels[type]}</h3><p>{type === 'summary' ? 'File bảng công đã tổng hợp theo nhân viên' : 'File xuất từ máy hoặc phần mềm chấm công'}</p></div>{data && <span className={`file-state ${data.kind === 'demo' ? 'demo-state' : ''}`}><span className="state-dot" />{data.kind === 'demo' ? 'Dữ liệu mẫu' : 'Đã tải lên'}</span>}</div>
    <input ref={inputRef} type="file" accept=".xlsx,.csv" className="visually-hidden" onChange={e => handleFile(e.target.files?.[0])} aria-label={`Chọn ${labels[type]}`} />
    <div className={`dropzone ${dragging ? 'dragging' : ''} ${data ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={e => { e.preventDefault(); setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}>
      {data ? <><div className="file-icon"><FileSpreadsheet size={23} strokeWidth={1.7} /></div><div className="file-info"><strong title={data.name}>{data.name}</strong><span>{data.kind === 'demo' ? 'File minh họa · Tải file thật để thay thế' : `${(data.size / 1024).toFixed(1)} KB · ${data.workbook.SheetNames.length} trang tính`}</span></div><button className="replace-btn" onClick={() => inputRef.current?.click()} title="Thay file" aria-label={`Thay ${labels[type]}`}><CloudUpload size={18} /></button><button className="remove-btn" onClick={onRemove} title="Xóa file" aria-label={`Xóa ${labels[type]}`}><X size={18} /></button></> : <button className="empty-dropzone" onClick={() => inputRef.current?.click()}><span className="upload-illustration"><UploadCloud size={24} strokeWidth={1.7} /></span><span><strong>{busy ? 'Đang đọc file...' : 'Nhấn để tải lên'} </strong>hoặc kéo thả file vào đây</span><small>Hỗ trợ .xlsx, .csv · Tối đa 15 MB</small></button>}
    </div>
    {data?.kind === 'file' && <button className={`config-toggle ${showConfig ? 'expanded' : ''}`} onClick={() => setShowConfig(!showConfig)}><Settings2 size={15} /> Cấu hình cột dữ liệu <ChevronDown size={15} /></button>}
    {data?.kind === 'file' && showConfig && <ConfigPanel data={data} config={config} onChange={onConfig} period={period} type={type} diagnostics={diagnostics} />}
    {error && <div className="file-error"><CircleAlert size={15} />{error}</div>}
  </div>;
}

function StatCard({ icon: Icon, label, value, sub, tone }) { return <div className={`stat-card tone-${tone}`}><div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={18} strokeWidth={2} /></div></div><strong>{formatNumber(value)}</strong><span className="stat-sub">{sub}</span></div>; }
function Presence({ present, attendance, value }) { const hours = !attendance && /^\d+(?:[.,]\d+)?$/.test(String(value ?? '')) ? ` · ${value} giờ` : ''; return <span className={`presence ${present ? 'yes' : 'no'}`}><span className="presence-dot" />{present ? attendance ? 'Có chấm công' : `Có công${hours}` : attendance ? 'Không có dữ liệu' : 'Không có công'}</span>; }
function ResultTable({ result, period, search, setSearch, filter, setFilter, tab, setTab }) {
  const dataset = tab === 'differences' ? result.differences : result.matched;
  const filtered = dataset.filter(item => (filter === 'all' || tab === 'matched' || item.kind === filter) && (!search || normalize(item.name).includes(normalize(search)) || formatDate(item.date).includes(search) || item.date.includes(search)));
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const changeTab = next => { setTab(next); setPage(1); };
  const changeFilter = next => { setFilter(next); setPage(1); };
  return <section className="results-card">
    <div className="results-head"><div><h2>Chi tiết đối soát</h2><p>Đối chiếu theo họ tên và ngày trong tháng {period.slice(5, 7)}/{period.slice(0, 4)}</p></div><span className="auto-badge"><span />Tự động cập nhật</span></div>
    <div className="results-toolbar"><div className="tabs"><button className={tab === 'differences' ? 'selected' : ''} onClick={() => changeTab('differences')}>Chênh lệch <span>{result.differences.length}</span></button><button className={tab === 'matched' ? 'selected' : ''} onClick={() => changeTab('matched')}>Đã khớp <span>{result.matched.length}</span></button></div><div className="table-controls"><label className="search-box"><Search size={17} /><input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm nhân viên, ngày..." aria-label="Tìm kiếm kết quả" />{search && <button onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><X size={14} /></button>}</label>{tab === 'differences' && <label className="filter-box"><ListFilter size={16} /><select value={filter} onChange={e => changeFilter(e.target.value)} aria-label="Lọc loại chênh lệch"><option value="all">Tất cả loại</option><option value="missing">Thiếu chấm công</option><option value="extra">Công phát sinh</option></select><ChevronDown size={13} /></label>}</div></div>
    <div className="table-scroll"><table><thead><tr><th>NHÂN VIÊN</th><th>NGÀY</th><th>BẢNG CÔNG TỔNG HỢP</th><th>DỮ LIỆU CHẤM CÔNG</th><th>TRẠNG THÁI</th></tr></thead><tbody>{visible.map(item => <tr key={item.key}><td><div className="person-cell"><span className="person-avatar">{initials(item.name)}</span><div><strong>{item.name}</strong><small>Nhân viên bảo vệ</small></div></div></td><td className="date-cell">{formatDate(item.date)}</td><td><Presence present={!!item.summary} value={item.summary?.value} /></td><td><Presence present={!!item.attendance} attendance /></td><td><span className={`status-pill ${item.kind}`}><span className="status-icon">{item.kind === 'matched' ? <Check size={13} strokeWidth={3} /> : item.kind === 'missing' ? <CircleAlert size={13} strokeWidth={2.4} /> : <ArrowRight size={13} strokeWidth={2.5} />}</span>{item.kind === 'matched' ? 'Đã khớp' : item.kind === 'missing' ? 'Thiếu chấm công' : 'Công phát sinh'}</span></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-results"><Search size={25} /><strong>Không tìm thấy kết quả</strong><span>Thử tìm với tên hoặc ngày khác.</span></div>}</div>
    <div className="table-footer"><span>Hiển thị <strong>{filtered.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)}</strong> trong <strong>{formatNumber(filtered.length)}</strong> kết quả</span><div className="pagination"><button onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} aria-label="Trang trước"><ChevronLeft size={16} /></button><span>{currentPage} / {pages}</span><button onClick={() => setPage(Math.min(pages, currentPage + 1))} disabled={currentPage === pages} aria-label="Trang sau"><ChevronRight size={16} /></button></div></div>
  </section>;
}

function App() {
  const [period, setPeriod] = useState(initialPeriod);
  const [files, setFiles] = useState({ summary: demoFile('summary'), attendance: demoFile('attendance') });
  const [configs, setConfigs] = useState({ summary: null, attendance: null });
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('differences');
  const [mobileOpen, setMobileOpen] = useState(false);
  const notify = (message, error = false) => { setToast({ message, error }); setTimeout(() => setToast(null), 4200); };
  const updateFile = (type, file, config) => {
    setFiles(prev => ({ ...prev, [type]: file, [type === 'summary' ? 'attendance' : 'summary']: prev[type === 'summary' ? 'attendance' : 'summary']?.kind === 'demo' ? null : prev[type === 'summary' ? 'attendance' : 'summary'] }));
    setConfigs(prev => ({ ...prev, [type]: config })); setSearch(''); setTab('differences');
  };
  const removeFile = type => { setFiles(prev => ({ ...prev, [type]: null })); setConfigs(prev => ({ ...prev, [type]: null })); };
  const changeConfig = (type, config, sheet) => { if (sheet) setFiles(prev => ({ ...prev, [type]: { ...prev[type], sheet } })); setConfigs(prev => ({ ...prev, [type]: config })); };
  const computed = useMemo(() => {
    const demo = createDemo(monthKey(period));
    const errors = {}, diagnostics = {}, parsed = {};
    for (const type of ['summary', 'attendance']) {
      if (!files[type]) continue;
      try {
        if (files[type].kind === 'demo') { parsed[type] = demo[type]; continue; }
        const rows = rowsForSheet(files[type].workbook, files[type].sheet);
        diagnostics[type] = inspectSource(rows, configs[type], period);
        errors[type] = sourceError(diagnostics[type], configs[type], period);
        if (errors[type]) continue;
        parsed[type] = parseRecords(rows, type, configs[type], period);
        if (!parsed[type].length) errors[type] = `Không tìm thấy ngày công hợp lệ trong tháng ${period.slice(5)}/${period.slice(0, 4)}. Hãy kiểm tra mã công, dòng tiêu đề và cột đã chọn.`;
      } catch (e) { errors[type] = e.message; }
    }
    const result = files.summary && files.attendance && !Object.values(errors).some(Boolean) ? compareRecords(parsed.summary, parsed.attendance) : null;
    return { result, errors, diagnostics };
  }, [files, configs, period]);
  const result = computed.result;
  const missing = result?.differences.filter(item => item.kind === 'missing').length || 0;
  const extra = result?.differences.filter(item => item.kind === 'extra').length || 0;
  const isDemo = files.summary?.kind === 'demo' && files.attendance?.kind === 'demo';
  const resetDemo = () => { setFiles({ summary: demoFile('summary'), attendance: demoFile('attendance') }); setConfigs({ summary: null, attendance: null }); setSearch(''); setFilter('all'); setTab('differences'); notify('Đã tải lại dữ liệu minh họa.'); };
  return <div className="app-shell">
    <Sidebar mobileOpen={mobileOpen} close={() => setMobileOpen(false)} notify={notify} />
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-btn" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><Menu size={21} /></button><span className="breadcrumb-muted">Không gian làm việc</span><ChevronRight size={15} /><strong>Quản lý bảo vệ</strong></div><div className="topbar-right"><span className="topbar-date"><CalendarDays size={16} />{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }).format(now)}</span><span className="topbar-divider" /><button className="icon-btn notification" onClick={() => notify('Bạn không có thông báo mới.')} aria-label="Thông báo"><Bell size={19} /></button><span className="top-avatar">AD</span></div></header>
      <div className="content">
        <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> VẬN HÀNH NHÂN SỰ <span className="eyebrow-separator">/</span> BẢO VỆ</div><h1>Đối soát bảng công <span>bảo vệ</span></h1><p>Tải lên dữ liệu, phát hiện chênh lệch và kiểm tra công bảo vệ trong một nơi.</p></div><div className="intro-actions"><label className="month-picker"><CalendarDays size={17} /><span>Tháng đối soát</span><input type="month" value={period} onChange={e => { if (e.target.value) { setPeriod(e.target.value); setSearch(''); } }} aria-label="Tháng đối soát" /></label><button className="export-btn" disabled={!result || !result.differences.length} onClick={() => exportCSV(result.differences, period)}><ArrowDownToLine size={17} /> Xuất báo cáo</button></div></div>
        <div className="section-title-row"><div><span className="section-kicker">BƯỚC 01 — DỮ LIỆU ĐẦU VÀO</span><h2>Tải dữ liệu để đối soát</h2><p>Sử dụng hai file Excel cùng kỳ công để có kết quả chính xác.</p></div><button className="sample-link" onClick={resetDemo}><Sparkles size={16} /> Dùng dữ liệu mẫu <ArrowRight size={15} /></button></div>
        <div className="upload-grid">{['summary', 'attendance'].map((type, i) => <UploadCard key={type} type={type} index={i + 1} data={files[type]} config={configs[type]} onFile={(file, config) => updateFile(type, file, config)} onRemove={() => removeFile(type)} onConfig={(config, sheet) => changeConfig(type, config, sheet)} period={period} error={computed.errors[type]} diagnostics={computed.diagnostics[type]} notify={notify} />)}</div>
        <div className="privacy-note"><div><ShieldCheck size={16} /> File được xử lý ngay trong trình duyệt, không tải lên máy chủ.</div><span><Clock3 size={15} /> Kết quả tự cập nhật khi thay file hoặc tháng</span></div>
        {result ? <>
          <div className="section-title-row result-section-heading"><div><span className="section-kicker">BƯỚC 02 — KẾT QUẢ ĐỐI SOÁT</span><h2>Tổng quan kết quả</h2><p>{isDemo ? 'Bạn đang xem dữ liệu minh họa. Hãy tải hai file thật để bắt đầu đối soát.' : 'Kết quả được tính tự động từ hai file bạn đã tải lên.'}</p></div><span className={`result-indicator ${isDemo ? 'demo' : ''}`}><span />{isDemo ? 'Chế độ xem thử' : 'Dữ liệu thực tế'}</span></div>
          <div className="stats-grid"><StatCard icon={UsersRound} label="Nhân viên bảo vệ" value={result.peopleCount} sub="Có trong hai nguồn dữ liệu" tone="neutral" /><StatCard icon={FileText} label="Công trong bảng tổng hợp" value={result.summaryCount} sub="Ngày công được ghi nhận" tone="neutral" /><StatCard icon={CircleAlert} label="Thiếu chấm công" value={missing} sub="Có công nhưng chưa chấm" tone="red" /><StatCard icon={Activity} label="Công phát sinh" value={extra} sub="Chấm công ngoài bảng công" tone="amber" /></div>
          {!isDemo && result.matched.length === 0 && <div className="no-overlap-warning"><CircleAlert size={17} /><span>Chưa có ngày nào khớp giữa hai file. Hãy kiểm tra hai cột họ tên và tháng đối soát trước khi sử dụng kết quả.</span></div>}
          <div className={`alert-banner ${result.differences.length ? 'warning' : 'success'}`}><div className="alert-icon">{result.differences.length ? <CircleAlert size={21} /> : <CheckCheck size={21} />}</div><div><strong>{result.differences.length ? `Phát hiện ${formatNumber(result.differences.length)} chênh lệch cần kiểm tra` : 'Dữ liệu đã khớp hoàn toàn'}</strong><p>{result.differences.length ? `${missing} ngày có công nhưng thiếu chấm công và ${extra} ngày chấm công không có trong bảng tổng hợp.` : 'Không tìm thấy khác biệt giữa hai nguồn dữ liệu trong tháng này.'}</p></div><span className="alert-side">{result.matched.length} ngày đã khớp <ArrowRight size={16} /></span></div>
          <ResultTable result={result} period={period} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} tab={tab} setTab={setTab} />
          <div className="bottom-note"><div className="bottom-note-icon"><ShieldCheck size={20} /></div><div><strong>Cách hệ thống đối soát</strong><p>Hai file không cần cùng định dạng: ô <b>12/8 giờ</b> trong bảng tổng hợp và một dòng trong file chấm công đều được quy về <b>họ tên + ngày</b>. Hệ thống báo ngày chỉ có ở một bên; chưa so sánh số giờ hay số ca.</p></div><span>WORKLY INSIGHT</span></div>
        </> : <div className="waiting-card"><div className="waiting-icon"><FileSpreadsheet size={27} /></div><h2>Sẵn sàng để đối soát</h2><p>Tải lên cả bảng công tổng hợp và dữ liệu chấm công của cùng một tháng. Kết quả chênh lệch sẽ xuất hiện tự động tại đây.</p><button onClick={resetDemo}>Xem thử với dữ liệu mẫu <ArrowRight size={16} /></button></div>}
        <footer className="footer"><span>© 2026 Workly. Quản lý công việc đơn giản hơn.</span><span>Phiên bản 1.0 <span className="footer-dot">·</span> Đối soát bảo vệ</span></footer>
      </div>
    </main>
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role="status">{toast.error ? <CircleAlert size={18} /> : <CircleCheck size={18} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Đóng thông báo"><X size={15} /></button></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

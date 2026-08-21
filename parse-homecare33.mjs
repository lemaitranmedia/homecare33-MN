// parse-homecare33.mjs
// Shared parser for the HomeCare 33 Google Sheet CSV export.
// Used BOTH by the browser page (index.html, via <script type="module">)
// and by the GitHub Action's Node script (scripts/update-history.mjs) —
// one implementation, so the two never drift apart.
//
// Design notes (why it's written this way):
// - Column offsets are derived from the data itself (by finding where a
//   known row-label like "TOTAL" repeats a second time on the same row),
//   NOT hardcoded column indices. The sheet's SBK block and HBK block are
//   laid out side by side on the same rows, separated by a spacer column
//   whose width isn't guaranteed to stay 1 column forever — deriving the
//   offset from the row content itself survives that kind of drift.
// - Every row we need is looked up by its label text ("PASG-03", "Vùng 12",
//   "TOTAL", ...), not by row number, so a stray blank row or a reordered
//   team doesn't silently misalign the data.
// - extractSnapshot() THROWS if it can't find something it expects (a
//   team row, a zone row, the TOTAL rows). The caller must not swallow
//   that error into a blank/zero value — surface it, because a wrong
//   number on a live public dashboard is worse than a visible error.
// - Reconciliation warnings (sums that don't line up) are returned, not
//   thrown — a mismatch is suspicious but not necessarily wrong (see the
//   note in the original scheduled-refresh instructions), so we still
//   render, but flag it.

export const TEAMS = ['PASG-02', 'PASG-03', 'PASG-09', 'PASG-10', 'PASG-16'];
export const ZONES = ['Vùng 9', 'Vùng 10', 'Vùng 11', 'Vùng 12', 'Vùng 12A', 'Vùng 14', 'Vùng 15', 'Vùng 16', 'Hub Private', 'HO'];

export function csvUrl(sheetId, sheetTab) {
  // range=A1:S100 is explicit on purpose: an un-ranged gviz export was
  // observed to stop right after the team table and DROP the zone tables
  // entirely (looked like an auto-detected "used range" cutting off at a
  // blank-row gap). Always pass an explicit wide range.
  return 'https://docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(sheetTab) + '&range=A1:S100';
}

// Minimal RFC4180 CSV parser: handles quoted fields, embedded commas,
// escaped quotes ("" inside a quoted field), and CRLF/LF line endings.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => (cell || '').trim() !== ''));
}

export function num(v) {
  const n = parseInt((v || '').toString().trim(), 10);
  return isNaN(n) ? 0 : n;
}

// Index of the SECOND occurrence of `label` in a row (the first is always
// column 0 — the row's own name — for both the SBK-block copy and the
// HBK-block copy of that same row).
function secondOccurrenceCol(row, label) {
  for (let i = 1; i < row.length; i++) {
    if ((row[i] || '').trim() === label) return i;
  }
  return -1;
}

function rowByLabel(rows, label) {
  const r = rows.find(r => (r[0] || '').trim() === label);
  if (!r) throw new Error('Không tìm thấy dòng "' + label + '" trong dữ liệu sheet — cấu trúc sheet có thể đã đổi so với lúc dashboard được thiết kế.');
  return r;
}

export function extractSnapshot(rows) {
  const totalRows = rows.filter(r => (r[0] || '').trim() === 'TOTAL');
  if (totalRows.length < 2) {
    throw new Error('Không tìm thấy đủ 2 dòng "TOTAL" (bảng theo team + bảng theo vùng) trong dữ liệu sheet — cấu trúc sheet có thể đã đổi.');
  }
  // Document order: team-stat table's TOTAL row comes first, zone-stat
  // table's TOTAL row comes second (matches the sheet's actual layout).
  const teamHbkCol = secondOccurrenceCol(totalRows[0], 'TOTAL');
  const zoneHbkCol = secondOccurrenceCol(totalRows[1], 'TOTAL');
  if (teamHbkCol < 0 || zoneHbkCol < 0) {
    throw new Error('Không xác định được cột bắt đầu của khối HBK trong sheet.');
  }

  const sbk = {}, hbk = {};
  TEAMS.forEach(t => {
    const r = rowByLabel(rows, t);
    sbk[t] = { TCB: num(r[1]), OM: num(r[2]), MH: num(r[3]) };
    hbk[t] = { TCB: num(r[teamHbkCol + 1]), OM: num(r[teamHbkCol + 2]), MH: num(r[teamHbkCol + 3]) };
  });

  const sbkZoneTCB = {}, hbkZoneTCB = {};
  ZONES.forEach(z => {
    const r = rowByLabel(rows, z);
    sbkZoneTCB[z] = num(r[1]);
    hbkZoneTCB[z] = num(r[zoneHbkCol + 1]);
  });

  const teamTCBTotalSBK = TEAMS.reduce((s, t) => s + sbk[t].TCB, 0);
  const zoneTotalSBK = ZONES.reduce((s, z) => s + sbkZoneTCB[z], 0);
  const teamTCBTotalHBK = TEAMS.reduce((s, t) => s + hbk[t].TCB, 0);
  const zoneTotalHBK = ZONES.reduce((s, z) => s + hbkZoneTCB[z], 0);

  const warnings = [];
  if (zoneTotalSBK !== teamTCBTotalSBK) {
    warnings.push('Tổng SBK theo vùng (' + zoneTotalSBK + ') khác tổng SBK nguồn TCB theo team (' + teamTCBTotalSBK + ').');
  }
  if (zoneTotalHBK !== teamTCBTotalHBK) {
    warnings.push('Tổng HBK theo vùng (' + zoneTotalHBK + ') khác tổng HBK nguồn TCB theo team (' + teamTCBTotalHBK + ').');
  }

  return { sbk, hbk, sbkZoneTCB, hbkZoneTCB, warnings };
}

// Today's calendar date in Asia/Saigon (UTC+7), independent of the
// visitor's (or the CI runner's) own local timezone.
export function todaySaigon() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const sg = new Date(utcMs + 7 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  return sg.getFullYear() + '-' + pad(sg.getMonth() + 1) + '-' + pad(sg.getDate());
}

// Yesterday's calendar date in Asia/Saigon. Used by the 08:00 scheduled run:
// at 8am nobody has entered new numbers yet, so the sheet's current state IS
// yesterday's closing state — stamping it as yesterday keeps each history
// entry a true end-of-day figure instead of a mid-morning partial one.
export function yesterdaySaigon() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const sg = new Date(utcMs + 7 * 3600000 - 86400000);
  const pad = n => String(n).padStart(2, '0');
  return sg.getFullYear() + '-' + pad(sg.getMonth() + 1) + '-' + pad(sg.getDate());
}

// Current instant, formatted as an Asia/Saigon ISO string with an explicit
// +07:00 offset (matches the format the dashboard's date helpers expect).
export function nowSaigonIso() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const sg = new Date(utcMs + 7 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  return sg.getFullYear() + '-' + pad(sg.getMonth() + 1) + '-' + pad(sg.getDate()) +
    'T' + pad(sg.getHours()) + ':' + pad(sg.getMinutes()) + ':' + pad(sg.getSeconds()) + '+07:00';
}

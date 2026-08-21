// scripts/update-history.mjs
// Chạy trong GitHub Actions (xem .github/workflows/update-history.yml).
// Đọc Google Sheet, tách số bằng ĐÚNG bộ parser mà trang web đang dùng
// (../parse-homecare33.mjs — dùng chung, để hai bên không bao giờ lệch logic),
// rồi ghi/ghi đè 1 dòng lịch sử trong history.json.
//
// Chọn ngày để đóng dấu bằng biến môi trường DATE_MODE:
//   DATE_MODE=yesterday  -> đóng dấu ngày HÔM QUA (dùng cho lần chạy 08:00 sáng:
//                           lúc đó chưa ai nhập số mới, nên số trên sheet chính là
//                           số CHỐT của ngày hôm qua)
//   DATE_MODE=today      -> đóng dấu ngày HÔM NAY (dùng khi bấm chạy tay giữa ngày
//                           để chốt số ngay tại thời điểm đó)
// Mặc định: today.
//
// Thoát với mã lỗi khác 0 nếu có bất kỳ vấn đề gì — để lần chạy hiện đỏ trên
// GitHub thay vì âm thầm commit số sai.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCsv, extractSnapshot, todaySaigon, yesterdaySaigon, csvUrl } from '../parse-homecare33.mjs';

const SHEET_ID = '1XyNcrpYsXEns2wOqvO5IibtkxuOj-NyGURljeOpneR8';
const SHEET_TAB = 'Homecare33';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = join(__dirname, '..', 'history.json');

async function main() {
  const mode = (process.env.DATE_MODE || 'today').trim();
  if (mode !== 'today' && mode !== 'yesterday') {
    throw new Error('DATE_MODE không hợp lệ: "' + mode + '" (chỉ chấp nhận "today" hoặc "yesterday").');
  }
  const stampDate = mode === 'yesterday' ? yesterdaySaigon() : todaySaigon();
  console.log('DATE_MODE=' + mode + ' -> đóng dấu vào ngày ' + stampDate + ' (giờ Việt Nam).');

  const res = await fetch(csvUrl(SHEET_ID, SHEET_TAB));
  if (!res.ok) {
    throw new Error('Fetch Google Sheet thất bại: HTTP ' + res.status + '. Kiểm tra sheet còn chia sẻ "Anyone with the link" không.');
  }
  const csvText = await res.text();
  const rows = parseCsv(csvText);
  const snap = extractSnapshot(rows); // ném lỗi nếu cấu trúc sheet đã đổi

  if (snap.warnings.length) {
    console.warn('CẢNH BÁO đối chiếu số liệu (vẫn ghi lại, nhưng cần kiểm tra sheet):');
    snap.warnings.forEach(w => console.warn(' - ' + w));
  }

  const history = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
  const entry = {
    date: stampDate,
    sbk: snap.sbk,
    hbk: snap.hbk,
    sbkZoneTCB: snap.sbkZoneTCB,
    hbkZoneTCB: snap.hbkZoneTCB,
  };
  const idx = history.findIndex(h => h.date === stampDate);
  if (idx >= 0) {
    console.log('Đã có dòng cho ngày ' + stampDate + ' — GHI ĐÈ bằng số mới nhất.');
    history[idx] = entry;
  } else {
    console.log('Thêm dòng mới cho ngày ' + stampDate + '.');
    history.push(entry);
  }
  history.sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
  console.log('Đã cập nhật history.json:', JSON.stringify(entry));
}

main().catch(err => {
  console.error('LỖI khi cập nhật history.json: ' + (err && err.message ? err.message : err));
  console.error('Dừng lại, KHÔNG commit dữ liệu — thà bỏ 1 lần chạy còn hơn ghi số sai.');
  process.exit(1);
});

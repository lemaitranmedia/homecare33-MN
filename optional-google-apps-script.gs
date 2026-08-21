/**
 * TUỲ CHỌN — chỉ dùng nếu bạn muốn chốt lịch sử NGAY mỗi khi sheet thay đổi,
 * thay vì chờ lần chạy 08:00 sáng hoặc bấm tay.
 *
 * Lưu ý trước khi làm: trang dashboard vốn đã đọc thẳng Google Sheet mỗi lần
 * tải, nên SỐ HIỂN THỊ luôn mới nhất mà không cần script này. Script này chỉ
 * ảnh hưởng tới việc ghi lại lịch sử theo ngày (phục vụ cột "Hot hôm nay" và
 * biểu đồ Diễn biến theo ngày). Vì lịch sử tính theo NGÀY, chạy nhiều lần
 * trong ngày chỉ ghi đè lại dòng của ngày đó — nên với đa số trường hợp,
 * lịch 08:00 + nút bấm tay là đủ, không cần script này.
 *
 * CÁCH CÀI (nếu vẫn muốn dùng):
 *
 * 1. Tạo GitHub token:
 *    GitHub -> ảnh đại diện (góc phải trên) -> Settings -> Developer settings
 *    -> Personal access tokens -> Fine-grained tokens -> Generate new token
 *    - Repository access: Only select repositories -> chọn repo chứa dashboard
 *    - Permissions -> Repository permissions -> Contents: Read and write
 *    - Bấm Generate token, COPY chuỗi token (chỉ hiện 1 lần).
 *
 * 2. Mở Google Sheet nguồn -> menu Tiện ích mở rộng (Extensions)
 *    -> Apps Script. Xoá code mẫu, dán toàn bộ file này vào.
 *
 * 3. Sửa 3 dòng CONFIG ngay bên dưới cho đúng repo và token của bạn.
 *
 * 4. Trong Apps Script, bấm biểu tượng đồng hồ (Triggers/Trình kích hoạt)
 *    -> Add Trigger:
 *       - Choose which function to run: onSheetChange
 *       - Select event source: From spreadsheet
 *       - Select event type: On change
 *    -> Save. Lần đầu Google sẽ hỏi cấp quyền, bấm đồng ý.
 *
 * BẢO MẬT: token này có quyền ghi vào repo. Không chia sẻ file Apps Script
 * này cho người khác sau khi đã điền token vào.
 */

// ===== CONFIG — sửa 3 dòng này =====
const GITHUB_OWNER = 'TEN-TAI-KHOAN-GITHUB-CUA-BAN';
const GITHUB_REPO  = 'TEN-REPO-CHUA-DASHBOARD';
const GITHUB_TOKEN = 'DAN-TOKEN-VAO-DAY';
// ===================================

// Chặn gọi dồn dập: sheet sửa liên tục sẽ chỉ gọi GitHub tối đa 1 lần / 10 phút.
const MIN_INTERVAL_MS = 10 * 60 * 1000;

function onSheetChange(e) {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('lastDispatchMs') || 0);
  const now = Date.now();
  if (now - last < MIN_INTERVAL_MS) {
    console.log('Bỏ qua — mới gọi cách đây ' + Math.round((now - last) / 1000) + ' giây.');
    return;
  }

  const url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/dispatches';
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + GITHUB_TOKEN,
      Accept: 'application/vnd.github+json'
    },
    payload: JSON.stringify({ event_type: 'update-history' }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 204) {
    props.setProperty('lastDispatchMs', String(now));
    console.log('Đã kích hoạt cập nhật lịch sử trên GitHub.');
  } else {
    console.error('Gọi GitHub thất bại. HTTP ' + code + ': ' + res.getContentText());
  }
}

/** Chạy hàm này 1 lần (bấm Run) để kiểm tra token/repo đã đúng chưa. */
function testDispatch() {
  PropertiesService.getScriptProperties().deleteProperty('lastDispatchMs');
  onSheetChange(null);
}

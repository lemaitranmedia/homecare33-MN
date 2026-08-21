# HomeCare 33 Dashboard — bản GitHub

Dashboard theo dõi SBK/HBK chiến dịch HomeCare 33, SIH Miền Nam — OneHousing.

## Cơ chế cập nhật số liệu

Có 3 lớp, phục vụ 3 mục đích khác nhau:

| Lớp | Cập nhật cái gì | Khi nào chạy | Ai kích hoạt được |
|---|---|---|---|
| **Đọc trực tiếp (live fetch)** | Toàn bộ số hiển thị trên trang | Mỗi lần mở/tải lại trang, và tự động mỗi 5 phút với tab để mở sẵn | Tự động, không cần ai |
| **Lịch sáng hằng ngày** | Ghi 1 dòng lịch sử vào `history.json` (đóng dấu ngày **hôm qua**) | ~08:12 sáng giờ VN, tự động mỗi ngày | Tự động (GitHub Actions) |
| **Chạy tay (adhoc)** | Ghi/ghi đè 1 dòng lịch sử | Bất cứ lúc nào bạn muốn | **Chỉ người có quyền ghi vào repo** |

**Điểm quan trọng:** số trên dashboard **luôn là số mới nhất của sheet**, không phải chờ tới 8h sáng. Sheet vừa sửa xong, ai mở trang (hoặc bấm nút *Làm mới*) là thấy ngay. `history.json` chỉ phục vụ phần so sánh theo ngày (cột "Hot hôm nay" và biểu đồ *Diễn biến theo ngày*) — vì bản thân Google Sheet chỉ lưu số cộng dồn hiện tại, không lưu lịch sử.

**Lịch chạy tự động, không phải bấm tay mỗi ngày.** Sau khi file workflow nằm trên **nhánh mặc định** của repo (thường là `main`), GitHub tự chạy hằng ngày. Nút *Run workflow* chỉ dùng khi cần chạy đột xuất.

Hai điều kiện để lịch tự chạy được, theo tài liệu GitHub:

- Workflow phải nằm trên **nhánh mặc định**. Để ở nhánh khác thì lịch **không** kích hoạt.
- Lịch bị **tự động tắt sau 60 ngày repo không có hoạt động** (hoạt động = push commit, mở pull request, hoặc tạo issue). Chiến dịch này kết thúc 30/09 nên chưa chạm mốc đó, nhưng nếu dùng lâu dài thì cần lưu ý.

**Vì sao lịch sáng lại đóng dấu ngày hôm qua:** lúc 8h sáng chưa ai nhập số mới trong ngày, nên số đang có trên sheet chính là số **chốt** của ngày hôm qua. Đóng dấu như vậy để mỗi dòng lịch sử là số cuối ngày thật, không phải số dở dang buổi sáng. Còn ngày hôm nay thì trang tự lấy số live, luôn đúng.

**Ghi đè, không cộng dồn nhiều dòng/ngày:** mỗi ngày chỉ có tối đa 1 dòng trong `history.json`. Chạy lại nhiều lần trong cùng một ngày thì dòng của ngày đó bị ghi đè bằng số mới nhất.

## Các file

| File | Vai trò |
|---|---|
| `index.html` | Trang dashboard. Tự đọc Google Sheet mỗi lần tải + nút *Làm mới* + tự làm mới mỗi 5 phút. |
| `parse-homecare33.mjs` | Logic đọc & tách số từ CSV của Google Sheet. Dùng chung cho cả trang web lẫn script tự động, để hai bên không bao giờ lệch nhau. |
| `static-meta.json` | Thông tin ít đổi: tên chiến dịch, các mốc thời gian, danh sách vùng, nhãn nguồn. |
| `history.json` | Lịch sử theo ngày (đã có sẵn 19/8 và 20/8). GitHub Actions sẽ tự nối thêm. |
| `.github/workflows/update-history.yml` | Lịch 08:00 + nút chạy tay + cổng gọi qua API. |
| `scripts/update-history.mjs` | Script mà workflow chạy. |
| `optional-google-apps-script.gs` | **Tuỳ chọn**, không bắt buộc. Xem phần cuối. |

## Cài đặt trên GitHub

1. Đẩy toàn bộ file trong thư mục này lên repo — **giữ nguyên cấu trúc thư mục**, kể cả thư mục ẩn `.github/`.
2. **Settings → Pages** → chọn nhánh và thư mục tương ứng → Save.
3. **Settings → Actions → General → Workflow permissions** → chọn **"Read and write permissions"** → Save.
   *Bắt buộc.* Không bật thì workflow chạy xong sẽ không push được `history.json`.
4. Mở tab **Actions**. Lần đầu GitHub có thể hỏi xác nhận bật Actions — bấm đồng ý.
5. Mở link GitHub Pages để kiểm tra trang lên đúng số.

## Cập nhật adhoc (chỉ bạn thao tác được)

Vào repo → tab **Actions** → chọn workflow **"Cập nhật lịch sử HomeCare 33"** ở cột trái → nút **Run workflow** bên phải → chọn:

- `today` — chốt số hiện tại thành dòng lịch sử của **hôm nay** (dùng khi muốn ghim mốc giữa ngày).
- `yesterday` — chốt số hiện tại thành dòng lịch sử của **hôm qua** (dùng khi lần chạy 8h sáng bị lỗi và cần chạy bù).

→ bấm **Run workflow**. Khoảng 30–60 giây sau là xong.

**Về phân quyền:** nút *Run workflow* chỉ hiện với tài khoản có quyền ghi (write/admin) vào repo. Kể cả khi repo để công khai, người ngoài vào xem được lịch sử chạy nhưng **không bấm chạy được**. Muốn thêm người được phép, vào **Settings → Collaborators** và cấp quyền Write cho họ.

Nút *Làm mới* trên trang dashboard thì ai cũng bấm được — nhưng nút đó chỉ đọc lại số từ sheet để hiển thị, **không ghi gì vào repo**, nên không ảnh hưởng tới nguyên tắc trên.

## Yêu cầu bắt buộc với Google Sheet

Sheet nguồn phải luôn ở chế độ chia sẻ **"Anyone with the link"**, quyền tối thiểu **Viewer**. Nếu tắt chia sẻ này, trang sẽ hiện màn hình báo lỗi rõ ràng chứ không hiển thị số sai.

## Khi có sự cố

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Trang hiện "Không tải được dữ liệu trực tiếp" | Sheet đã tắt chia sẻ công khai, hoặc đổi tên tab `Homecare33`. |
| Trang hiện "Không tìm thấy dòng ... trong dữ liệu sheet" | Cấu trúc bảng trong sheet đã đổi (đổi tên team/vùng, xoá dòng TOTAL...). Trang cố tình báo lỗi thay vì đoán số. |
| Có banner vàng cảnh báo đối chiếu | Tổng theo vùng lệch tổng theo team. Trang **vẫn hiện số đọc được**, không tự sửa — cần kiểm tra lại sheet. |
| Workflow chạy đỏ | Mở tab Actions, bấm vào lần chạy lỗi để đọc log — script in rõ lý do bằng tiếng Việt. |
| Workflow chạy xanh nhưng không thấy đổi gì | Số trên sheet không đổi so với lần chạy trước → không có gì để commit. Đây là hành vi đúng. |

## Tuỳ chọn nâng cao: chốt lịch sử ngay khi sheet thay đổi

Xem hướng dẫn trong `optional-google-apps-script.gs`.

**Đa số trường hợp không cần dùng.** Số hiển thị trên dashboard vốn đã luôn mới nhất nhờ đọc trực tiếp; còn lịch sử thì tính theo ngày, nên chạy nhiều lần trong ngày cũng chỉ ghi đè lại dòng của ngày đó. Lịch 08:00 + nút chạy tay là đủ cho vận hành bình thường.

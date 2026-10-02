# Workly — Đối soát bảng công bảo vệ

Giao diện quản lý và đối soát bảng công bảo vệ, chạy hoàn toàn ở trình duyệt. Dữ liệu minh họa được hiển thị sẵn để thử giao diện; tải **cả hai file thật** để thay thế và xem kết quả thực tế.

## Chạy dự án

```bash
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trên terminal. Kiểm tra bằng `npm test` và `npm run build`.

## Triển khai trên Netlify

Ứng dụng sử dụng **Netlify Functions + Netlify Blobs** để đồng bộ danh sách nhân sự qua tất cả thiết bị.

1. Đẩy code lên GitHub.
2. Kết nối repo với Netlify (New site from Git → chọn repo).
3. Netlify sẽ tự động build và deploy. Không cần cấu hình thêm.

Khi triển khai thành công, danh sách nhân sự sẽ **tự động đồng bộ** giữa mọi thiết bị truy cập cùng một URL — máy tính, điện thoại, tablet — không cần thao tác thủ công.

> **Lưu ý khi chạy local:** `npm run dev` chỉ chạy frontend, không có Netlify Functions. Dữ liệu nhân sự sẽ lưu cục bộ trên trình duyệt. Để test đồng bộ local, dùng `npx netlify dev` thay vì `npm run dev`.

## Cách dùng

1. Chọn **tháng đối soát** ở góc phải.
2. Tải lên **bảng công tổng hợp** và **dữ liệu chấm công** (`.xlsx` hoặc `.csv`, tối đa 15 MB/file). Có thể nhấn để chọn hoặc kéo thả file.
3. Hệ thống tự đọc trang tính đầu tiên và tìm cột họ tên, ngày, công/trạng thái. Nếu cấu trúc file khác, mở **Cấu hình cột dữ liệu** ở dưới từng file để chọn trang tính, dòng tiêu đề, kiểu bảng và cột tương ứng. Bảng **Xem trước dữ liệu trong file** đánh dấu cột họ tên/ngày đang chọn; hãy tránh chọn `Employee ID` thay cho `Name`. Với bảng công có phần ký xác nhận ở cuối, chọn **Cuối bảng** để xem và dùng **Dòng cuối nhân viên** nếu cần giới hạn phạm vi nhân viên. Nếu ngày trong file khác tháng đang chọn, hệ thống sẽ báo tháng thực tế đọc được.
4. Mở mục **Nhân sự** ở thanh bên để thêm họ tên bảo vệ và **chi nhánh / nơi làm việc**. Bạn có thể tự đặt tên chi nhánh, sửa hoặc xóa nhân sự; chi nhánh tự hình thành từ nơi làm việc đã gán. Danh sách nhân sự được **đồng bộ tự động qua tất cả thiết bị**.
5. Ở mục **Quản lý bảo vệ**, chọn **Tất cả nhân viên** hoặc một chi nhánh trong **Phạm vi đối soát**. Khi lọc theo chi nhánh, chỉ những nhân viên đã gán vào chi nhánh đó mới được so sánh; tên trong file chưa có trong danh sách nhân sự sẽ được thông báo và bỏ qua trong chế độ lọc chi nhánh. Xem danh sách **Chênh lệch** / **Đã khớp**, tìm kiếm, lọc và xuất báo cáo CSV.

### Cấu trúc dữ liệu được hỗ trợ

- **Bảng ngày ngang**: mỗi dòng là một nhân viên; cột ngày là `1`, `2`, ... `31`, `Ngày 1`, hoặc ngày Excel; ô có công thường ghi `X`, `C`, `1`, `8`, `12`, `24`... . Có hỗ trợ mẫu biên bản nghiệm thu dịch vụ bảo vệ: tiêu đề song ngữ "Họ và tên (Full name)" ở dòng trên, ngày 1–30 ở dòng dưới, các dòng phân nhóm 12/24 giờ và phần ký xác nhận cuối bảng.
- **Danh sách theo dòng**: mỗi dòng có cột họ tên và cột ngày/giờ (`01/09/2026`, `2026-09-01`, Excel date...). Bảng công danh sách có thể có thêm cột công/trạng thái; nếu chọn cột này, các ô trống, `0`, `N`, `P`, `nghỉ`, `vắng`... sẽ được bỏ qua. Dữ liệu chấm công cũng có thể dùng cột trạng thái nếu được phát hiện.
- Hai định dạng **không cần giống nhau**: ô `12` giờ trong bảng tổng hợp và một dòng chấm công đều được quy về một cặp nhân viên–ngày. So sánh theo **họ tên đã chuẩn hóa + ngày** trong tháng được chọn; một người chấm nhiều lần trong ngày vẫn được tính là một ngày. Hiện tại chưa so sánh số giờ, số ca, vị trí, mã nhân viên, và chưa xử lý ca xuyên nửa đêm. Hai nhân viên trùng họ tên có thể bị gộp.

> **Lưu ý:** Chưa có file Excel mẫu hay ảnh tham chiếu thực tế trong repo. Nếu file xuất của bạn có bố cục đặc biệt (tiêu đề gộp nhiều tầng, mã ca riêng, nhiều dòng trên cùng một người...), hãy cung cấp file mẫu đã ẩn dữ liệu nhạy cảm để điều chỉnh bộ đọc cho chính xác.

Hai file bảng công được đọc trong trình duyệt, **không gửi lên máy chủ** và không lưu sau khi tải lại trang. Danh sách nhân sự được lưu trên máy chủ qua Netlify Blobs và **tự động đồng bộ giữa tất cả thiết bị**. Đối với dữ liệu bảo vệ thật, nên đối chiếu kết quả với bảng gốc trước khi chốt công.
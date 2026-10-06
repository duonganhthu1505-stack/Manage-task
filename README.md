# Workly — Đối soát bảng công bảo vệ & kiểm tra payment nhà ăn

Giao diện quản lý và đối soát bảng công bảo vệ, chạy hoàn toàn ở trình duyệt. Dữ liệu minh họa được hiển thị sẵn để thử giao diện; tải **cả hai file thật** để thay thế và xem kết quả thực tế.

Từ mục **Nhà ăn → Quản lý nhà ăn → Kiểm tra payment** trong thanh bên, bạn có thể kiểm tra payment hàng tháng của nhà ăn: tải lên một file Excel gồm sheet **Pivot**, các sheet **Detail** và sheet **Payment**; hệ thống cộng gộp Detail theo từng người rồi so với **Pivot** (gốc so sánh), đồng thời so **Payment** với **Pivot**, liệt kê người **lệch số tiền** hoặc **thiếu ở một sheet**, kèm xuất báo cáo CSV.

## Chạy dự án

```bash
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trên terminal. Kiểm tra bằng `npm test` và `npm run build`.

## Cách dùng

1. Chọn **tháng đối soát** ở góc phải.
2. Tải lên **bảng công tổng hợp** và **dữ liệu chấm công** (`.xlsx` hoặc `.csv`, tối đa 15 MB/file). Có thể nhấn để chọn hoặc kéo thả file.
3. Hệ thống tự đọc trang tính đầu tiên và tìm cột họ tên, ngày, công/trạng thái. Nếu cấu trúc file khác, mở **Cấu hình cột dữ liệu** ở dưới từng file để chọn trang tính, dòng tiêu đề, kiểu bảng và cột tương ứng. Bảng **Xem trước dữ liệu trong file** đánh dấu cột họ tên/ngày đang chọn; hãy tránh chọn `Employee ID` thay cho `Name`. Với bảng công có phần ký xác nhận ở cuối, chọn **Cuối bảng** để xem và dùng **Dòng cuối nhân viên** nếu cần giới hạn phạm vi nhân viên. Nếu ngày trong file khác tháng đang chọn, hệ thống sẽ báo tháng thực tế đọc được.
4. Mở mục **Nhân sự** ở thanh bên để thêm họ tên bảo vệ và **chi nhánh / nơi làm việc**. Bạn có thể tự đặt tên chi nhánh, sửa hoặc xóa nhân sự; chi nhánh tự hình thành từ nơi làm việc đã gán. Danh sách nhân sự được lưu trên trình duyệt của thiết bị này.
5. Ở mục **Quản lý bảo vệ**, chọn **Tất cả nhân viên** hoặc một chi nhánh trong **Phạm vi đối soát**. Khi lọc theo chi nhánh, chỉ những nhân viên đã gán vào chi nhánh đó mới được so sánh; tên trong file chưa có trong danh sách nhân sự sẽ được thông báo và bỏ qua trong chế độ lọc chi nhánh. Xem danh sách **Chênh lệch** / **Đã khớp**, tìm kiếm, lọc và xuất báo cáo CSV.

### Cấu trúc dữ liệu được hỗ trợ

- **Bảng ngày ngang**: mỗi dòng là một nhân viên; cột ngày là `1`, `2`, ... `31`, `Ngày 1`, hoặc ngày Excel; ô có công thường ghi `X`, `C`, `1`, `8`, `12`, `24`... . Có hỗ trợ mẫu biên bản nghiệm thu dịch vụ bảo vệ: tiêu đề song ngữ "Họ và tên (Full name)" ở dòng trên, ngày 1–30 ở dòng dưới, các dòng phân nhóm 12/24 giờ và phần ký xác nhận cuối bảng.
- **Danh sách theo dòng**: mỗi dòng có cột họ tên và cột ngày/giờ (`01/09/2026`, `2026-09-01`, Excel date...). Bảng công danh sách có thể có thêm cột công/trạng thái; nếu chọn cột này, các ô trống, `0`, `N`, `P`, `nghỉ`, `vắng`... sẽ được bỏ qua. Dữ liệu chấm công cũng có thể dùng cột trạng thái nếu được phát hiện.
- Hai định dạng **không cần giống nhau**: ô `12` giờ trong bảng tổng hợp và một dòng chấm công đều được quy về một cặp nhân viên–ngày. So sánh theo **họ tên đã chuẩn hóa + ngày** trong tháng được chọn; một người chấm nhiều lần trong ngày vẫn được tính là một ngày. Hiện tại chưa so sánh số giờ, số ca, vị trí, mã nhân viên, và chưa xử lý ca xuyên nửa đêm. Hai nhân viên trùng họ tên có thể bị gộp.

> **Lưu ý:** Chưa có file Excel mẫu hay ảnh tham chiếu thực tế trong repo. Nếu file xuất của bạn có bố cục đặc biệt (tiêu đề gộp nhiều tầng, mã ca riêng, nhiều dòng trên cùng một người...), hãy cung cấp file mẫu đã ẩn dữ liệu nhạy cảm để điều chỉnh bộ đọc cho chính xác.

## Kiểm tra payment nhà ăn (hàng tháng)

1. Mở mục **Nhà ăn → Quản lý nhà ăn → Kiểm tra payment** ở thanh bên, chọn **tháng kiểm tra**.
2. Tải lên file Excel của tháng (`.xlsx`, tối đa 15 MB). Các sheet có tên chứa *pivot / tổng hợp*, *detail / chi tiết*, *payment / thanh toán* được tự gán vai trò; có thể đổi vai trò của từng sheet (hỗ trợ **nhiều sheet Detail** — được cộng gộp theo từng người).
3. Mỗi sheet tự nhận diện dòng tiêu đề, cột họ tên và cột số tiền. Mở nút cấu hình bên phải sheet để chỉnh lại nếu file có bố cục khác (xem trước 6 dòng đầu sau khi đọc).
4. **Pivot là gốc để so sánh**: Detail cộng lại phải khớp Pivot, Payment phải khớp Pivot. Kết quả hiển thị tổng tiền từng nguồn, số người **đã khớp / lệch số tiền / thiếu ở một sheet** (người không có ở một sheet chỉ được ghi chú, không tính là lệch tiền). Đặt **sai số cho phép** nếu muốn bỏ qua lệch nhỏ do làm tròn. Xuất báo cáo CSV bằng nút **Xuất báo cáo**.

Quy ước đọc file payment: dòng *Tổng cộng / Grand Total / chữ ký* được bỏ qua; số tiền chấp nhận định dạng `1234567`, `1.234.567`, `1,234,567`, `1.234.567,89`, `3.500.000 đ`; ghép nhân viên theo họ tên đã chuẩn hóa (không phân biệt dấu). File chỉ được xử lý trong trình duyệt, không gửi lên máy chủ.

Hai file bảng công được đọc trong trình duyệt, **không gửi lên máy chủ** và không lưu sau khi tải lại trang. Danh sách nhân sự và chi nhánh được lưu trong bộ nhớ lưu trữ cục bộ của trình duyệt để giữ lại sau khi đóng / tải lại trang; dữ liệu này không đồng bộ sang thiết bị khác. Đối với dữ liệu bảo vệ thật, nên đối chiếu kết quả với bảng gốc trước khi chốt công.

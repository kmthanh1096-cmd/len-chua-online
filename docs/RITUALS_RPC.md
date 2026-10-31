# Lên Chùa Online — Nghi lễ tương tác và JSON-RPC v1

Đợt phát triển độc lập, lấy ý tưởng giao thức/luồng nghi lễ từ một dự án tham khảo,
**không sao chép mã nguồn hoặc tài nguyên không có giấy phép của dự án đó**.
Giữ nguyên bản chánh điện web tĩnh, giao diện livestream 9:16, bồ đoàn 24–100,
kết nối TikTok và giọng Edge TTS.

## Chạy

Node.js >= 20; từ thư mục live: npm ci && npm test && npm start.

- Bảng điều khiển: http://localhost:3000/live/control.html
- Overlay OBS: http://localhost:3000/live/overlay.html (1080x1920).
- Người xem bình luận để vào chánh điện; các câu lệnh có thể kích hoạt nghi lễ.
- Bảng điều khiển có nhóm nút thử nghi lễ với tên/lời cầu nguyện.

## Các nghi lễ mới

- temple.burnIncense — dâng 1–3 nén hương
- temple.bow — đảnh lễ Tam Bái, 3 lần
- temple.sendPrayer — hoa đăng kèm lời cầu nguyện ngắn
- temple.ringBell — thỉnh chuông
- temple.strikeWoodenFish — gõ mõ (tối đa 3 lần/lệnh)
- temple.drawFortune — **lời quán chiếu**, không tiên đoán tương lai
- temple.offerLotus — dâng hoa sen

Bình luận nhận diện tiếng Việt có và không dấu: "thắp hương", "lạy Phật",
"cầu cho", "xin xăm", "thỉnh chuông", "gõ mõ". Giới hạn 6 giây/người.
Bình luận không chứa nghi lễ vẫn giữ hành vi cũ (vào ngồi, đổi hình).

## HTTP JSON-RPC 2.0 (tùy chọn, mặc định TẮT)

Server mặc định chỉ lắng nghe 127.0.0.1. Để bật API, thiết lập biến môi trường
TEMPLE_RPC_TOKEN dài tối thiểu 24 ký tự trước khi chạy npm start. Đừng commit token.
Đừng thay HOST thành 0.0.0.0 rồi expose lên Internet; cần gateway, đăng nhập
và quản trị khóa nếu muốn điều khiển từ xa.

Ví dụ PowerShell:
  $env:TEMPLE_RPC_TOKEN = 'thay-bang-token-ngau-nhien-dai-hon-24-ky-tu'

Gửi POST http://127.0.0.1:3000/rpc với headers:
  Authorization: Bearer <TEMPLE_RPC_TOKEN>
  Content-Type: application/json

JSON body:
  {"jsonrpc":"2.0","id":1,"method":"temple.burnIncense",
   "params":{"user":"Diệu Hạnh","wish":"Nguyện mọi người bình an","count":3}}

temple.getState là phương thức chỉ đọc, không chấp nhận thông tin đăng nhập
TikTok. Không cung cấp lệnh kết nối TikTok qua HTTP RPC. Không có endpoint
public cho lời khấn hoặc hồ sơ người xem. Kết nối WebSocket điều khiển giữ
phạm vi cùng origin trên localhost; OBS không Origin chỉ được đọc.

Các tổng số nghi lễ được lưu trong live/data/ritual-state.json (đã ignore Git).
Không lưu ID TikTok, tên, lời cầu nguyện trong file này. File có thể xóa để
đặt lại tổng số. Không quy đổi tiền/quà tặng thành điểm công đức tâm linh.

## Kiểm thử

npm test chạy node --test: phân tích bình luận, giữ nguyên hành vi bình luận
thường, giới hạn spam, bảo vệ API token, kiểm tra phương thức, và lưu tổng số.
GitHub Actions chạy kiểm thử ở mỗi pull request.

## Nâng cấp hoạt ảnh 2.5D (v2)

Hoạt ảnh có máy trạng thái độc lập `live/ritual-director.js`, hàng đợi tối đa 12 nghi lễ chờ, một nhân vật đang làm lễ, đi qua lối giữa đến bàn hương, thực hiện một hoặc ba lạy, rồi trở về bồ đoàn. Người thật có chỗ ngồi được ẩn tại bồ đoàn khi đi làm lễ; các lần render còn lại giữ trạng thái ghế. Hoa đăng vẽ bằng Canvas bay lên có giới hạn thời gian sống. Sự kiện TTS truyền `ritualId` để đồng bộ khởi phát/hoàn thành đọc tương ứng; không phụ thuộc vào các câu đọc kinh định kỳ. Nếu giọng đọc không bắt đầu, máy trạng thái chuyển tiếp sau 12 giây. Chưa sử dụng sprite lạy mới; chuyển động cúi lạy sử dụng phép biến đổi tỷ lệ của sprite hiện có. Kiểm thử bằng `npm test`.

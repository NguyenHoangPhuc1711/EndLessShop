# Nền tảng backend EndLessShop

Hướng dẫn mới cho GitHub Pages, CORS/cookie và Cloudflare Tunnel nằm trong
[CONNECTING.md](./CONNECTING.md). Các đoạn HTTPS/cấu trúc Git bên dưới mô tả giai đoạn
local trước đây; dùng cấu hình và cách xuất bản trong tài liệu mới khi public API.

Express và thư viện `mssql` đã kết nối SQL Server 2022 trong container `sqlserver` có sẵn.
Mở **http://localhost:3000/**; trang thanh toán là **http://localhost:3000/checkout.html**.

## Chạy trên Windows

Điều kiện: Docker Desktop đang chạy Linux Engine; container `sqlserver` đang chạy,
volume `sqlserver_data` vẫn gắn vào `/var/opt/mssql`. Không cần cài thêm Node trên máy
để chạy backend. Cổng 3000 phải còn trống.

Chạy tại thư mục gốc workspace bằng PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend.ps1
docker compose exec -T backend npm run verify
```

Script khởi động thực hiện:

1. Kiểm tra SQL container và volume hiện có; không tạo thêm SQL Server.
2. Nếu chưa có `.env`, sinh mật khẩu ngẫu nhiên riêng cho `endless_runtime`. Chỉ bổ sung cấu hình session
   còn thiếu và sinh `SESSION_SECRET` một lần; giữ nguyên các giá trị đã có để phiên tồn tại qua restart.
3. Tạo network `endlessshop_network` nếu thiếu, nối thêm SQL container vào network này.
4. Build image Express; chạy một container khởi tạo tạm thời bằng image này.
   Mật khẩu quản trị lấy trong bộ nhớ từ môi trường SQL container, truyền qua biến môi trường,
   không in ra và không ghi vào file. Container tạm tự kết thúc sau khởi tạo.
5. Chạy migration/seed rồi kiểm tra đăng nhập bằng tài khoản runtime.
6. Chạy service backend, chờ healthcheck SQL thành công.

Sau khi đã khởi tạo, có thể dùng `docker compose up -d --build --wait backend` để chạy lại
chỉ backend. `docker compose logs --tail 30 backend` xem log ứng dụng. Không dùng lệnh
xóa/reset dữ liệu để chạy thử. Nếu credential admin trong môi trường SQL container đã
khác mật khẩu SQL hiện hành thì khởi tạo sẽ báo lỗi và cần cập nhật cách xác thực quản trị;
script không tự đổi mật khẩu SQL hiện có.

## SQL gốc và thay đổi tối thiểu

Nguồn: file `Sprint 1/web_thoi_trang.sql` trong ZIP Sprint 1 do người dùng cung cấp.
Bản tham chiếu đã giải nén ở
[SQL gốc](./.reference/Sprint%201-20261101T085940Z-1-001/Sprint%201/web_thoi_trang.sql).
ZIP Sprint 0, Tổng Hợp và code mẫu cũng nằm riêng dưới `.reference/`; không chép đè frontend.
PDF bảo vệ đã được đọc, phần văn bản trích xuất nằm trong `.reference/bao-ve-extracted.txt`.
Một đường dẫn thư mục ZIP có dấu cách cuối tên đã được giữ nội dung thành
`.reference/Sprint 0-20261101T085939Z-1-001/problem-statement.docx` để đọc được trên Windows.
Các tài liệu tham chiếu này không được đưa vào Git hoặc Docker image.

SQL gốc có 6 bảng, mẫu sản phẩm ID 2 là quần jean và voucher `MOC10`; tài khoản mẫu dùng
mật khẩu rõ. Không chạy nguyên script gốc lên hệ thống thật.

- [001-database.sql](./server/db/001-database.sql): chỉ tạo `web_thoi_trang` nếu chưa tồn tại.
- [002-schema.sql](./server/db/002-schema.sql): giữ 6 bảng `DANH_MUC`, `TAI_KHOAN`,
  `SAN_PHAM`, `VOUCHER`, `HOA_DON`, `CHI_TIET_HOA_DON`; thêm cột còn thiếu.
- [003-auth.sql](./server/db/003-auth.sql): thêm bảng session SQL và thủ tục tài khoản, không reset dữ liệu.
- [init-db.js](./server/scripts/init-db.js): thực thi schema và seed trong transaction với
  khóa khởi tạo để tránh hai lượt seed chạy đồng thời. Không chèn tài khoản mẫu.
- [products.seed.json](./server/db/products.seed.json): snapshot 12 sản phẩm từ frontend hiện tại.
  ID 2 là áo sơ mi, ID 4 là quần jean. Không lấy cặp ID sai từ dữ liệu SQL mẫu.

Các cột bổ sung gồm mã danh mục, JSON size/màu/ảnh/ánh xạ màu–ảnh và cờ sản phẩm mới;
thông tin người nhận, địa chỉ, ghi chú, phương thức COD, tạm tính và tiền giảm trong hóa đơn.
Cột `mat_khau` giữ độ dài 255 và được API đăng ký dùng để lưu hash Argon2id có salt.

**Tồn kho demo: 50 đơn vị mỗi sản phẩm, tổng 600.** Tồn kho đang ở cấp sản phẩm như SQL gốc,
không phải tồn kho riêng cho từng size/màu. Chưa triển khai bảng tồn kho biến thể.
Voucher seed: `ENDLESS10` = `percent/10`, `FREESHIP` = `fixed/30000`, chưa đặt hạn hết hạn
để phù hợp frontend hiện tại. `fixed` là cách SQL gốc biểu diễn khoản giảm cố định.

Chạy lại không đặt lại giá/tồn kho, không xóa tài khoản/đơn hàng, chỉ chèn bản ghi còn thiếu
và điền metadata NULL. Nếu gặp cùng ID nhưng sản phẩm/danh mục khác, hoặc voucher khác
định nghĩa, script dừng và rollback phần schema/seed thay vì đổi ID hay ghi đè dữ liệu.
Không tự xóa mã voucher cũ nếu có sẵn trong database khác.

## API và quyền truy cập

| Endpoint | Kết quả |
|---|---|
| `GET /api/health` | HTTP 200 sau `SELECT 1, DB_NAME()`; HTTP 503 nếu SQL không sẵn sàng |
| `GET /api/products` | Mảng sản phẩm đọc từ SQL, đúng tên trường frontend, thêm `stock` |

[db.js](./server/src/db.js) kết nối bằng hostname `sqlserver` qua network Docker,
không dùng localhost để trỏ tới SQL từ backend. Runtime user `endless_runtime` được SELECT
hai bảng sản phẩm/danh mục, EXECUTE ba thủ tục tài khoản, ba thủ tục COD và CRUD bảng session.
Không cấp SELECT/UPDATE trực tiếp bảng tài khoản, không cấp quyền ghi đơn hoặc sửa giá,
không dùng `sa` hoặc `db_owner` cho ứng dụng.

SQL dùng TLS, chấp nhận chứng chỉ tự ký của container local. Cổng backend và SQL chỉ bind
vào loopback Windows. `.env` chứa duy nhất cấu hình runtime, được loại khỏi Git/image;
[.env.example](./.env.example) không có bí mật thật. Không dùng `docker compose config`
hoặc in toàn bộ `docker inspect` để chia sẻ vì có thể lộ môi trường chứa mật khẩu.

Express chỉ phục vụ ba trang HTML (trang chủ, checkout, tài khoản) và `/css`, `/js`, `/img` đã chỉ định.
Không phục vụ workspace root, SQL, cấu hình, tài liệu hoặc `.env`.

## Kiểm chứng và giới hạn

[verify.js](./server/scripts/verify.js) kiểm tra API SQL, ánh xạ đủ sản phẩm so với frontend,
HTML, CSS, JS, ảnh, 404 với đường dẫn riêng tư và quyền hạn tài khoản runtime. Các kiểm tra
không tạo/xóa/reset dữ liệu để test.

Ở bước nền tảng đã chạy khởi tạo hai lần: 6 bảng, 4 danh mục, 12 sản phẩm, tổng tồn
kho 600, 2 voucher, 0 tài khoản/đơn hàng; checksum sản phẩm không đổi.
Đã kiểm tra 44 URL tài nguyên nội bộ qua HTTP; trang chủ mở được trong trình duyệt.
Không coi đây là bằng chứng kiểm thử mọi schema/database cũ hoặc mọi luồng nghiệp vụ.

Danh mục đọc `/api/products`; giỏ/wishlist vẫn ở localStorage. Tài khoản, session, đơn COD và lịch sử
đã dùng API/SQL. Không lưu mật khẩu/token phiên vào localStorage; không nhập `moc_orders` cũ thành
đơn thật. Chưa có thanh toán online/email/admin. Bố cục cửa hàng được giữ.

Không push Git, không thay đổi GitHub Pages và không triển khai backend lên mạng.

## Đăng ký, đăng nhập và đăng xuất

Vào **http://localhost:3000/account.html** hoặc chọn **Tài khoản** trên thanh điều hướng.
Điền form tạo tài khoản, sau đó đăng nhập bằng tên đăng nhập và mật khẩu đã chọn.
Tên đăng nhập: 3–50 chữ không dấu/số/`_ . -`; họ tên tối đa 100, email tối đa 100;
điện thoại là 9–11 chữ số nếu có. Mật khẩu 10–128 ký tự, không chỉ gồm khoảng trắng.
Server chỉ trim tên/email/thông tin liên hệ; **không trim hoặc normalize mật khẩu**.
Giỏ hàng được giữ nguyên khi đăng nhập/đăng xuất.

| Endpoint thật | Request / kết quả |
|---|---|
| `GET /api/auth/csrf` | Nhận `csrfToken`; cookie phiên được đặt HttpOnly |
| `POST /api/auth/register` | JSON `{username,password,fullName,email,phone?}`; 201 hoặc 400/409/429 |
| `POST /api/auth/login` | JSON `{username,password}`; 200 `{user,csrfToken}` hoặc 401/429 |
| `GET /api/auth/me` | 200 `{user}` khi có phiên; 401 `{user:null}` khi chưa đăng nhập/hết phiên |
| `POST /api/auth/logout` | 200, xóa phiên SQL và cookie |

Mọi POST phải gửi cookie và header `X-CSRF-Token` lấy từ `/csrf` hoặc lần login vừa thành công.
Thiếu/sai token hoặc Origin không thuộc allowlist nhận 403. Login xoay cả SID và token CSRF.
Đăng ký không tự đăng nhập; luôn tạo `khach_hang` ngay trong thủ tục SQL, bỏ qua role/userId client gửi.
Các API chỉ trả thông tin hồ sơ, không trả hash. Mật khẩu rõ/tài khoản mẫu cũ không được tự nhập
hoặc tự chuyển đổi thành tài khoản thật; chỉ hash Argon2id hợp lệ mới đăng nhập được.

[auth.js](./server/src/auth.js) dùng [node-argon2](https://github.com/ranisalt/node-argon2):
Argon2id, 64 MiB, timeCost 3, parallelism 1, salt ngẫu nhiên cho mỗi hash.
SQL được gọi bằng tham số và stored procedure; không nối dữ liệu người dùng vào câu SQL.

[express-session](https://expressjs.com/en/resources/middleware/session/) ký cookie `endless.sid`;
[session-store.js](./server/src/session-store.js) lưu phiên trong `AUTH_SESSION` với khóa SHA-256 của SID.
Dữ liệu phiên chỉ gồm ID tài khoản, token CSRF, thời điểm hết hạn và metadata cookie; không có mật khẩu/hash.
Thời hạn tuyệt đối 2 giờ kể từ tạo phiên/login; truy cập thông thường không kéo dài thời hạn SQL.
Phiên hết hạn không được xác thực; dọn các hàng session hết hạn mỗi 15 phút.
Logout xóa hàng session; cookie cũ không dùng lại được. Không có MemoryStore dự phòng.

Cookie luôn `HttpOnly`, `SameSite=Lax`, `Path=/`. Local HTTP dùng `SESSION_COOKIE_SECURE=false`,
`TRUST_PROXY=0`, APP_ORIGINS chứa localhost/127.0.0.1. Khi đặt sau **một reverse proxy HTTPS tin cậy**,
đổi thành `SESSION_COOKIE_SECURE=true`, `TRUST_PROXY=1`, `APP_ORIGINS=https://ten-mien-thuc-te` rồi recreate backend.
Không bật trust proxy trên máy chủ HTTP công khai trực tiếp; đây chưa phải bước triển khai HTTPS/hosting.
`SESSION_SECRET` phải giữ nguyên để cookie đã ký còn hợp lệ sau restart; không đưa secret vào frontend/Git/image.

[express-rate-limit](https://express-rate-limit.mintlify.app/quickstart/usage) giới hạn login sai 10 lần/IP/15 phút,
lần tiếp theo nhận 429 với Retry-After; đăng ký 10 lần/IP/giờ; auth API 100 lần/IP/15 phút.
Counter rate-limit nằm trong RAM của một backend và reset khi restart; session/tài khoản nằm trong SQL.
Chưa thiết kế giới hạn phân tán cho nhiều backend trong phạm vi đồ án local này.

### Kiểm thử và chạy lại

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend.ps1
docker compose exec -T backend npm run verify
node server/scripts/verify-auth.js
docker compose exec -T backend node scripts/verify-https-config.js
```

Lệnh `verify-auth.js` chạy trên máy Windows có Node (đã có), tạo 2 tài khoản demo tên bắt đầu
`demo_auth_` và `demo_salt_`, email `example.invalid`, mật khẩu ngẫu nhiên không in/lưu ra file.
Script giữ lại dữ liệu demo, không reset DB, và restart **chỉ backend** để kiểm chứng lưu bền tài khoản/session.
Test giao diện tạo thêm tài khoản `demo_ui_` và giữ lại; không đặt đơn hoặc trừ tồn kho.

Đã kiểm thử thực tế: đăng ký lưu hash/salt SQL, trùng tên/email, dữ liệu sai, mật khẩu đúng/sai
và giữ dấu cách, giả vai trò/userId, đổi SID và thu hồi SID trước login, `/me`, CSRF thiếu/sai/Origin lạ,
throttle 429, restart giữ tài khoản/session, logout làm cookie cũ vô hiệu, runtime không có quyền admin.
Đã chạy form đăng ký/login, reload, hiển thị người dùng, logout và giữ nguyên giỏ trong trình duyệt;
form có trạng thái đang gửi, báo lỗi và mở lại nút sau lỗi.
Cookie Secure có bài test mô phỏng reverse proxy HTTPS; **chưa kiểm thử HTTPS/TLS thực tế**.
Chưa chờ thực tế 2 giờ: đã kiểm tra thời hạn SQL/cookie và cơ chế từ chối phiên hết hạn trong code.

SSMS: kiểm tra tài khoản mà không hiển thị mật khẩu/hash:

```sql
USE web_thoi_trang;
SELECT tai_khoan_id, ten_dang_nhap, ho_ten, email, sdt, vai_tro
FROM dbo.TAI_KHOAN
ORDER BY tai_khoan_id DESC;
```

## Frontend dùng danh mục từ API

`GET /api/products` thực tế trả array với `id`, `name`, `category`, `price`, `stock`, `sizes`,
`colors`, `images`, `colorImageIndices`, `description`, `isNew`. Đã đối chiếu đủ trường với SQL;
không cần đổi schema, quyền runtime, mô hình tồn kho hay API đăng nhập trong bước này.

| Dữ liệu | Nguồn hiện tại |
|---|---|
| ID/tên/giá/danh mục/size/màu/ảnh/mô tả/nhãn mới/tồn kho | SQL → `/api/products` cùng origin |
| Quy tắc phối đồ và bảng hướng dẫn size | `js/products.js`, chỉ còn cấu hình; bỏ qua ID không có trong API |
| Giỏ và wishlist | localStorage, đối chiếu lại danh mục SQL sau khi tải API thành công |
| Voucher và tổng thanh toán ở checkout | SQL qua API quote/create; ước tính trong drawer trang chủ chưa phải giá xác nhận |
| Đơn COD/lịch sử checkout | SQL theo tài khoản trong session; bỏ qua hoàn toàn `moc_orders` cũ |
| Tài khoản và session | API đăng nhập/SQL, cookie HttpOnly như bước trước |

[catalog.js](./web-ban-quan-ao/js/catalog.js) kiểm tra cấu trúc JSON, ID trùng, giá/số lượng,
ảnh cùng origin dưới `/img/` và ánh xạ màu–ảnh. Không chấp nhận URL `javascript:`, ảnh ngoài origin,
hoặc payload thiếu trường bắt buộc. [app.js](./web-ban-quan-ao/js/app.js) chỉ dựng bộ lọc, thẻ,
modal và gợi ý sau khi fetch thành công; khóa thao tác trong lúc tải, báo lỗi/thử lại nếu fetch lỗi
hoặc JSON sai. Không có mảng sản phẩm dự phòng. HTML động được escape, thông báo dùng textContent.

`products.seed.json` chỉ là fixture/seed phía server; frontend không nạp file này.
`verify.js` dùng fixture để kiểm tra dữ liệu mẫu kỳ vọng, không dùng nó làm nguồn hiển thị.
Nếu bạn chủ động sửa dữ liệu DB sau này, cần cập nhật kỳ vọng kiểm thử tương ứng.

Giỏ cũ được kiểm tra ID, size, màu và số lượng nguyên 1–999. Dòng legacy chưa có dấu phiên bản
phải khớp cả tên với ID hiện tại; ID 2 tên quần jean không được biến thành áo sơ mi.
Dòng không xác minh được bị bỏ qua, lưu lại giỏ đã làm sạch và hiện cảnh báo rõ ràng.
Dòng hợp lệ được cập nhật tên/giá/ảnh từ API; marker `catalogSource: sql-v1` cho phép giữ cùng ID
khi sản phẩm SQL được đổi tên ở những lần tải sau. Marker chỉ phục vụ tương thích cache local,
không phải bằng chứng tin cậy cho việc tính tiền/đặt hàng trên server.
Wishlist lọc ID tồn tại và loại trùng. API lỗi không ghi đè giỏ/wishlist đang lưu.
JSON localStorage hỏng/sai kiểu hoặc storage bị chặn không làm script dừng; giao diện báo cảnh báo.

Checkout đối chiếu giỏ với API, yêu cầu đăng nhập và nhận tổng tiền từ SQL. Nếu API lỗi thì giữ giỏ
và cho thử lại; không tạo đơn local. Lịch sử chỉ đọc SQL của tài khoản hiện tại, không đọc dữ liệu
đơn mô phỏng cũ. Tên/ảnh/giá tại thời điểm mua được lưu trong chi tiết đơn.

### Kiểm thử danh mục đã thực hiện

```powershell
node server/scripts/verify-catalog.js
docker compose exec -T backend npm run verify
```

Đã kiểm thử trình duyệt: 12 sản phẩm, tìm kiếm không dấu/gợi ý, lọc kết hợp danh mục/size/màu/giá,
sắp xếp, rỗng kết quả, modal, đổi ảnh theo màu, bảng size, phối đồ, thêm/tăng số lượng giỏ,
wishlist, tải lại giữ dữ liệu, giỏ cũ ID lệch, JSON giỏ/wishlist/đơn bị hỏng.
Đăng ký/login/reload/logout được chạy lại với một tài khoản demo `demo_catalog_` giữ trong SQL;
giỏ không đổi khi đăng nhập/đăng xuất. Các test storage chạy trong context trình duyệt riêng,
không ghi đè dữ liệu của tab người dùng.

Đã dừng **chỉ backend** để tạo lỗi `ERR_CONNECTION_REFUSED` thật: frontend hiện lỗi, 0 thẻ sản phẩm,
khóa bộ lọc, hiện nút thử lại, giữ nguyên giỏ đã lưu. Khởi động backend và thử lại tải đủ 12 sản phẩm.
Đã giữ phản hồi API chờ trong context test để xác minh trạng thái tải trước khi dựng bộ lọc.

Phép chứng minh nguồn SQL: [test-catalog-database.ps1](./scripts/test-catalog-database.ps1) đổi tạm
chỉ tên/giá ID 1, sao lưu giá trị gốc dưới `.reference/`, rồi kiểm tra card/modal nhận tên marker
và giá `189123` từ API. Tên có chuỗi HTML được hiển thị dưới dạng văn bản, không sinh thẻ mới.
Đã chạy `Restore`, tải lại trang để giỏ cũng nhận lại giá/tên thật; tên/giá gốc và checksum toàn bộ
sản phẩm đã được kiểm tra lại. Không giữ giá trị test trong database.
Script chỉ dành cho phép thử có kiểm soát; luôn chạy Restore kể cả bước quan sát trình duyệt lỗi:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-catalog-database.ps1 -Phase Set
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-catalog-database.ps1 -Phase Restore
```

Chưa kiểm thử mọi trình duyệt/thiết bị hoặc tải đồng thời lớn. Tồn kho vẫn là dữ liệu demo
theo sản phẩm; bước COD bên dưới đã kiểm tra lại kho/giá bằng transaction SQL.

## Đặt COD thật và lịch sử đơn hàng

### File và migration

- [004-orders.sql](./server/db/004-orders.sql) là migration bổ sung an toàn, chạy lại qua script
  khởi động hiện có. Không tạo lại bảng hoặc reset bản ghi.
- `HOA_DON` thêm `ma_don` tính từ identity (`ENDLESS-<hoa_don_id>`), `idempotency_key`,
  `request_hash`, `ma_voucher`. Unique index cho mã đơn và `(khach_hang_id,idempotency_key)` khi key khác NULL.
- `CHI_TIET_HOA_DON` thêm `ten_sp`, `anh_sp` để giữ snapshot; tiếp tục dùng `don_gia` để giữ giá mua.
- [orders.js](./server/src/orders.js) xác thực session, kiểm tra request và gọi ba thủ tục SQL:
  `order_checkout`, `order_list`, `order_get`. [auth.js](./server/src/auth.js) dùng lại session/CSRF cho
  các API; session SQL, cookie và cơ chế login/logout được giữ nguyên.
- [checkout.js](./web-ban-quan-ao/js/checkout.js) gọi API thật; HTML chỉ cho chọn COD.
  [account.js](./web-ban-quan-ao/js/account.js) phát sự kiện khi trạng thái tài khoản thay đổi để
  checkout xóa thông tin đơn đang hiển thị sau logout.
- Runtime chỉ có quyền EXECUTE các thủ tục COD, không được INSERT/UPDATE trực tiếp hóa đơn,
  chi tiết, voucher hoặc tồn kho; vẫn không phải `sa`/`db_owner`.

### Endpoint thật

Tất cả endpoint đơn yêu cầu session còn hiệu lực. Các POST còn cần `X-CSRF-Token` và Origin hợp lệ.

| Endpoint | Công dụng |
|---|---|
| `POST /api/orders/quote` | Kiểm tra giỏ, giá/kho/voucher trong SQL, trả tạm tính/giảm/tổng và sản phẩm; không giữ chỗ hoặc trừ kho |
| `POST /api/orders` | Tạo đơn COD bằng header `Idempotency-Key` UUID; 201 khi mới, 200 khi trả lại đơn đã lưu |
| `GET /api/orders` | 100 đơn gần nhất của tài khoản hiện tại |
| `GET /api/orders/:id` | Chi tiết đơn sở hữu; đơn người khác/không có đều trả 404 |
| `GET /api/orders/requests/:key` | Tìm lại đơn theo khóa yêu cầu của chính tài khoản, phục hồi sau mất phản hồi |

Request tạo đơn: `items: [{id,size,color,qty}]`, `voucherCode` hoặc null, `payment: "cod"`,
`delivery: {fullName,phone,address,note}`. Backend bỏ qua mọi userId/giá/tiền giảm/tổng/trạng thái client gửi.
Account ID luôn lấy từ session đã được tra lại bằng `auth_profile`; SQL cũng kiểm tra tài khoản tồn tại.
Tên/địa chỉ được trim và phải khác rỗng; điện thoại 9–11 chữ số; note tối đa 1000 ký tự.
Tối đa 50 dòng, 1–999 đơn vị mỗi biến thể sau gộp dòng trùng. Tiền đồng nguyên, giới hạn tổng đơn
2.147.483.647đ theo cột INT có sẵn; không tự mở rộng kiểu tiền trong bước này.

### Transaction, tồn kho và voucher

`order_checkout` dùng cùng code tính tiền cho quote và create. Khi create:

1. Khóa `sp_getapplock` theo tài khoản + request key; nếu đã có đơn cùng hash thì trả đơn cũ;
   cùng key nhưng payload khác nhận 409. Hash SHA-256 được tính trên payload đã chuẩn hóa phía server.
2. Gộp lượng mua theo **sản phẩm**, lấy khóa `UPDLOCK,HOLDLOCK` theo ID tăng dần và giữ tới commit.
   M và L cùng sản phẩm cùng trừ một kho, không có kho riêng theo biến thể.
3. Kiểm tra size/màu theo JSON trong DB (so sánh cả nội dung và độ dài), giá đọc từ DB.
4. Tra voucher và hạn dùng theo đồng hồ SQL Server. `ENDLESS10` giảm 10%; `FREESHIP` là `fixed/30000`
   trừ thẳng tiền hàng, tối thiểu 0; không có phí vận chuyển riêng. Tổng phần trăm làm tròn tới đồng,
   tiền giảm bằng tạm tính trừ tổng. Voucher NULL hạn dùng nghĩa là không hết hạn.
5. INSERT hóa đơn, UPDATE kho, INSERT chi tiết snapshot trong cùng transaction. Có lỗi thì rollback
   cả ba; mã đơn do SQL cấp và unique. Quote không giữ kho tới lúc người dùng đặt.

Frontend chỉ xóa giỏ/voucher sau khi nhận được đơn hợp lệ từ server. Lỗi giữ giỏ và thông báo;
không bao giờ quay về ghi `moc_orders`. Khóa UUID + hash payload/hash giỏ + owner ID được giữ trong
**sessionStorage**, không có mật khẩu, cookie phiên hoặc địa chỉ dạng rõ trong bản ghi pending này.
Retry cùng nội dung dùng lại key; tải lại trang sẽ hỏi endpoint recovery trước khi quote để tránh
tạo lại đơn đã commit nhưng mất phản hồi. Nếu giỏ đã thay đổi thì không xóa giỏ mới khi phục hồi đơn cũ.
Đây là idempotency theo khóa yêu cầu, không cấm người dùng cố ý tạo đơn mới bằng một khóa mới.

### Kiểm thử thực tế và dữ liệu test

Chạy từ thư mục gốc repository:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
docker compose exec -T backend npm run verify
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-orders.ps1
```

[test-orders.ps1](./scripts/test-orders.ps1) chạy test HTTP thật qua backend runtime. Quyền admin
chỉ dùng trong container test tạm để tạo/dọn fixture và gây một lỗi constraint có kiểm soát;
không đổi quyền của ứng dụng. Mật khẩu lấy trong bộ nhớ, không in vào log, không ghi ra file.
[verify-orders.js](./server/scripts/verify-orders.js) tạo sản phẩm/tài khoản/voucher có nhãn run riêng
`COD-TEST:<run>`, không mua sản phẩm sẵn có. Cuối test chỉ dọn các bản ghi mới đúng tên + nhãn +
email demo; không xóa dữ liệu người dùng hoặc reset identity. Mã đơn/ID có thể có khoảng trống sau test/rollback.

Đã kiểm chứng qua HTTP + SELECT SQL:

- COD thành công: đúng tiền, đủ dòng chi tiết, đúng chủ tài khoản và mức giảm kho theo sản phẩm.
- Giá/tổng/discount/status/userId giả bị bỏ qua; guest 401, CSRF thiếu 403.
- Số lượng âm/thập phân/quá kho; size/màu sai (kể cả dấu cách thừa); người nhận/địa chỉ/điện thoại/COD sai;
  voucher sai/hết hạn đều bị từ chối; fixed discount không làm tổng âm.
- Dòng M/L cùng sản phẩm được cộng để từ chối vượt tổng kho.
- Chủ khác không xem được list/detail/recovery; gửi lại và hai request cùng key chỉ tạo/trừ một lần.
- Hai request mua đơn vị cuối: một 201, một 409, kho bằng 0, không âm.
- Thêm constraint tạm **chỉ chặn sản phẩm test** tại bước ghi chi tiết: lỗi SQL xảy ra sau INSERT
  hóa đơn và UPDATE kho; đã kiểm tra cả parent/chi tiết/kho rollback, rồi gỡ constraint test.
- Giao diện đăng nhập/quote/voucher/COD thành công, báo lỗi giữ giỏ, tổng xác nhận từ SQL,
  chỉ xóa giỏ sau thành công; lịch sử/chi tiết từ SQL và logout xóa thông tin riêng tư trên trang.
- `moc_orders` giả trong context kiểm thử không được hiển thị, thay đổi hoặc nhập thành đơn thật.
- Đã mô phỏng mất phản hồi ở trình duyệt **sau khi POST thật đã commit**: giỏ và pending key được giữ,
  reload phục hồi đúng đơn từ SQL, chỉ xóa giỏ sau xác nhận; tài khoản đó vẫn chỉ có một đơn.
- Kết thúc test: 12 sản phẩm cũ, tổng kho 600, checksum `-1854536253`, 4 tài khoản cũ và 0 đơn cũ
  giữ nguyên; không còn sản phẩm/constraint test. Vì đã dọn đơn thử, SSMS chỉ thấy đơn bạn tự tạo sau đó.

Tùy chọn `-WithBrowser` giữ fixture tối đa 180 giây để kiểm thử trình duyệt; bộ điều khiển ghi
`done.flag` trong thư mục `.reference/cod-test-<run>` được in đầu test để cho phép dọn fixture.
Báo cáo chỉ chứa tên kiểm thử, run ID và trạng thái, không chứa mật khẩu/cookie hoặc dữ liệu người dùng.
Chưa kiểm thử tải lớn/nhiều replica, mọi trình duyệt/thiết bị hoặc HTTPS thực tế. Không có admin,
thanh toán online, email hay tồn kho riêng theo size/màu trong phạm vi này.

### SELECT kiểm tra tại SSMS

```sql
USE web_thoi_trang;
SELECT hoa_don_id, ma_don, khach_hang_id, ngay_dat, trang_thai,
       phuong_thuc_thanh_toan, tam_tinh, tien_giam, tong_tien, ma_voucher
FROM dbo.HOA_DON ORDER BY hoa_don_id DESC;
SELECT d.chi_tiet_id, h.ma_don, d.san_pham_id, d.ten_sp,
       d.size, d.mau, d.so_luong, d.don_gia,
       CONVERT(BIGINT,d.so_luong)*d.don_gia AS thanh_tien
FROM dbo.CHI_TIET_HOA_DON d JOIN dbo.HOA_DON h ON h.hoa_don_id=d.hoa_don_id
ORDER BY d.hoa_don_id DESC, d.chi_tiet_id;
SELECT san_pham_id, ten_sp, gia, ton_kho
FROM dbo.SAN_PHAM ORDER BY san_pham_id;
```

## Chuẩn bị Git và giữ nguyên GitHub Pages

Mã nguồn cần version gồm frontend trong `web-ban-quan-ao/`, toàn bộ ảnh đang dùng trong `img/`,
backend trong `server/` (package/lockfile, schema/migration, seed sản phẩm và code kiểm thử),
script PowerShell, Dockerfile/Compose, hướng dẫn này và `.env.example` chỉ có giá trị mẫu.
Không đưa `.env`, `.reference/`, node_modules, log/cache, dữ liệu tài khoản/đơn/session hoặc
file backup/data SQL Server vào Git. Không ignore toàn bộ `.sql`: migration cần đi cùng mã nguồn.
Các script test sinh mật khẩu ngẫu nhiên trong bộ nhớ và dùng tài khoản/email/demo có đánh dấu;
không chứa export tài khoản hoặc đơn thật. Thông tin liên hệ footer là nội dung giao diện công khai,
không phải bản ghi tài khoản đăng nhập.

Tại lần rà soát này nhánh local `main` chưa có commit và chưa có remote. Git có các checkpoint
nội bộ của công cụ, tách khỏi lịch sử nhánh `main`. Không đưa các ref checkpoint lên GitHub bằng
`--mirror` hoặc `--all`. Không force push lịch sử local mới lên `main` của repository đã tồn tại.

Repository GitHub hiện có frontend ở gốc (`index.html`, `css/`, `js/`, `img/`), khác cấu trúc local
đang được Dockerfile dùng. Frontend local gọi `/api/...`, nên GitHub Pages tĩnh không thể chạy
đăng nhập/đặt COD hoặc cấp sản phẩm SQL. Việc chọn/stage file không thay đổi hosting; không di chuyển,
chép đè hoặc tạo bản frontend khác trong bước này. Giữ tất cả ảnh cần thiết ở `img/`.
Nếu muốn sao lưu bản đầy đủ lên GitHub, dùng một nhánh backend riêng; giữ nhánh Pages hiện tại.
Việc hợp nhất hai lịch sử/cấu trúc cần được người dùng xem xét riêng trước khi cập nhật `main`.

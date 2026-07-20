# Web Station 部署說明

這份專案可直接部署到 Synology Web Station，並**共用既有 Supabase** 作為資料庫。

## 需要的環境變數

請在 Web Station 的站台環境或前端建置環境提供：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FACE_MODEL_URL`（可選；預設會使用外部模型來源）

## 建置

```bash
npm install
npm run build
```

建置完成後，`dist/` 就是 Web Station 要發佈的靜態站台內容。

## Web Station 建議設定

1. 建立一個新的網站根目錄
2. 將 `dist/` 內容上傳到該站台目錄
3. 若使用 Apache，確認已啟用 `.htaccess`
4. 若使用 Nginx，需設定 SPA rewrite，讓所有路由回到 `index.html`

## SPA 路由說明

這個專案使用 `BrowserRouter`，因此以下路徑都需要伺服器重寫：

- `/`
- `/face`
- `/admin/*`
- `/employee/*`

Apache 可使用 `public/.htaccess` 的 rewrite 規則。

## Supabase 共用方式

此版本**不新增資料庫**，直接共用既有 Supabase：

- 原表：`employees`、`attendance_logs`
- 新表：`face_employee_profiles`、`face_attendance_logs`

請先在 Supabase 執行：

```sql
-- 使用 supabase/face_attendance_schema.sql
```

## 部署後驗證

- 開啟首頁 `/`
- 開啟掃臉頁 `/face`
- 確認可讀取 Supabase 資料
- 確認人臉建檔與掃臉打卡可寫入新表
- 確認原本打卡資料表未被修改

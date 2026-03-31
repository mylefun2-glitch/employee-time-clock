-- 為辦公地點資料表增加「信任 IP」欄位
-- 此欄位用於儲存公司固定對外 IP，以支援筆電用戶的網路定位驗證
ALTER TABLE company_locations 
ADD COLUMN IF NOT EXISTS trusted_ips text[] DEFAULT '{}';

-- 註解說明欄位用途
COMMENT ON COLUMN company_locations.trusted_ips IS '可信任的 IP 清單，用於筆電網路定位認證';

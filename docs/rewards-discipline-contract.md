# 員工獎懲管理：backend contract v1（staged，未套用）

只新增獨立模組；不改 employees、出勤、午間值班、薪資或登入。此文件與 `types/rewardsDiscipline.ts` 是 UI 接線契約。所有範例必須使用虛構資料；正式來源、識別碼、crosswalk、憑證不得放入 public repo。

## 授權與邊界

- 真實 Supabase Auth JWT → `auth.uid()` → `rewards_private.rd_admins.user_id` 明確 allowlist。表預設為空；generic authenticated、metadata role、員工 PIN、主管旗標、localStorage 均無效。
- `public.rd_permission()` 無參數，回 boolean；沒有 capability 回 false。其餘所有 RPC 未授權一律 SQLSTATE `42501`，不得把失敗呈現空資料。
- 只有下列 public RPC 授 authenticated EXECUTE；anon 不授權。業務、allowlist、原始來源、identity、audit 全在非公開 `rewards_private` schema，無 client schema/table/function grants，RLS 全開。新物件於同一 transaction 撤銷 PUBLIC/anon/authenticated/service_role 預設權限後才選擇性授權；不改既存全站 default privileges。
- SECURITY DEFINER 使用固定空 search_path、完整限定物件。服務金鑰不給前端；本模組不提供 service_role 通用繞過 RPC。DB owner 仍是可信管理邊界，RLS 不限制 owner/超級使用者。

## 共同資料語義

- UUID 僅是新模組/現行 employee 的 opaque key；絕非來源人員 ID。來源 ID 不修正、不用姓名猜配、不放 employees/movements。
- 歷史人物為獨立 subject，employee_id 可空，先全部不連結；被獎懲人與申請人都保留。經人工審核才 link，不建立/啟用現職員工。人物 label 與記錄內 label_snapshot 分開，記錄快照不因連結改名。
- `application_date` 是申請日期；年度/期間全部依此欄位。`event_date` 可空、未確認不推導。日期採 ISO Gregorian civil date `YYYY-MM-DD`，不做 timezone 轉日。import 缺日期留 null，年度 filter 不含 null；全部列表仍可見。
- `status = recorded | voided`，**不是核准狀態**；不得顯示成「已核准」。void 必填理由、不可刪除/還原。已作廢不能編輯。無批准、自動升級、抵銷或薪資連動。
- quantity 正整數 1..1000000；積分採精確半分，API decimal 一律字串（例如 `"-0.5"`）。新記錄由 DB 讀 active type 計算，client 不傳 points/actor/status/source。歷史積分原樣保留、不用現行規則重算；無歷史單次積分證據時 unit_points 為 null。
- 預設參考種類：嘉獎 0.5、小功 1、大功 3、警告 -0.5、申誡 -0.5、小過 -1、大過 -2。seed ON CONFLICT DO NOTHING。種類更名/停用/改分不改舊快照。編輯只在 type_code 或 quantity 真正改變時按當下 active type 重新計分；其他欄位修改保留原始分數。
- 不推論歷史單位。UI 僅使用 subject/current employee 顯示名；employee picker 不回 PIN/email/birth/source ID。
- 版本為正整數，每次有效 update/void/link/type-change 加一；傳 expected_version，stale `40001`。並行使用 row lock。寫入與 before/after audit 同交易；audit actor/time 由 DB 決定、append-only。

## Public RPC（Supabase `.rpc(name, args)`）

返回 JSON 值，Supabase client 解包後直接得到以下值，沒有額外 `data` envelope。所有 UUID/date/null 原樣。SQLSTATE：42501 拒絕、22023 驗證、P0002 不存在、40001 stale；22P02/22007/22008 為型別/日期驗證錯誤。前端必須顯示失敗並保留表單。

| RPC | args | return |
|---|---|---|
| rd_permission | 無 | boolean |
| rd_list_records | p_filter jsonb default `{}` | RecordPage |
| rd_get_record | p_id uuid | RewardRecord |
| rd_list_types | 無 | RewardType[]（含停用種類，供歷史顯示） |
| rd_subject_picker | p_search text default `''`, p_page int default 1, p_page_size int default 20 | SubjectPage |
| rd_employee_picker | 同上 | EmployeePage（僅現行 active，最少 id/name/department） |
| rd_create_subject | p_label text, p_employee_id uuid default null | Subject |
| rd_link_subject | p_id uuid, p_expected_version int, p_employee_id uuid nullable, p_reason text | Subject；明確人工確認/解除連結，不自動配對 |
| rd_create_record | p_input jsonb | RewardRecord |
| rd_update_record | p_id uuid, p_expected_version int, p_patch jsonb | RewardRecord |
| rd_void_record | p_id uuid, p_expected_version int, p_reason text | RewardRecord |
| rd_subject_history | p_subject_id uuid, p_filter jsonb default `{}` | RecordPage；強制 subject，期間小計排除 voided |
| rd_record_audit | p_record_id uuid, p_page int default 1, p_page_size int default 20 | AuditPage |
| rd_save_type | p_code text, p_expected_version int, p_label text, p_points text, p_active boolean | RewardType；僅更新既有類型，稽核且不重算記錄 |

### Shapes

`RewardRecord`: id, subject_id, subject_label, applicant_subject_id?, applicant_label?, application_date?, event_date?, type_code?, type_label, quantity?, unit_points? (decimal string), total_points (decimal string), basis, reason, notes, origin (`manual|import`), status, void_reason?, version, created_at, updated_at。

`Subject`: id, label, employee_id?, version。`RewardType`: code, label, points (decimal string), active, version。

`RecordPage`: items RewardRecord[], total（全部匹配筆數含選定 status）, page, page_size, summary `{recorded_count, voided_count, total_points}`。summary 使用完整相同 filter，分數只加 recorded；非該頁小計。排序 application_date DESC NULLS LAST, id DESC。history 同一 contract。

`SubjectPage`/`EmployeePage`: items, total, page, page_size。Subject items 如上；Employee items 只有 id/name/department。

`AuditPage`: items `{id, entity_kind, entity_id, action, actor_id, at, before, after, reason}`, total, page, page_size；before/after 是白名單 domain snapshot，不含來源人員原始 ID/raw。排序 at DESC, id DESC。record audit 不包含獨立 subject/type 操作（仍完整保存在私有 audit 表）。

`p_filter` 僅允許：search（literal substring，不把 %/_ 當 wildcard；subject label、type label、reason）, year（int 1..9999）, type_code, subject_id, status (`recorded|voided`；省略全部), from_date/to_date（inclusive application_date）, page（default1）, page_size（default20，1..100）。未知欄位拒絕，年度與日期範圍採 AND。

`p_input` 必填 subject_id, application_date, type_code, quantity, reason；可填 applicant_subject_id、event_date（nullable）、basis、notes（default 空字串）。`p_patch` 可包含 application_date（不得清空）、event_date、applicant_subject_id、type_code、quantity、basis、reason、notes；不得改 subject/source/status/points/version/actor/快照。字串以原值存放（只用 ECMAScript `String.prototype.trim()` 相容字元集合判斷必填：U+0009–000D、0020、00A0、1680、2000–200A、2028、2029、202F、205F、3000、FEFF；純空白一律拒絕，不採 locale-dependent whitespace）。SQL 的 RPC helper 與必填欄位 CHECK 共用同一 presence predicate；合法前後空白／多行文字完整保留，不 trim、不 normalize，歷史 import 原本可空的 reason 仍可空。畫面用 React text rendering，不用 innerHTML。label 最大200、basis2000、reason/notes4000、search200；void/link reason 1..2000。

## 私有匯入與冪等（不屬於瀏覽器 API）

`rewards_private.rd_import_record(p_source jsonb, p_record jsonb, p_subject jsonb, p_applicant jsonb default null)`：僅 DB owner 可執行，且 transaction 中 auth.uid() 須在明確 allowlist；不接受 client actor。先 dry-run 與取得正式授權，才由 owner 在安全程序內設定已驗證 admin UUID 的 transaction-local JWT subject；一般 PostgREST 無法呼叫此 schema。無 service identity 冒充原始申請人。

- p_source: `{spreadsheet_id,gid,record_id,raw,source_updated_raw}`。唯一 spreadsheet_id+gid+record_id；每筆捕捉原始 raw 與 update 字串，immutable。重跑衝突回 `{id,inserted:false}`，**不碰任何原始快照、subject 或 UI 修改**。
- p_subject / p_applicant: `{spreadsheet_id,gid,person_id,label,raw}`，唯一來源 namespace+原始 person_id；stable 新 UUID，employee_id 固定 null。同一 subject namespace 必須保持一致。raw 原樣私有保存，不向 UI、一般 audit 返回。重複人物不覆寫原始捕捉。
- p_record: `{application_date,event_date,type_code,type_label,quantity,total_points,basis,reason,notes}`；historical application_date/quantity/type_code 可 null，event_date 默認 null；total_points 精確半分字串必填、type_label 保留來源名稱。來源無事件日不填。來源 points 不由 quantity×現行類型重算。
- 成功回 `{id,inserted:true}`；新增一筆 action=import（不是 create/approve）；重跑不追加虛假變更 audit。來源連結與 original capture 不經 public update RPC 修改，DB trigger 拒絕 UPDATE/DELETE。沒有 overwrite/upsert UI 記錄路徑。
- 離線 importer 已新增於 `scripts/rewards-discipline-import.mjs`，用法與限制見 `docs/rewards-discipline-import.md`；真實 payload 僅存放 repo 外私有目錄，沒有 crosswalk seed。2026-11-26 經 owner 核准部署後，已重讀最後來源快照、保留私有備份、套用 migration，並完成 158 筆正式匯入及提交後獨立逐欄 reconciliation。歷史人物保持未連結，不猜配員工；後續由系統維護，原試算表保留查核，不做雙向同步。

## 授權一次性作業（由 owner 人工核准後執行，不在 migration seed）

1. 在可信管理介面獨立查核 Auth UUID 與核准者，不能以 metadata、登入成功、午間值班名單或 email 自動同步授權。
2. 用 owner connection 參數化執行 `INSERT INTO rewards_private.rd_admins(user_id, grant_reason) VALUES ($1::uuid, $2)`；$1 是已核准 UUID、$2 是核准憑據。授權表有 FK 至 auth.users、無一般 client 寫入權。
3. owner 讀回精確授權列；以該使用者 JWT 驗證 permission true 及業務 RPC，另驗 anon/非列名 authenticated/PIN employee/主管都拒絕。撤權 owner DELETE 該 allowlist 列後重新驗證。不要將真實 UUID/郵件放在 public SQL 範例或 repo。

## 本機驗證與 rollout gates

`node --test tests/rewardsDiscipline*.test.mjs`；完整 `node --test tests/*.test.mjs lib/*.test.mjs`；`git diff --check`。DB integration runner 在 `tests/rewardsDiscipline.database.mjs`（非預設 test glob），需隔離 PGlite package 路徑：

```sh
# 從 repo 根執行；TEST_TOOLS 必須是 repo 外的 scratch 路徑。
TEST_TOOLS="$HOME/.hermes/cache/scratch/rewards-backend-dbtest-pg17"
npm install --prefix "$TEST_TOOLS" --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14
REWARDS_PGLITE_MODULE="$TEST_TOOLS/node_modules/@electric-sql/pglite/dist/index.js" node --test tests/rewardsDiscipline.database.mjs
```

實際測到 PGlite 0.3.14 / PostgreSQL 17.5（與正式 17.6 同 major）；亦以 PGlite 0.6.0 / PostgreSQL 19 engine 執行過。這是隔離真 PostgreSQL engine 的 SQL/ACL/RLS/RPC 測試，**不是**完整 Supabase/PostgREST、JWT 驗簽或多連線並行整合驗收。禁止連正式 DB 測 fixture。158 events/85 subjects 測試資料全為 synthetic，不代表正式來源已匯入或完成對帳。

2026-11-26 rollout：正式 migration 與明確單一管理員授權已完成；正式 158 筆來源匯入已以提交後獨立查詢逐欄對帳（3,160 checks、0 mismatches），原員工主檔未變。anon 的 14 個 REST RPC 全部 401/42501；另於正式 SQL role 驗證 anon / 非列名 authenticated 的 26 個業務端點拒絕，以及管理員 create/update/reprice/stale/void/audit 的 rollback-only 閉環，確認無測試資料殘留。這不等於第二位真實登入者的 JWT 驗簽測試。前端獨立規格與安全審查均已通過；發布與已登入實際畫面仍須各自回讀確認，不能以 build 或 push 取代。

# 獎懲歷史匯入工具（owner-only；預設完全離線）

本工具不修改來源 Google Sheet、不建／啟用員工、不建立授權、不執行 migration、不部署。只新增 `scripts/rewards-discipline-import.mjs` 與匯入專用 tests/docs；schema/私有函式契約以 `rewards-discipline-contract.md` 及 SQL migration 為準。正式切換與 owner 授權仍需獨立核准；能產生 payload **不等於**有權正式 apply。

## 輸入與保留規則

來源是私有 JSON（例如 Sheets `values.get` 的 `{range, values}`），第一列必須完全等於以下 12 欄，順序及名稱不變：

```
獎懲ID 申請日期 申請人ID 申請人 被獎懲人ID 被獎懲人 依據 獎懲種類 次數 積分 事由 update
```

另以私有 metadata JSON 指定來源；工具本身不 hardcode 真實來源位置或人物識別碼：

```json
{"spreadsheet_id":"<EXACT_SPREADSHEET_ID>","gid":"<EXACT_NUMERIC_GID>","tab":"獎懲"}
```

- 每列恰好 12 個**字串**；保留 ID、姓名、空白、多行事由、依據及 update 原值，不 trim／normalize／修 ID。metadata.gid 必須是字串；不修復使用者提供的 token。
- 本 importer 採保守匯入政策：ID、兩方人物 ID/name、申請日期、類型、次數、積分不得空白；依據／事由／update 可為空字串。DB 雖容許部分歷史欄位為 null，本工具不自行把異常或缺值轉 null。NUL、超長、非字串、欄數異常均 fail closed。
- 日期只接受明確四位西元年 `YYYY/M/D` 或 `YYYY-MM-DD`，自行檢查閏年／月份天數後輸出 Gregorian ISO；拒絕民國／兩位年、序號、timestamp 或模糊格式；不用 Date.parse、不猜事件日。`event_date = null`。
- `次數` 限 1..1000000 的整數字串（拒絕空白、前導零、小數、科學記號）。`積分` 採 SQL 相同半分格式及範圍，精確字串／BigInt 半分合計；不以 quantity × 現行規則重算。`unit_points = null`；`type_label` 保留來源。
- 種類是 SQL seed 的精確對應：嘉獎→commendation、小功→minor_merit、大功→major_merit、警告→warning、申誡→reprimand、小過→minor_demerit、大過→major_demerit。未知名稱拒絕，無模糊中文推測。
- applicant 與 recipient **共用 spreadsheet_id+gid+person_id namespace**。同一 ID 不同 label 視為待釐清衝突，整批不得 apply。每人 `employee_id = null`，不讀取候選 crosswalk、不自動匹配／建立／啟用員工。
- 每筆私有 `p_source.raw = {headers, values}` 完整保留 12 欄；`source_updated_raw` 另照錄原文，不解析 timestamp。人物 origin.raw 保留該 person_id 及 label；完整歷史列在 source.raw。
- 冪等鍵是精確 `(spreadsheet_id,gid,record_id)`，不是列號、姓名或內容 hash。重複事件 ID 的**所有**重複列都標 invalid，不默默去重。report 的 valid_count + invalid_count = source_count；invalid 列不產生 payload；整批有任何 invalid 就不得輸出可 apply payload 或執行 SQL。
- `capture_sha256` 使用 Node `crypto`，hash 的是 `JSON.stringify(parsedSource)` UTF-8，包含 header/range/所有資料，**不是原始檔 bytes hash**。需要 byte-level 證據時應另外對來源檔 bytes 使用 crypto 計算並比對切換前後。hash 只做捕捉證據，不取代 idempotency key。

## 離線 dry-run：預設不載入 PostgreSQL driver、不連線

所有來源／metadata／connection 檔須為目前使用者持有的普通檔案、mode **0600**（拒絕 symlink）；允許 `--source -` 或 `--metadata -` 其中一個從 stdin 讀取。輸出檔父目錄必須 **0700**、位於任何 Git repo 外。新輸出一律 exclusive-create **0600**，不覆蓋既有檔。請將傳入 stdin 的資料也視為機密，不用 shell literal 放進 argv/history。

```sh
# 預先在 repo 外準備 owner-only 0700 目錄和兩個 0600 JSON。
node scripts/rewards-discipline-import.mjs \
  --source /private/import/source.json \
  --metadata /private/import/metadata.json \
  --payload-out /private/import/new-payload.json \
  --exceptions-out /private/import/new-exceptions.json
```

stdout 只有 aggregate report（來源／valid／invalid／共用人物數、日期範圍、type code 計數、points 合計與來源、hash），不印個別 ID／姓名／事由。private exceptions 預設只含來源列號及錯誤代碼。CLI 失敗時不印 raw DB exception、DSN、payload 或 stack。`all_subjects_unlinked` 描述新人物的匯入政策，不表示已讀取任何正式 DB。

空資料、錯 header/metadata、invalid 列、重複輸出檔、不安全權限一律非零 exit；不得把輸出中 valid_count 當成 apply 成功數。metadata/header 失敗時沒有可用的列數 report。

## 正式 apply（本批**不得執行**；需獨立核准）

Prerequisites：migration 已核准套用並驗證；trusted owner connection 已驗明；人工批准的 Auth UUID 已在 auth.users 和 rd_admins allowlist（授權必須走另一個經核准的 owner 作業）；來源最終快照與私有備份／切換點／報表對帳已核准。跨表連結政策未核准時仍全部不連結。

此 importer 不提供 service_role bypass，不呼叫 exec_sql RPC，不使用前端 service key。owner adapter 只接受 dedicated PostgreSQL client 的參數化 `query()`；工具不 INSERT allowlist、不 GRANT。

```sh
# 僅在正式授權核准後，由可信安全環境執行。
# connection.json 是 node-postgres connection config JSON，0600；密碼只在該檔／進程內，
# 不用 argv、URI 參數、console 或 shell history 傳遞。
node scripts/rewards-discipline-import.mjs \
  --source /private/import/final-source.json \
  --metadata /private/import/metadata.json \
  --apply --actor '<APPROVED_AUTH_UUID>' \
  --connection-file /private/import/connection.json
```

`pg` 是 apply-only optional dependency：須由操作環境預先安裝，或傳 `--pg-module /outside/repo/node_modules/pg/lib/index.js`。無 `--apply` 時禁止 connection-file/pg-module，避免不小心連線。權限檢查先於任何 import：current_user 須為 rd_sources owner／superuser；transaction-local `request.jwt.claim.sub` 使用指定已批准 UUID，並確認 rd_permission true。

每批單一 transaction：讀取原有記錄→參數化呼叫私有 `rd_import_record`→全欄對帳所有新增列→確認所有原有列（含 UI edits／UUID／timestamps／raw）完全未變→COMMIT→獨立 post-commit read-back。任何提交前失敗 rollback 整批；若 post-commit read-back 失敗，資料**可能已提交**，須標示未驗證並由 owner 查核，不得直接重跑或宣稱回滾。請使用專用連線／避免 transaction pool 或併用 client；真正多連線競態尚未驗證。

已有同冪等鍵時 DB 回 `inserted:false`，原始捕捉及 UI 修改都不覆寫；adapter 對既有列只驗「前後未變」，**不要求其現值等於舊來源**。來源內容後續變更不會被當成更新；需另行核准修正流程。重跑不新增 import audit。

### 既有 owner 管理 API 的私有 SQL artifact

父代理若使用既有已授權的 Supabase owner 管理 API，而非 PostgreSQL connection，可離線產生 private SQL：

```sh
node scripts/rewards-discipline-import.mjs \
  --source /private/import/final-source.json \
  --metadata /private/import/metadata.json \
  --actor '<APPROVED_AUTH_UUID>' --sql-out /private/import/new-owner-import.sql
```

這**只寫私有檔**，不連 API、不 execute、不 grant。SQL 有 BEGIN/COMMIT、owner/allowlist gate、transaction-local actor 與逐筆私有函式呼叫，literal 一律用 session-independent `E'...'`：先將反斜線加倍，再將單引號加倍；actor 及四組 JSON 共用此 encoding。保留 `SET LOCAL standard_conforming_strings=on` 僅為既有 backend runtime `U&'...'` helper 相容，**不能也不會依賴它保護 payload**，因為 PostgreSQL 可能先 parse 整個 request 再執行 SET。產生前仍須全批 validation。**此 SQL artifact 不是自動對帳 adapter**：管理 API 呼叫者必須另做經批准的提交前預演／提交後精確 read-back、逐 source ID 全欄 reconciliation 和既有列未變驗證，未完成不得宣稱正式成功。SQL 和 payload 都是個資，不可進 repo／chat／stdout。

## 可重用函式

- `buildImport(source, metadata)`：pure validation + build + aggregate report/private exceptions；無 DB。
- `civilDate`、`sha256`：明確日期／捕捉 hash。
- `reconcileImport(batch, actualRows)`：逐 source ID 比對全部 business 欄位、兩方 namespace/person/origin.raw、原始 12 欄及 update、null employee、status/origin/version；回 missing/extra/duplicate/mismatch 計數。`exceptions` 含來源 ID，只能私有保存，不能直接 console.log 全結果。
- `readBack(client, metadata)`：直接讀私有來源 namespace 全列，無 REST row-cap；返回含個資的 in-process rows，**不可印 raw**。
- `applyImport(client, batch, {apply:true, actor})`：owner transaction adapter＋提交後 read-back；回傳 aggregate。
- `makeOwnerSQL`：只生成機密 SQL 字串，呼叫者負責私有檔保存與正式 approval gate。
- `readPrivateJSON`／`writePrivate`：權限與 repo 外輸出保護。套件 API 的 DB error 不保證無個資，caller 必須捕捉、不要印 error.message/stack；CLI 已做遮蔽。

## 測試與限制

所有 repo fixture 均為 synthetic；真來源 runner／DB／payload／exceptions 只放 repo 外私有 scratch，不可 commit。

```sh
node --test tests/rewardsDisciplineImport*.test.mjs
REWARDS_PGLITE_MODULE=/outside/repo/node_modules/@electric-sql/pglite/dist/index.js \
  node --test tests/rewardsDisciplineImport.database.mjs
```

Synthetic coverage：12 欄與字串原樣、明確西元閏日、非法日期／數字／缺值／duplicate／人物衝突、精確半分、共用人物 namespace、全欄 mismatch/missing/extra/duplicate 偵測、CLI 不洩漏細節及 private permissions、未批准 actor 拒絕、audit 中途失敗整批回滾、完整匯入／read-back、重跑 0 新增與 audit 不增、UI edited fixture 不覆寫、現行種類更改不影響歷史、生成 SQL 實際執行；session standard_conforming_strings 分別 on/off 下單次 request 執行完整 SQL artifact，逐欄與 raw 原值對帳（字面 `\u`／`\n`／`\t`、實際換行／Tab／CR、單／雙引號及 SQL 樣式文字），並直接以無 SET 的 SELECT 驗證四組 JSON E-literal encoding 不依賴 session GUC。

隔離 PGlite/PostgreSQL 17 是真 SQL engine 驗證，不是正式 Supabase/PostgREST/JWT 驗簽／多連線並行測試。正式 migration、owner 授權、最終來源凍結／crosswalk approval、切換核准、真正 actor JWT 與 post-commit 全筆回讀、UI 驗收／部署各為獨立 gate。本文件與工具不代表任何正式系統已被變更。

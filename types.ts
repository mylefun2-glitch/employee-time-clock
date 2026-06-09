export enum CheckType {
  IN = 'IN',
  OUT = 'OUT'
}

export interface LogEntry {
  timestamp: Date;
  type: CheckType;
  pin: string;
}

export type KeypadValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'BACKSPACE' | 'CLEAR';

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',  // 已撤回
  WITHDRAW_PENDING = 'WITHDRAW_PENDING' // 撤回待審核
}

export enum RequestType {
  LEAVE = 'LEAVE',
  BUSINESS_TRIP = 'BUSINESS_TRIP',
  SHIFT = 'SHIFT' // 新增：挪移申請
}

export enum ShiftType {
  SWAP_REST_DAY = 'SWAP_REST_DAY',
  HOURS_ADJUSTMENT = 'HOURS_ADJUSTMENT'
}

export enum DayOverrideType {
  WORKDAY = 'WORKDAY',
  REST_DAY = 'REST_DAY',
  CUSTOM_HOURS = 'CUSTOM_HOURS'
}

export interface EmployeeDayOverride {
  id: string;
  employee_id: string;
  override_date: string;
  day_type: DayOverrideType;
  work_start_time?: string;
  work_end_time?: string;
  break_start_time?: string;
  break_end_time?: string;
  request_id?: string;
}

export interface ShiftRequest {
  id: string;
  created_at: string;
  employee_id: string;
  type: ShiftType;
  original_rest_date?: string;
  new_rest_date?: string;
  target_date?: string;
  new_work_start_time?: string;
  new_work_end_time?: string;
  new_break_start_time?: string;
  new_break_end_time?: string;
  reason?: string;
  status: RequestStatus;
  approver_id?: string;
  approved_at?: string;
  review_comment?: string;
  employee?: { name: string; department: string };
}

// 差勤類型介面
export interface LeaveType {
  id: string;
  created_at: string;
  name: string;              // 類型名稱（如：事假、病假）
  code: string;              // 類型代碼（如：PERSONAL、SICK）
  color: string;             // 顯示顏色（hex color）
  is_active: boolean;        // 是否啟用
  sort_order: number;        // 排序順序
}

export interface LeaveRequest {
  id: string;
  created_at: string;
  employee_id: string;
  type: RequestType;         // 保留舊欄位以維持向後相容
  leave_type_id?: string;    // 新的差勤類型 ID
  leave_type?: LeaveType;    // 包含完整類型資訊
  start_date: string;
  end_date: string;
  reason: string;
  status: RequestStatus;
  approver_id?: string;
  approved_at?: string;
  employee_name?: string;
  hours?: number; // 新增：申請總時數
  deputy_id?: string; // 新增:職務代理人 ID
  deputy?: Employee; // 新增:職務代理人完整資訊

  // 多層級審核欄位
  requires_chairman_approval?: boolean;  // 是否需要理事長審核（請假 >= 3 日）
  supervisor_approved_at?: string;       // 主管審核時間
  supervisor_approved_by?: string;       // 主管審核人 ID
  chairman_approved_at?: string;         // 理事長審核時間
  chairman_approved_by?: string;         // 理事長審核人 ID

  // 變更相關欄位
  original_request_id?: string;      // 如果這是變更申請,指向原始申請的 ID
  is_modified?: boolean;             // 標記此申請是否已被變更
  modified_by_request_id?: string;   // 如果此申請已被變更,指向新申請的 ID
  modification_reason?: string;      // 變更原因
  manual_break_hours?: number;       // 新增：手動扣除的休息時數

  // 附件相關欄位
  attachment_drive_id?: string;      // Google Drive 檔案 ID
  attachment_name?: string;          // 原始檔案名稱
  attachment_url?: string;           // 檔案預覽連結
  attachment_expires_at?: string;    // 附件自動刪除時間
  is_makeup_workday?: boolean;       // 是否為補行上班日
  is_makeup_holiday?: boolean;       // 是否為補假
  car_id?: string;                   // 新增：公務車 ID

  original_request?: LeaveRequest;   // 包含原始申請資訊
  modified_request?: LeaveRequest;   // 包含變更後的申請資訊
}

export interface Employee {
  id: string;
  name: string;
  username?: string; // 新增：登入帳號
  pin: string;
  email?: string;
  department: string;
  is_active: boolean;
  is_supervisor?: boolean;
  is_chairman?: boolean; // 是否為理事長
  manager_id?: string; // 直屬主管 ID

  // --- 新增詳細資料欄位 ---
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  position?: string;
  birth_date?: string;
  mailing_address?: string;
  contact_phone?: string;
  gmail?: string;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  insurance_start_date?: string;
  insurance_end_date?: string;
  join_date?: string;
  work_start_time?: string;
  work_end_time?: string;
  break_start_time?: string;
  break_end_time?: string;
  break2_start_time?: string;
  break2_end_time?: string;
  break3_start_time?: string;
  break3_end_time?: string;
  rest_days?: number[]; // [0, 6] = 周日, 周六
  salary_type?: 'MONTHLY' | 'HOURLY';
  schedule_effective_date?: string;
  standard_daily_hours?: number; // 新增：標準每日工時
  bank_name?: string;
  bank_account?: string;
}

export interface SenioritySuspension {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
}

export type SalaryType = 'MONTHLY' | 'HOURLY';

export interface EmployeeSchedule {
  id: string;
  employee_id: string;
  effective_date: string;
  work_start_time: string;
  work_end_time: string;
  break_start_time: string;
  break_end_time: string;
  break2_start_time?: string;
  break2_end_time?: string;
  break3_start_time?: string;
  break3_end_time?: string;
  rest_days: number[];
  salary_type: SalaryType;
  standard_daily_hours?: number;
  note?: string;
  base_salary?: number;
  hourly_rate?: number;
  allowance_manager?: number;
  allowance_license?: number;
  other_allowance?: number;
}

export interface EmployeeMovement {
  id: string;
  created_at: string;
  employee_id: string;
  movement_type: string;
  old_value?: string;
  new_value?: string;
  effective_date: string;
  reason?: string;
  recorded_by?: string;
}

export interface FourDayWorkweekPeriod {
  id: string;
  created_at: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  employee?: Employee;
}

export interface CompanyLocation {
  id: string;
  created_at?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

export interface LeaveBalance {
  annual: {
    entitlement: number;
    used: number;
    cashout: number;
    remaining: number;
    periods: Array<{
      label: string;
      start_date: string;
      end_date: string;
      entitlement: number;
      formula?: string;
      date_formula?: string;
      deferred_in?: number;
      deferred_out?: number;
      used: number;
      used_from_deferred?: number;
      cashout: number;
      remaining: number;
    }>;
  };
  compensatory: {
    entitlement: number;
    used: number;
    cashout: number;
    remaining: number;
    overtime_total: number; // 新增：加班總計
    periods: Array<{
      label: string;
      start_date: string;
      end_date: string;
      entitlement: number;
      formula?: string;
      deferred_in?: number;
      deferred_out?: number;
      used: number;
      used_from_deferred?: number;
      cashout: number;
      remaining: number;
    }>;
  };
}

// 借用資源 (物品/場地)
export interface Resource {
  id: string;
  created_at: string;
  name: string;
  type: 'ITEM' | 'VENUE';   // ITEM=物品, VENUE=場地
  description?: string;
  location?: string;         // 放置位置/場地地點
  quantity: number;          // 最大可借數量
  is_active: boolean;
}

// 借用申請
export interface ResourceRequest {
  id: string;
  created_at: string;
  employee_id: string;
  resource_id: string;
  quantity: number;
  start_time: string;
  end_time: string;
  purpose: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  approver_id?: string;
  approved_at?: string;
  review_comment?: string;
  // 關聯資料
  employee?: { id: string; name: string; department: string };
  resource?: { id: string; name: string; type: string; location?: string };
  approver?: { id: string; name: string };
}
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
  REJECTED = 'REJECTED'
}

export enum RequestType {
  LEAVE = 'LEAVE',
  BUSINESS_TRIP = 'BUSINESS_TRIP'
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
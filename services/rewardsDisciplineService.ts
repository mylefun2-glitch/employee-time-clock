import { supabase } from '../lib/supabase';
import { validateCreateRecord, validateRecordPatch, validateRecordFilter } from '../lib/rewardsDiscipline.mjs';
import type { RewardsRpcContract, RewardRecordFilter, CreateRewardRecord, UpdateRewardRecord, RewardEmployeeChoice } from '../types/rewardsDiscipline';

export class RewardsRpcError extends Error {
  constructor(public code: string) { super(code); this.name = 'RewardsRpcError'; }
}
export function rewardsErrorMessage(error: unknown): string {
  const code = error instanceof RewardsRpcError ? error.code : '';
  if (code === '42501') return '禁止存取：此帳號沒有員工獎懲管理權限。';
  if (code === '40001') return '資料已被其他操作更新。請重新讀取後核對；不會覆寫較新的版本。';
  if (code === 'P0002') return '記錄不存在，請重新讀取。';
  if (['22023','22P02','22007','22008'].includes(code) || error instanceof TypeError) return '欄位格式不正確，請檢查日期、必填內容與正整數次數。';
  return '讀取或儲存失敗，請重試；輸入內容已保留。';
}
export type RewardsDisciplineService = ReturnType<typeof createRewardsDisciplineService>;
export function createRewardsDisciplineService(sessionSignal?: AbortSignal) {
  async function rpc<K extends keyof RewardsRpcContract>(name: K, args: RewardsRpcContract[K]['args'], signal?: AbortSignal): Promise<RewardsRpcContract[K]['result']> {
    const combined = sessionSignal && signal ? AbortSignal.any([sessionSignal, signal]) : sessionSignal || signal || new AbortController().signal;
    combined?.throwIfAborted();
    const request = supabase.rpc(name, args);
    const { data, error } = await (combined ? request.abortSignal(combined) : request);
    combined?.throwIfAborted();
    if (error) throw new RewardsRpcError(error.code || 'UNKNOWN');
    if (data === null || data === undefined) throw new RewardsRpcError('INVALID_RESPONSE');
    return data as RewardsRpcContract[K]['result'];
  }
  return {
    permission: (signal?: AbortSignal) => rpc('rd_permission', {}, signal),
    list: (filter: RewardRecordFilter, signal?: AbortSignal) => rpc('rd_list_records', { p_filter: validateRecordFilter(filter) }, signal),
    get: (id: string, signal?: AbortSignal) => rpc('rd_get_record', { p_id: id }, signal),
    types: (signal?: AbortSignal) => rpc('rd_list_types', {}, signal),
    subjectPicker: (search: string, page: number, signal?: AbortSignal) => rpc('rd_subject_picker', { p_search: search, p_page: page, p_page_size: 20 }, signal),
    employeePicker: (search: string, page: number, signal?: AbortSignal) => rpc('rd_employee_picker', { p_search: search, p_page: page, p_page_size: 20 }, signal),
    createSubject: (employee: RewardEmployeeChoice, signal?: AbortSignal) => rpc('rd_create_subject', { p_label: employee.name, p_employee_id: employee.id }, signal),
    create: async (input: CreateRewardRecord, signal?: AbortSignal) => rpc('rd_create_record', { p_input: validateCreateRecord(input) as unknown as CreateRewardRecord }, signal),
    update: async (id: string, version: number, patch: UpdateRewardRecord, signal?: AbortSignal) => rpc('rd_update_record', { p_id: id, p_expected_version: version, p_patch: validateRecordPatch(patch) }, signal),
    void: (id: string, version: number, reason: string, signal?: AbortSignal) => rpc('rd_void_record', { p_id: id, p_expected_version: version, p_reason: reason }, signal),
    history: (id: string, filter: RewardRecordFilter, signal?: AbortSignal) => rpc('rd_subject_history', { p_subject_id: id, p_filter: validateRecordFilter(filter) }, signal),
    audit: (id: string, page: number, signal?: AbortSignal) => rpc('rd_record_audit', { p_record_id: id, p_page: page, p_page_size: 20 }, signal),
  };
}

/** Exact JSON contract: docs/rewards-discipline-contract.md. Decimal points are strings. */
export type UUID = string;
export type CivilDate = string;
export type DecimalPoints = string;
export interface RewardSubject { id:UUID; label:string; employee_id:UUID|null; version:number }
export interface RewardType { code:string; label:string; points:DecimalPoints; active:boolean; version:number }
export interface RewardRecord {
  id:UUID; subject_id:UUID; subject_label:string; applicant_subject_id:UUID|null; applicant_label:string|null;
  application_date:CivilDate|null; event_date:CivilDate|null; type_code:string|null; type_label:string;
  quantity:number|null; unit_points:DecimalPoints|null; total_points:DecimalPoints;
  basis:string; reason:string; notes:string; origin:'manual'|'import'; status:'recorded'|'voided';
  void_reason:string|null; version:number; created_at:string; updated_at:string;
}
export interface Page<T> {items:T[];total:number;page:number;page_size:number}
export interface RewardRecordPage extends Page<RewardRecord> {summary:{recorded_count:number;voided_count:number;total_points:DecimalPoints}}
export interface RewardRecordFilter {
  search?:string;year?:number;type_code?:string;subject_id?:UUID;status?:'recorded'|'voided';
  from_date?:CivilDate;to_date?:CivilDate;page?:number;page_size?:number;
}
export interface CreateRewardRecord {
  subject_id:UUID;application_date:CivilDate;type_code:string;quantity:number;reason:string;
  applicant_subject_id?:UUID|null;event_date?:CivilDate|null;basis?:string;notes?:string;
}
export type UpdateRewardRecord = Partial<Omit<CreateRewardRecord,'subject_id'>>;
export interface RewardEmployeeChoice {id:UUID;name:string;department:string|null}
export interface RewardAudit {
  id:UUID;entity_kind:'record'|'subject'|'type';entity_id:string;
  action:'create'|'update'|'void'|'import'|'link'|'type_update';actor_id:UUID;at:string;
  before:Record<string,unknown>|null;after:Record<string,unknown>;reason:string|null;
}
/** Permission must be queried from rd_permission(), never inferred from Auth user existence. */
export interface RewardsRpcContract {
  rd_permission:{args:Record<string,never>;result:boolean};
  rd_list_records:{args:{p_filter?:RewardRecordFilter};result:RewardRecordPage};
  rd_get_record:{args:{p_id:UUID};result:RewardRecord};
  rd_list_types:{args:Record<string,never>;result:RewardType[]};
  rd_subject_picker:{args:{p_search?:string;p_page?:number;p_page_size?:number};result:Page<RewardSubject>};
  rd_employee_picker:{args:{p_search?:string;p_page?:number;p_page_size?:number};result:Page<RewardEmployeeChoice>};
  rd_create_subject:{args:{p_label:string;p_employee_id?:UUID|null};result:RewardSubject};
  rd_link_subject:{args:{p_id:UUID;p_expected_version:number;p_employee_id:UUID|null;p_reason:string};result:RewardSubject};
  rd_create_record:{args:{p_input:CreateRewardRecord};result:RewardRecord};
  rd_update_record:{args:{p_id:UUID;p_expected_version:number;p_patch:UpdateRewardRecord};result:RewardRecord};
  rd_void_record:{args:{p_id:UUID;p_expected_version:number;p_reason:string};result:RewardRecord};
  rd_subject_history:{args:{p_subject_id:UUID;p_filter?:RewardRecordFilter};result:RewardRecordPage};
  rd_record_audit:{args:{p_record_id:UUID;p_page?:number;p_page_size?:number};result:Page<RewardAudit>};
  rd_save_type:{args:{p_code:string;p_expected_version:number;p_label:string;p_points:DecimalPoints;p_active:boolean};result:RewardType};
}

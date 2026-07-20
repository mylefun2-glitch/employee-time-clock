import { supabase } from '../lib/supabase';
import { Employee } from '../types';

export interface FaceEmployeeProfile {
  id?: string;
  employee_id: string;
  name: string;
  department?: string | null;
  descriptor: number[];
  reference_image_url?: string | null;
  is_active?: boolean;
  updated_at?: string;
}

export interface FaceAttendanceLog {
  id?: string;
  employee_id: string;
  check_type: 'IN' | 'OUT';
  timestamp?: string;
  latitude?: number | null;
  longitude?: number | null;
  location_accuracy?: number | null;
  match_distance?: number | null;
  reference_profile_id?: string | null;
  created_by?: string | null;
}

export const lookupOriginalEmployee = async (employeeId: string): Promise<Employee | null> => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, department, is_active')
      .eq('id', employeeId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('lookupOriginalEmployee error:', error);
      }
      return null;
    }

    return data as Employee;
  } catch (error) {
    console.error('lookupOriginalEmployee unexpected error:', error);
    return null;
  }
};

export const getFaceProfiles = async (): Promise<FaceEmployeeProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('face_employee_profiles')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('getFaceProfiles error:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      ...row,
      descriptor: Array.isArray(row.descriptor) ? row.descriptor.map((n: any) => Number(n)) : [],
    }));
  } catch (error) {
    console.error('getFaceProfiles unexpected error:', error);
    return [];
  }
};

export const getFaceProfileByEmployeeId = async (employeeId: string): Promise<FaceEmployeeProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('face_employee_profiles')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('getFaceProfileByEmployeeId error:', error);
      return null;
    }

    if (!data) return null;

    return {
      ...data,
      descriptor: Array.isArray(data.descriptor) ? data.descriptor.map((n: any) => Number(n)) : [],
    } as FaceEmployeeProfile;
  } catch (error) {
    console.error('getFaceProfileByEmployeeId unexpected error:', error);
    return null;
  }
};

export const upsertFaceProfile = async (
  profile: FaceEmployeeProfile
): Promise<{ success: boolean; data?: FaceEmployeeProfile; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('face_employee_profiles')
      .upsert(
        {
          employee_id: profile.employee_id,
          name: profile.name,
          department: profile.department ?? null,
          descriptor: profile.descriptor,
          reference_image_url: profile.reference_image_url ?? null,
          is_active: profile.is_active ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('upsertFaceProfile error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as FaceEmployeeProfile };
  } catch (error) {
    console.error('upsertFaceProfile unexpected error:', error);
    return { success: false, error: 'Network or system error' };
  }
};

export const getFaceTodayAttendance = async (employeeId: string): Promise<FaceAttendanceLog[]> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const { data, error } = await supabase
      .from('face_attendance_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('timestamp', todayStart)
      .lte('timestamp', todayEnd)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('getFaceTodayAttendance error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('getFaceTodayAttendance unexpected error:', error);
    return [];
  }
};

export const logFaceAttendance = async (
  payload: FaceAttendanceLog
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('face_attendance_logs')
      .insert([
        {
          ...payload,
          timestamp: payload.timestamp || new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('logFaceAttendance error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('logFaceAttendance unexpected error:', error);
    return { success: false, error: 'Network or system error' };
  }
};

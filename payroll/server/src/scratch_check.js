import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
  // Find employee UUIDs first
  const { data: sbEmployees, error: sbEmpError } = await supabase
    .from('employees')
    .select('id, name, username');
    
  if (sbEmpError) throw sbEmpError;

  const cmy = sbEmployees.find(e => e.name.includes("陳美玉"));
  const ljy = sbEmployees.find(e => e.name.includes("林家燕"));

  const startDate = '2026-05-01T00:00:00';
  const endDate = '2026-05-31T23:59:59';

  if (cmy) {
    console.log(`\n=== Supabase Leave Requests for 陳美玉 (${cmy.name}, UUID: ${cmy.id}) ===`);
    const { data: sbLeaves, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*, leave_types(code, name)')
      .eq('employee_id', cmy.id)
      .gte('start_date', startDate)
      .lte('end_date', endDate);

    if (leaveError) throw leaveError;
    sbLeaves.forEach(l => {
      console.log(`ID: ${l.id}, Type: ${l.leave_types?.name}, Start: ${l.start_date}, End: ${l.end_date}, Hours: ${l.hours}, Status: ${l.status}, Reason: ${l.reason}`);
    });
  }

  if (ljy) {
    console.log(`\n=== Supabase Leave Requests for 林家燕 (${ljy.name}, UUID: ${ljy.id}) ===`);
    const { data: sbLeaves, error: leaveError } = await supabase
      .from('leave_requests')
      .select('*, leave_types(code, name)')
      .eq('employee_id', ljy.id)
      .gte('start_date', startDate)
      .lte('end_date', endDate);

    if (leaveError) throw leaveError;
    sbLeaves.forEach(l => {
      console.log(`ID: ${l.id}, Type: ${l.leave_types?.name}, Start: ${l.start_date}, End: ${l.end_date}, Hours: ${l.hours}, Status: ${l.status}, Reason: ${l.reason}`);
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { supabase } from './lib/supabase';

async function testDate() {
    const testDate = new Date("2025-05-25 07:30:00");
    console.log("Original Date in local timezone:", testDate.toString());
    console.log("ISO String to be inserted:", testDate.toISOString());
    
    // We will just fetch one record to see its format
    const { data: fetch1 } = await supabase.from('leave_requests').select('start_date').limit(1);
    console.log("Sample DB start_date:", fetch1?.[0]?.start_date);
    
    // Create a dummy leave_request just to see what comes back, and rollback/delete it
    // Actually we don't need to insert, we can just see how existing dates are formatted.
}

testDate().catch(console.error);

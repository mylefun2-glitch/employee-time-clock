import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Testing insert...');
    const result = await supabase.from('resources').upsert({
        name: 'Test Projector',
        type: 'ITEM',
        description: '',
        location: '',
        quantity: 1,
        is_active: true
    }).select().single();
    
    console.log('Result:', result.error || result.data);
}

test();

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
        env[key] = val;
    }
}

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: emps, error } = await supabase
        .from('employees')
        .select('id, name, position, is_supervisor, manager_id');
    
    if (error) {
        console.error('Error:', error);
    } else {
        const matched = emps.filter(e => 
            e.position?.includes('主任') || 
            e.position?.includes('總幹事') || 
            ['李玉鳳', '林懇', '林明珠'].includes(e.name)
        );
        console.log('Matched Directors:', matched);
    }
}

main();

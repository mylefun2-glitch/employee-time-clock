import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    const key = parts[0];
    const value = parts.slice(1).join('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkEmails() {
    const { data: emps } = await supabase
        .from('employees')
        .select('id, name, email, username, is_supervisor');
    
    console.log('Employees list:');
    emps?.forEach(e => {
        if (e.email || e.username || e.is_supervisor) {
            console.log(`- Name: ${e.name}, Email: ${e.email}, Username: ${e.username}, Supervisor: ${e.is_supervisor}`);
        }
    });
}

checkEmails();

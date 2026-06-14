import { getCurrentUserEmployee } from '../services/supervisorService.ts';

async function test() {
    console.log('--- Testing getCurrentUserEmployee ---');
    const emails = ['ken800827@gmail.com', 'flu520@gmail.com', 'linzcc22@gmail.com'];
    
    for (const email of emails) {
        const emp = await getCurrentUserEmployee(email);
        console.log(`Email: ${email} => Employee: ${emp ? `${emp.name} (ID: ${emp.id})` : 'Not Found'}`);
    }
}

test();

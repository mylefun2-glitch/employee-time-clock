import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres.dqnaeesdovovmblsyuma:Linlifeng0714@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?schema=payroll',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT e.name, pr."grossPay", pr."leaveDeduction", pr."supplementaryHealthInsurance", pr."netPay", pr."allowanceAA", pr."allowanceLicense", pr."bonus", pr."otherAllowance", pr."retroPay", pr."overtimePay", pr."regularPay", pr."baseSalary"
    FROM "PayrollRecord" pr
    JOIN "Employee" e ON pr."employeeId" = e.id
    WHERE e.name = '林延達' AND pr.year = 2026 AND pr.month = 5
    ORDER BY pr.id DESC LIMIT 1
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

run().catch(console.error);

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ==========================================
  // 1. Create admin user
  // ==========================================
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      name: '系統管理員',
      role: 'admin',
    },
  });
  console.log('Admin user created.');

  // ==========================================
  // 2. Create sample employees
  // ==========================================
  const employees = [
    {
      employeeNo: 'EMP001',
      name: '王美玲',
      idNumber: 'A123456789',
      gender: 'F',
      birthDate: '1985-03-15',
      phone: '0912345678',
      address: '台北市大安區和平東路一段100號',
      email: 'wang.meiling@socialcare.org.tw',
      department: '行政部',
      position: '行政主管',
      hireDate: '2018-06-01',
      salaryType: 'monthly',
      baseSalary: 45000,
      mealAllowance: 0,
      transportAllowance: 1500,
      otherAllowance: 0,
      laborInsuranceGrade: 45800,
      healthInsuranceGrade: 45800,
      laborPensionGrade: 48200,
      voluntaryPensionRate: 6,
      dependents: 2,
      bankAccount: '012-345678901234',
      bankName: '台灣銀行',
    },
    {
      employeeNo: 'EMP002',
      name: '陳志明',
      idNumber: 'B234567890',
      gender: 'M',
      birthDate: '1990-07-22',
      phone: '0923456789',
      address: '台北市信義區松仁路50號',
      email: 'chen.zhiming@socialcare.org.tw',
      department: '照護部',
      position: '照護員',
      hireDate: '2020-03-15',
      salaryType: 'monthly',
      baseSalary: 32000,
      mealAllowance: 0,
      transportAllowance: 1000,
      otherAllowance: 500,
      laborInsuranceGrade: 33300,
      healthInsuranceGrade: 33300,
      laborPensionGrade: 34800,
      voluntaryPensionRate: 0,
      dependents: 0,
      bankAccount: '013-456789012345',
      bankName: '土地銀行',
    },
    {
      employeeNo: 'EMP003',
      name: '林淑芬',
      idNumber: 'C345678901',
      gender: 'F',
      birthDate: '1988-11-08',
      phone: '0934567890',
      address: '新北市板橋區中山路一段200號',
      email: 'lin.shufen@socialcare.org.tw',
      department: '護理部',
      position: '護理師',
      hireDate: '2019-09-01',
      salaryType: 'monthly',
      baseSalary: 42000,
      mealAllowance: 0,
      transportAllowance: 1500,
      otherAllowance: 2000,
      laborInsuranceGrade: 43900,
      healthInsuranceGrade: 43900,
      laborPensionGrade: 45800,
      voluntaryPensionRate: 3,
      dependents: 1,
      bankAccount: '014-567890123456',
      bankName: '合作金庫',
    },
    {
      employeeNo: 'EMP004',
      name: '張建國',
      idNumber: 'D456789012',
      gender: 'M',
      birthDate: '1982-05-30',
      phone: '0945678901',
      address: '台北市中正區重慶南路一段80號',
      email: 'zhang.jianguo@socialcare.org.tw',
      department: '社工部',
      position: '社工師',
      hireDate: '2017-01-15',
      salaryType: 'monthly',
      baseSalary: 48000,
      mealAllowance: 0,
      transportAllowance: 2000,
      otherAllowance: 1000,
      laborInsuranceGrade: 45800,
      healthInsuranceGrade: 45800,
      laborPensionGrade: 50600,
      voluntaryPensionRate: 6,
      dependents: 3,
      bankAccount: '015-678901234567',
      bankName: '華南銀行',
    },
    {
      employeeNo: 'EMP005',
      name: '李佳穎',
      idNumber: 'E567890123',
      gender: 'F',
      birthDate: '1995-02-14',
      phone: '0956789012',
      address: '新北市中和區景平路300號',
      email: 'li.jiaying@socialcare.org.tw',
      department: '照護部',
      position: '照護員',
      hireDate: '2022-08-01',
      salaryType: 'monthly',
      baseSalary: 30000,
      mealAllowance: 0,
      transportAllowance: 1000,
      otherAllowance: 0,
      laborInsuranceGrade: 30300,
      healthInsuranceGrade: 30300,
      laborPensionGrade: 31800,
      voluntaryPensionRate: 0,
      dependents: 0,
      bankAccount: '016-789012345678',
      bankName: '第一銀行',
    },
    {
      employeeNo: 'EMP006',
      name: '黃俊傑',
      idNumber: 'F678901234',
      gender: 'M',
      birthDate: '1978-09-03',
      phone: '0967890123',
      address: '台北市松山區南京東路五段60號',
      email: 'huang.junjie@socialcare.org.tw',
      department: '行政部',
      position: '會計',
      hireDate: '2016-04-01',
      salaryType: 'monthly',
      baseSalary: 40000,
      mealAllowance: 0,
      transportAllowance: 1500,
      otherAllowance: 500,
      laborInsuranceGrade: 40100,
      healthInsuranceGrade: 40100,
      laborPensionGrade: 42000,
      voluntaryPensionRate: 3,
      dependents: 2,
      bankAccount: '017-890123456789',
      bankName: '彰化銀行',
    },
    {
      employeeNo: 'EMP007',
      name: '許雅婷',
      idNumber: 'G789012345',
      gender: 'F',
      birthDate: '1992-12-25',
      phone: '0978901234',
      address: '新北市新莊區中正路150號',
      email: 'xu.yating@socialcare.org.tw',
      department: '護理部',
      position: '護理師',
      hireDate: '2021-02-15',
      salaryType: 'monthly',
      baseSalary: 38000,
      mealAllowance: 0,
      transportAllowance: 1500,
      otherAllowance: 1000,
      laborInsuranceGrade: 38200,
      healthInsuranceGrade: 38200,
      laborPensionGrade: 40100,
      voluntaryPensionRate: 0,
      dependents: 0,
      bankAccount: '018-901234567890',
      bankName: '台新銀行',
    },
    {
      employeeNo: 'EMP008',
      name: '吳宗翰',
      idNumber: 'H890123456',
      gender: 'M',
      birthDate: '1987-04-18',
      phone: '0989012345',
      address: '台北市萬華區西園路二段90號',
      email: 'wu.zonghan@socialcare.org.tw',
      department: '社工部',
      position: '社工員',
      hireDate: '2020-11-01',
      salaryType: 'monthly',
      baseSalary: 35000,
      mealAllowance: 0,
      transportAllowance: 1000,
      otherAllowance: 500,
      laborInsuranceGrade: 34800,
      healthInsuranceGrade: 34800,
      laborPensionGrade: 36300,
      voluntaryPensionRate: 0,
      dependents: 1,
      bankAccount: '019-012345678901',
      bankName: '國泰世華',
    },
    {
      employeeNo: 'EMP009',
      name: '鄭雅文',
      idNumber: 'I901234567',
      gender: 'F',
      birthDate: '1993-08-07',
      phone: '0990123456',
      address: '新北市三重區重新路四段120號',
      email: 'zheng.yawen@socialcare.org.tw',
      department: '照護部',
      position: '照護組長',
      hireDate: '2019-05-01',
      salaryType: 'monthly',
      baseSalary: 36000,
      mealAllowance: 0,
      transportAllowance: 1200,
      otherAllowance: 800,
      laborInsuranceGrade: 36300,
      healthInsuranceGrade: 36300,
      laborPensionGrade: 38200,
      voluntaryPensionRate: 3,
      dependents: 1,
      bankAccount: '020-123456789012',
      bankName: '玉山銀行',
    },
    {
      employeeNo: 'EMP010',
      name: '劉家豪',
      idNumber: 'J012345678',
      gender: 'M',
      birthDate: '1998-01-20',
      phone: '0901234567',
      address: '台北市文山區木柵路三段70號',
      email: 'liu.jiahao@socialcare.org.tw',
      department: '照護部',
      position: '照護員',
      hireDate: '2023-07-01',
      salaryType: 'hourly',
      baseSalary: 190,   // hourly rate
      mealAllowance: 0,
      transportAllowance: 0,
      otherAllowance: 0,
      laborInsuranceGrade: 27470,
      healthInsuranceGrade: 27470,
      laborPensionGrade: 27600,
      voluntaryPensionRate: 0,
      dependents: 0,
      bankAccount: '021-234567890123',
      bankName: '中國信託',
    },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { employeeNo: emp.employeeNo },
      update: emp,
      create: emp,
    });
  }
  console.log(`${employees.length} employees created.`);

  // ==========================================
  // 3. System settings for insurance/tax rates (2025 Taiwan rates)
  // ==========================================
  const settings = [
    // Labor Insurance (勞保)
    { category: 'insurance', key: 'labor_insurance_rate', value: '0.12', label: '勞保費率 (普通事故+就業保險)', notes: '2025年費率: 普通事故11% + 就業保險1% = 12%' },
    { category: 'insurance', key: 'labor_insurance_employee_share', value: '0.20', label: '勞保員工自付比例', notes: '員工自付20%' },
    { category: 'insurance', key: 'labor_insurance_employer_share', value: '0.70', label: '勞保雇主負擔比例', notes: '雇主負擔70%' },
    { category: 'insurance', key: 'labor_insurance_government_share', value: '0.10', label: '勞保政府補助比例', notes: '政府補助10%' },
    
    // Health Insurance (健保)
    { category: 'insurance', key: 'health_insurance_rate', value: '0.0517', label: '健保費率', notes: '2025年二代健保費率5.17%' },
    { category: 'insurance', key: 'health_insurance_employee_share', value: '0.30', label: '健保員工自付比例', notes: '員工自付30%' },
    { category: 'insurance', key: 'health_insurance_employer_share', value: '0.60', label: '健保雇主負擔比例', notes: '雇主負擔60%' },
    { category: 'insurance', key: 'health_insurance_government_share', value: '0.10', label: '健保政府補助比例', notes: '政府補助10%' },
    { category: 'insurance', key: 'health_insurance_avg_dependents', value: '0.61', label: '健保平均眷口數', notes: '2025年平均眷口數0.61人' },
    
    // Labor Pension (勞退)
    { category: 'insurance', key: 'labor_pension_employer_rate', value: '0.06', label: '勞退雇主提繳比例', notes: '雇主強制提繳6%' },
    { category: 'insurance', key: 'labor_pension_employee_max_rate', value: '0.06', label: '勞退員工自提上限', notes: '員工自願提繳上限6%' },
    
    // Tax settings (所得稅)
    { category: 'tax', key: 'tax_free_meal_allowance', value: '2400', label: '伙食費免稅額', notes: '每月伙食費免稅上限2,400元' },
    { category: 'tax', key: 'tax_exemption_per_dependent', value: '92000', label: '每人免稅額(年)', notes: '2025年每人免稅額92,000元/年' },
    { category: 'tax', key: 'standard_deduction_single', value: '124000', label: '標準扣除額-單身(年)', notes: '2025年單身標準扣除額124,000元/年' },
    { category: 'tax', key: 'standard_deduction_married', value: '248000', label: '標準扣除額-有配偶(年)', notes: '2025年有配偶標準扣除額248,000元/年' },
    { category: 'tax', key: 'salary_deduction', value: '218000', label: '薪資所得特別扣除額(年)', notes: '2025年薪資所得特別扣除額218,000元/年' },
    
    // General settings
    { category: 'general', key: 'org_name', value: '社會照顧關懷協會', label: '組織名稱', notes: null },
    { category: 'general', key: 'org_address', value: '台北市中正區重慶南路一段100號', label: '組織地址', notes: null },
    { category: 'general', key: 'org_phone', value: '02-23456789', label: '組織電話', notes: null },
    { category: 'general', key: 'org_tax_id', value: '12345678', label: '統一編號', notes: null },
    { category: 'general', key: 'work_days_per_month', value: '22', label: '每月工作天數', notes: '預設每月工作天數' },
    { category: 'general', key: 'work_hours_per_day', value: '8', label: '每日工作時數', notes: '預設每日正常工時' },
    { category: 'general', key: 'minimum_wage_monthly', value: '27470', label: '每月基本工資', notes: '2025年每月基本工資27,470元' },
    { category: 'general', key: 'minimum_wage_hourly', value: '183', label: '每小時基本工資', notes: '2025年每小時基本工資183元' },

    // Labor insurance grade table (勞保投保薪資分級表) stored as JSON
    { 
      category: 'grade_table', 
      key: 'labor_insurance_grades', 
      value: JSON.stringify([
        { grade: 1, min: 0, max: 27470, insuredSalary: 27470 },
        { grade: 2, min: 27471, max: 28800, insuredSalary: 28800 },
        { grade: 3, min: 28801, max: 30300, insuredSalary: 30300 },
        { grade: 4, min: 30301, max: 31800, insuredSalary: 31800 },
        { grade: 5, min: 31801, max: 33300, insuredSalary: 33300 },
        { grade: 6, min: 33301, max: 34800, insuredSalary: 34800 },
        { grade: 7, min: 34801, max: 36300, insuredSalary: 36300 },
        { grade: 8, min: 36301, max: 38200, insuredSalary: 38200 },
        { grade: 9, min: 38201, max: 40100, insuredSalary: 40100 },
        { grade: 10, min: 40101, max: 42000, insuredSalary: 42000 },
        { grade: 11, min: 42001, max: 43900, insuredSalary: 43900 },
        { grade: 12, min: 43901, max: 45800, insuredSalary: 45800 },
        { grade: 13, min: 45801, max: 48200, insuredSalary: 48200 },
        { grade: 14, min: 48201, max: 50600, insuredSalary: 50600 },
        { grade: 15, min: 50601, max: 53000, insuredSalary: 53000 },
        { grade: 16, min: 53001, max: 55400, insuredSalary: 55400 },
        { grade: 17, min: 55401, max: 57800, insuredSalary: 57800 },
        { grade: 18, min: 57801, max: 60800, insuredSalary: 60800 },
        { grade: 19, min: 60801, max: 999999, insuredSalary: 45800 },
      ]),
      label: '勞保投保薪資分級表',
      notes: '2025年勞保投保薪資分級表 (第19級以上以45,800元計)',
    },

    // Health insurance grade table (健保投保薪資分級表)
    {
      category: 'grade_table',
      key: 'health_insurance_grades',
      value: JSON.stringify([
        { grade: 1, min: 0, max: 27470, insuredSalary: 27470 },
        { grade: 2, min: 27471, max: 28800, insuredSalary: 28800 },
        { grade: 3, min: 28801, max: 30300, insuredSalary: 30300 },
        { grade: 4, min: 30301, max: 31800, insuredSalary: 31800 },
        { grade: 5, min: 31801, max: 33300, insuredSalary: 33300 },
        { grade: 6, min: 33301, max: 34800, insuredSalary: 34800 },
        { grade: 7, min: 34801, max: 36300, insuredSalary: 36300 },
        { grade: 8, min: 36301, max: 38200, insuredSalary: 38200 },
        { grade: 9, min: 38201, max: 40100, insuredSalary: 40100 },
        { grade: 10, min: 40101, max: 42000, insuredSalary: 42000 },
        { grade: 11, min: 42001, max: 43900, insuredSalary: 43900 },
        { grade: 12, min: 43901, max: 45800, insuredSalary: 45800 },
        { grade: 13, min: 45801, max: 48200, insuredSalary: 48200 },
        { grade: 14, min: 48201, max: 50600, insuredSalary: 50600 },
        { grade: 15, min: 50601, max: 53000, insuredSalary: 53000 },
        { grade: 16, min: 53001, max: 55400, insuredSalary: 55400 },
        { grade: 17, min: 55401, max: 57800, insuredSalary: 57800 },
        { grade: 18, min: 57801, max: 60800, insuredSalary: 60800 },
        { grade: 19, min: 60801, max: 63800, insuredSalary: 63800 },
        { grade: 20, min: 63801, max: 66800, insuredSalary: 66800 },
        { grade: 21, min: 66801, max: 69800, insuredSalary: 69800 },
        { grade: 22, min: 69801, max: 72800, insuredSalary: 72800 },
        { grade: 23, min: 72801, max: 76500, insuredSalary: 76500 },
        { grade: 24, min: 76501, max: 80200, insuredSalary: 80200 },
        { grade: 25, min: 80201, max: 83900, insuredSalary: 83900 },
        { grade: 26, min: 83901, max: 87600, insuredSalary: 87600 },
        { grade: 27, min: 87601, max: 92100, insuredSalary: 92100 },
        { grade: 28, min: 92101, max: 96600, insuredSalary: 96600 },
        { grade: 29, min: 96601, max: 101100, insuredSalary: 101100 },
        { grade: 30, min: 101101, max: 105600, insuredSalary: 105600 },
        { grade: 31, min: 105601, max: 110100, insuredSalary: 110100 },
        { grade: 32, min: 110101, max: 115500, insuredSalary: 115500 },
        { grade: 33, min: 115501, max: 120900, insuredSalary: 120900 },
        { grade: 34, min: 120901, max: 126300, insuredSalary: 126300 },
        { grade: 35, min: 126301, max: 131700, insuredSalary: 131700 },
        { grade: 36, min: 131701, max: 137100, insuredSalary: 137100 },
        { grade: 37, min: 137101, max: 142500, insuredSalary: 142500 },
        { grade: 38, min: 142501, max: 147900, insuredSalary: 147900 },
        { grade: 39, min: 147901, max: 150000, insuredSalary: 150000 },
        { grade: 40, min: 150001, max: 156400, insuredSalary: 156400 },
        { grade: 41, min: 156401, max: 162800, insuredSalary: 162800 },
        { grade: 42, min: 162801, max: 169200, insuredSalary: 169200 },
        { grade: 43, min: 169201, max: 175600, insuredSalary: 175600 },
        { grade: 44, min: 175601, max: 182000, insuredSalary: 182000 },
        { grade: 45, min: 182001, max: 189500, insuredSalary: 189500 },
        { grade: 46, min: 189501, max: 999999, insuredSalary: 219500 },
      ]),
      label: '健保投保薪資分級表',
      notes: '2025年健保投保金額分級表',
    },

    // Labor pension grade table (勞退月提繳分級表)
    {
      category: 'grade_table',
      key: 'labor_pension_grades',
      value: JSON.stringify([
        { grade: 1, min: 0, max: 1500, contributionSalary: 1500 },
        { grade: 2, min: 1501, max: 3000, contributionSalary: 3000 },
        { grade: 3, min: 3001, max: 4500, contributionSalary: 4500 },
        { grade: 4, min: 4501, max: 6000, contributionSalary: 6000 },
        { grade: 5, min: 6001, max: 7500, contributionSalary: 7500 },
        { grade: 6, min: 7501, max: 8700, contributionSalary: 8700 },
        { grade: 7, min: 8701, max: 9900, contributionSalary: 9900 },
        { grade: 8, min: 9901, max: 11100, contributionSalary: 11100 },
        { grade: 9, min: 11101, max: 12540, contributionSalary: 12540 },
        { grade: 10, min: 12541, max: 13500, contributionSalary: 13500 },
        { grade: 11, min: 13501, max: 15000, contributionSalary: 15000 },
        { grade: 12, min: 15001, max: 16500, contributionSalary: 16500 },
        { grade: 13, min: 16501, max: 18300, contributionSalary: 18300 },
        { grade: 14, min: 18301, max: 19200, contributionSalary: 19200 },
        { grade: 15, min: 19201, max: 20100, contributionSalary: 20100 },
        { grade: 16, min: 20101, max: 21000, contributionSalary: 21000 },
        { grade: 17, min: 21001, max: 21900, contributionSalary: 21900 },
        { grade: 18, min: 21901, max: 22800, contributionSalary: 22800 },
        { grade: 19, min: 22801, max: 24000, contributionSalary: 24000 },
        { grade: 20, min: 24001, max: 25200, contributionSalary: 25200 },
        { grade: 21, min: 25201, max: 26400, contributionSalary: 26400 },
        { grade: 22, min: 26401, max: 27600, contributionSalary: 27600 },
        { grade: 23, min: 27601, max: 28800, contributionSalary: 28800 },
        { grade: 24, min: 28801, max: 30300, contributionSalary: 30300 },
        { grade: 25, min: 30301, max: 31800, contributionSalary: 31800 },
        { grade: 26, min: 31801, max: 33300, contributionSalary: 33300 },
        { grade: 27, min: 33301, max: 34800, contributionSalary: 34800 },
        { grade: 28, min: 34801, max: 36300, contributionSalary: 36300 },
        { grade: 29, min: 36301, max: 38200, contributionSalary: 38200 },
        { grade: 30, min: 38201, max: 40100, contributionSalary: 40100 },
        { grade: 31, min: 40101, max: 42000, contributionSalary: 42000 },
        { grade: 32, min: 42001, max: 43900, contributionSalary: 43900 },
        { grade: 33, min: 43901, max: 45800, contributionSalary: 45800 },
        { grade: 34, min: 45801, max: 48200, contributionSalary: 48200 },
        { grade: 35, min: 48201, max: 50600, contributionSalary: 50600 },
        { grade: 36, min: 50601, max: 53000, contributionSalary: 53000 },
        { grade: 37, min: 53001, max: 55400, contributionSalary: 55400 },
        { grade: 38, min: 55401, max: 57800, contributionSalary: 57800 },
        { grade: 39, min: 57801, max: 60800, contributionSalary: 60800 },
        { grade: 40, min: 60801, max: 63800, contributionSalary: 63800 },
        { grade: 41, min: 63801, max: 66800, contributionSalary: 66800 },
        { grade: 42, min: 66801, max: 69800, contributionSalary: 69800 },
        { grade: 43, min: 69801, max: 72800, contributionSalary: 72800 },
        { grade: 44, min: 72801, max: 76500, contributionSalary: 76500 },
        { grade: 45, min: 76501, max: 80200, contributionSalary: 80200 },
        { grade: 46, min: 80201, max: 83900, contributionSalary: 83900 },
        { grade: 47, min: 83901, max: 87600, contributionSalary: 87600 },
        { grade: 48, min: 87601, max: 92100, contributionSalary: 92100 },
        { grade: 49, min: 92101, max: 96600, contributionSalary: 96600 },
        { grade: 50, min: 96601, max: 101100, contributionSalary: 101100 },
        { grade: 51, min: 101101, max: 105600, contributionSalary: 105600 },
        { grade: 52, min: 105601, max: 110100, contributionSalary: 110100 },
        { grade: 53, min: 110101, max: 115500, contributionSalary: 115500 },
        { grade: 54, min: 115501, max: 120900, contributionSalary: 120900 },
        { grade: 55, min: 120901, max: 126300, contributionSalary: 126300 },
        { grade: 56, min: 126301, max: 131700, contributionSalary: 131700 },
        { grade: 57, min: 131701, max: 137100, contributionSalary: 137100 },
        { grade: 58, min: 137101, max: 142500, contributionSalary: 142500 },
        { grade: 59, min: 142501, max: 147900, contributionSalary: 147900 },
        { grade: 60, min: 147901, max: 150000, contributionSalary: 150000 },
      ]),
      label: '勞退月提繳工資分級表',
      notes: '2025年勞退月提繳工資分級表',
    // Leave Rules (請假扣薪規則)
    {
      category: 'leave_rules',
      key: 'leave_deduction_rules',
      value: JSON.stringify([
        { leaveType: '生理假', deductionType: 'half', rate: 0.5, label: '生理假' },
        { leaveType: '病假', deductionType: 'half', rate: 0.5, label: '普通傷病假' },
        { leaveType: '事假', deductionType: 'full', rate: 1.0, label: '事假' },
        { leaveType: '家庭照顧假', deductionType: 'full', rate: 1.0, label: '家庭照顧假' },
        { leaveType: '特休', deductionType: 'none', rate: 0.0, label: '特別休假' },
        { leaveType: '公假', deductionType: 'none', rate: 0.0, label: '公假' },
        { leaveType: '婚假', deductionType: 'none', rate: 0.0, label: '婚假' },
        { leaveType: '喪假', deductionType: 'none', rate: 0.0, label: '喪假' },
        { leaveType: '產假', deductionType: 'none', rate: 0.0, label: '產假' },
        { leaveType: '陪產假', deductionType: 'none', rate: 0.0, label: '陪產檢及陪產假' },
        { leaveType: '補休', deductionType: 'none', rate: 0.0, label: '補休' }
      ]),
      label: '請假扣薪規則設定',
      notes: '自訂假別的扣薪規則與比例'
    }
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, label: setting.label, notes: setting.notes, category: setting.category },
      create: setting,
    });
  }
  console.log(`${settings.length} system settings created.`);

  // ==========================================
  // 4. Create sample attendance records for current month
  // ==========================================
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const allEmployees = await prisma.employee.findMany({ where: { isActive: true } });

  for (const emp of allEmployees) {
    // Create attendance for first 5 working days of current month
    for (let day = 1; day <= 5; day++) {
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();
      
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const hasOvertime = day === 3 && emp.id <= 5; // Some employees have OT on day 3
      await prisma.attendanceRecord.upsert({
        where: {
          employeeId_date: { employeeId: emp.id, date },
        },
        update: {},
        create: {
          employeeId: emp.id,
          date,
          clockIn: '09:00',
          clockOut: hasOvertime ? '19:00' : '18:00',
          regularHours: 8,
          overtimeHours: hasOvertime ? 2 : 0,
          overtimeType: hasOvertime ? 'weekday' : null,
          status: 'present',
        },
      });
    }
  }
  console.log('Sample attendance records created.');

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

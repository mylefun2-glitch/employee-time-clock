-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idNumber" TEXT,
    "gender" TEXT,
    "birthDate" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "email" TEXT,
    "department" TEXT NOT NULL,
    "position" TEXT,
    "hireDate" TEXT NOT NULL,
    "resignDate" TEXT,
    "salaryType" TEXT NOT NULL DEFAULT 'monthly',
    "baseSalary" REAL NOT NULL DEFAULT 0,
    "mealAllowance" REAL NOT NULL DEFAULT 0,
    "transportAllowance" REAL NOT NULL DEFAULT 0,
    "otherAllowance" REAL NOT NULL DEFAULT 0,
    "laborInsuranceGrade" REAL NOT NULL DEFAULT 0,
    "healthInsuranceGrade" REAL NOT NULL DEFAULT 0,
    "laborPensionGrade" REAL NOT NULL DEFAULT 0,
    "voluntaryPensionRate" REAL NOT NULL DEFAULT 0,
    "dependents" INTEGER NOT NULL DEFAULT 0,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "clockIn" TEXT,
    "clockOut" TEXT,
    "regularHours" REAL NOT NULL DEFAULT 0,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "overtimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'present',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AttendanceRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "days" REAL NOT NULL DEFAULT 1,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "baseSalary" REAL NOT NULL DEFAULT 0,
    "overtimePay" REAL NOT NULL DEFAULT 0,
    "mealAllowance" REAL NOT NULL DEFAULT 0,
    "transportAllowance" REAL NOT NULL DEFAULT 0,
    "otherAllowance" REAL NOT NULL DEFAULT 0,
    "bonus" REAL NOT NULL DEFAULT 0,
    "retroPay" REAL NOT NULL DEFAULT 0,
    "grossPay" REAL NOT NULL DEFAULT 0,
    "workDays" REAL NOT NULL DEFAULT 0,
    "leaveDays" REAL NOT NULL DEFAULT 0,
    "absentDays" REAL NOT NULL DEFAULT 0,
    "overtimeHours" REAL NOT NULL DEFAULT 0,
    "regularHours" REAL NOT NULL DEFAULT 0,
    "laborInsuranceEmployee" REAL NOT NULL DEFAULT 0,
    "healthInsuranceEmployee" REAL NOT NULL DEFAULT 0,
    "laborPensionEmployee" REAL NOT NULL DEFAULT 0,
    "incomeTax" REAL NOT NULL DEFAULT 0,
    "otherDeductions" REAL NOT NULL DEFAULT 0,
    "totalDeductions" REAL NOT NULL DEFAULT 0,
    "laborInsuranceEmployer" REAL NOT NULL DEFAULT 0,
    "healthInsuranceEmployer" REAL NOT NULL DEFAULT 0,
    "laborPensionEmployer" REAL NOT NULL DEFAULT 0,
    "totalEmployerCost" REAL NOT NULL DEFAULT 0,
    "netPay" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "calculatedAt" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNo_key" ON "Employee"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeId_date_key" ON "AttendanceRecord"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_employeeId_year_month_key" ON "PayrollRecord"("employeeId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

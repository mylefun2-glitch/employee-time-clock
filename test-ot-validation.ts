import { validateOTHours, isRestDay } from './lib/leaveUtils.ts';

// 測試案例 1: 平日加班超過 4 小時
console.log('=== 測試案例 1: 平日加班超過 4 小時 ===');
const test1Start = new Date('2026-02-10T18:00'); // 星期二 (非國定假日)
const test1End = new Date('2026-02-10T23:00'); // 5 小時
const test1Result = validateOTHours(test1Start, test1End, {});
console.log('結果:', test1Result);
console.log('預期: isValid = false, error 包含 "平日加班不得超過 4 小時"');
console.log('');

// 測試案例 2: 平日加班在限制內
console.log('=== 測試案例 2: 平日加班在限制內 ===');
const test2Start = new Date('2026-02-10T18:00'); // 星期二
const test2End = new Date('2026-02-10T21:30'); // 3.5 小時
const test2Result = validateOTHours(test2Start, test2End, {});
console.log('結果:', test2Result);
console.log('預期: isValid = true, adjustedHours = 3.5');
console.log('');

// 測試案例 3: 休息日加班超過 12 小時
console.log('=== 測試案例 3: 休息日加班超過 12 小時 ===');
const test3Start = new Date('2026-02-14T08:00'); // 星期六
const test3End = new Date('2026-02-14T21:00'); // 13 小時
const test3Result = validateOTHours(test3Start, test3End, {});
console.log('結果:', test3Result);
console.log('預期: isValid = false, error 包含 "休息日加班不得超過 12 小時"');
console.log('');

// 測試案例 4: 休息日加班需要扣除休息時間
console.log('=== 測試案例 4: 休息日加班需要扣除休息時間 ===');
const test4Start = new Date('2026-02-14T08:00'); // 星期六
const test4End = new Date('2026-02-14T13:00'); // 5 小時
const test4Result = validateOTHours(test4Start, test4End, {});
console.log('結果:', test4Result);
console.log('預期: isValid = true, adjustedHours = 4.5 (扣除 0.5 小時休息)');
console.log('');

// 測試案例 5: 檢查 isRestDay 函數
console.log('=== 測試案例 5: 檢查 isRestDay 函數 ===');
console.log('2026-02-10 (二):', isRestDay(new Date('2026-02-10'))); // 應該是 false
console.log('2026-02-14 (六):', isRestDay(new Date('2026-02-14'))); // 應該是 true
console.log('2026-02-15 (日):', isRestDay(new Date('2026-02-15'))); // 應該是 true
console.log('2026-02-17 (二,除夕):', isRestDay(new Date('2026-02-17'))); // 應該是 true (國定假日)

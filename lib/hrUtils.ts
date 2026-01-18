/**
 * 人事資料計算工具
 */

export const calculateAge = (birthDateString: string): number => {
    if (!birthDateString) return 0;
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

export const getAgeRange = (age: number): string => {
    if (age < 35) return '35歲以下';
    if (age >= 35 && age <= 44) return '35歲～44歲';
    if (age >= 45 && age <= 64) return '45歲～64歲';
    if (age >= 65) return '65歲以上';
    return '未知';
};

export const calculateSeniority = (joinDateString: string): number => {
    if (!joinDateString) return 0;
    const joinDate = new Date(joinDateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - joinDate.getTime());
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    return parseFloat(diffYears.toFixed(2));
};

export const getSeniorityRange = (years: number): string => {
    if (years < 0.25) return '0.25年以下';
    if (years >= 0.25 && years < 0.5) return '0.25年～0.5年以下';
    if (years >= 0.5 && years < 1) return '0.5年～1年';
    if (years >= 1 && years < 2) return '1年～2年';
    if (years >= 2 && years < 3) return '2年～3年'; // 補齊缺漏
    if (years >= 3 && years < 4) return '3年～4年';
    if (years >= 4 && years < 5) return '4年～5年';
    if (years >= 5 && years < 10) return '5年以上';
    if (years >= 10) return '10年以上';
    return '未知';
};

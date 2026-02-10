/**
 * 姓氏筆劃排序工具
 * 使用繁體中文筆劃順序排列姓名
 */

/**
 * 按照姓氏筆劃排序員工列表
 * @param employees 員工陣列
 * @returns 排序後的員工陣列
 */
export function sortByNameStroke<T extends { name: string }>(employees: T[]): T[] {
    // 使用 Intl.Collator 進行繁體中文排序
    // 'zh-Hant-TW' 使用台灣繁體中文的排序規則（筆劃順序）
    const collator = new Intl.Collator('zh-Hant-TW', {
        usage: 'sort',
        sensitivity: 'variant',
        numeric: false,
        caseFirst: 'false'
    });

    return [...employees].sort((a, b) => collator.compare(a.name, b.name));
}

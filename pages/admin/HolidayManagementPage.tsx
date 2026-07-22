import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Download, Calendar, Loader2 } from 'lucide-react';
import { 
  Holiday, 
  getHolidays, 
  addHoliday, 
  updateHoliday, 
  deleteHoliday, 
  importDefaultHolidays 
} from '../../lib/holidays';

interface HolidayManagementPageProps {
  isTabMode?: boolean;
}

type HolidayType = 'national_holiday' | 'typhoon' | 'custom';

export default function HolidayManagementPage({ isTabMode = false }: HolidayManagementPageProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  
  const [formData, setFormData] = useState<{
    date: string;
    name: string;
    type: HolidayType;
    description: string;
  }>({
    date: '',
    name: '',
    type: 'national_holiday',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHolidays(selectedYear);
      setHolidays(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error) {
      console.error('Error fetching holidays:', error);
      showAlert('error', '載入假日資料失敗');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const showAlert = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const handleImportDefaults = async () => {
    if (!window.confirm(`確定要匯入 ${selectedYear} 年的預設國定假日嗎？\n(已存在的相同日期將會被跳過)`)) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await importDefaultHolidays(selectedYear);
      showAlert('success', `匯入完成！成功匯入 ${result.imported} 筆，跳過 ${result.skipped} 筆`);
      fetchHolidays();
    } catch (error) {
      console.error('Error importing defaults:', error);
      showAlert('error', '匯入失敗');
      setLoading(false);
    }
  };

  const openModal = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        date: holiday.date,
        name: holiday.name,
        type: holiday.type as HolidayType,
        description: holiday.description || ''
      });
    } else {
      setEditingHoliday(null);
      setFormData({
        date: `${selectedYear}-01-01`,
        name: '',
        type: 'national_holiday',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHoliday(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingHoliday?.id) {
        await updateHoliday(editingHoliday.id, {
          date: formData.date,
          name: formData.name,
          type: formData.type,
          description: formData.description
        });
        showAlert('success', '已更新假日');
      } else {
        await addHoliday({
          date: formData.date,
          name: formData.name,
          type: formData.type,
          description: formData.description
        });
        showAlert('success', '已新增假日');
      }
      closeModal();
      fetchHolidays();
    } catch (error) {
      console.error('Error saving holiday:', error);
      showAlert('error', '儲存失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteHoliday(id);
      showAlert('success', '已刪除假日');
      fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      showAlert('error', '刪除失敗');
    } finally {
      setDeletingId(null);
    }
  };

  const formatRocDate = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const rocYear = d.getFullYear() - 1911;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${rocYear}/${month}/${day}`;
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'national_holiday': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'typhoon': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'custom': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'national_holiday': return '國定假日';
      case 'typhoon': return '颱風假/天災假';
      case 'custom': return '自訂假日';
      default: return type;
    }
  };

  const yearOptions = [];
  for (let y = 2025; y <= currentYear + 2; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="w-full">
      {!isTabMode && (
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            假日管理
          </h1>
          <p className="text-slate-500 mt-2 ml-11">設定國定假日、颱風假等特殊放假日</p>
        </div>
      )}

      {alertMsg && (
        <div className={`mb-6 p-4 rounded-xl flex items-center animate-in fade-in duration-300 ${
          alertMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {alertMsg.text}
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-slate-700">選擇年份：</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 font-bold"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y} ({y - 1911}年)</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleImportDefaults}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              匯入預設
            </button>
            <button
              onClick={() => openModal()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增假日
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">日期</th>
                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">假日名稱</th>
                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">類型</th>
                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">備註</th>
                <th className="px-6 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
                      <p>載入中...</p>
                    </div>
                  </td>
                </tr>
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    目前沒有 {selectedYear} 年的假日資料。
                  </td>
                </tr>
              ) : (
                holidays.map((holiday) => (
                  <tr key={holiday.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-700">{formatRocDate(holiday.date)}</div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">{holiday.name}</div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${getTypeStyle(holiday.type)}`}>
                        {getTypeName(holiday.type)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm text-slate-500 truncate max-w-[200px]">{holiday.description || '-'}</div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(holiday)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title="編輯"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(holiday.id!)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300 px-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                {editingHoliday ? '編輯假日' : '新增假日'}
              </h2>
              <button 
                onClick={closeModal}
                className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">日期</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                />
              </div>
              
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">假日名稱</label>
                <input
                  type="text"
                  required
                  placeholder="例如：元旦、颱風假"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">類型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as HolidayType})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                >
                  <option value="national_holiday">國定假日</option>
                  <option value="typhoon">颱風假/天災假</option>
                  <option value="custom">自訂假日</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">備註 (選填)</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium resize-none"
                  placeholder="補充說明..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-300 px-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">確定要刪除此假日？</h3>
            <p className="text-slate-500 mb-8">刪除後將無法復原，確定要繼續嗎？</p>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-colors"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

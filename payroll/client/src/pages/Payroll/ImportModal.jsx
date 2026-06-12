import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Modal, Button, DataTable } from '../../components/common';
import payrollService from '../../services/payrollService';

export default function ImportModal({ isOpen, onClose, year, month, payrolls, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDownloadTemplate = () => {
    const headers = ['工號', '姓名', '獎金', 'AA加給', '證照加給', '其他津貼', '其他津貼(不列入平均時薪計算)', '備註'];
    
    // Pre-fill with active employees from the payrolls list if available
    const rows = (payrolls && payrolls.length > 0)
      ? payrolls.map(p => [
          p.employee?.employeeNo || '',
          p.employee?.name || '',
          p.bonus || 0,
          p.allowanceAA || 0,
          p.allowanceLicense || 0,
          p.otherAllowance || 0,
          p.mealAllowance || 0,
          p.notes || ''
        ])
      : [
          ['EMP001', '王小明', 3000, 1500, 2000, 1000, 500, '績效優異獎金與加給調整'],
          ['EMP002', '李四', 2000, 0, 1000, 0, 0, '證照加給'],
          ['EMP003', '張三', 1500, 1000, 0, 500, 1000, '其他津貼調整'],
        ];
    
    // Create worksheet
    const worksheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // 工號
      { wch: 12 }, // 姓名
      { wch: 12 }, // 獎金
      { wch: 12 }, // AA加給
      { wch: 12 }, // 證照加給
      { wch: 15 }, // 其他津貼
      { wch: 28 }, // 其他津貼(不列入平均時薪計算)
      { wch: 30 }, // 備註
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '獎金津貼匯入範例');
    
    // Save file
    XLSX.writeFile(workbook, '社會照顧關懷協會_薪資獎金津貼批量匯入範例.xlsx');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parseExcel(selectedFile);
  };

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON array of objects
        const rawRows = XLSX.utils.sheet_to_json(worksheet);
        if (rawRows.length === 0) {
          alert('Excel 檔案為空，請檢查內容');
          return;
        }

        // Detect column headers
        const firstRow = rawRows[0];
        const keys = Object.keys(firstRow);
        
        // Keywords mapping
        let empNoKey = '';
        let nameKey = '';
        let bonusKey = '';
        let aaKey = '';
        let licenseKey = '';
        let otherKey = '';
        let otherExemptKey = '';
        let notesKey = '';

        keys.forEach(k => {
          const lk = k.toLowerCase().trim();
          if (lk === '工號' || lk === 'no' || lk.includes('員工編號') || lk.includes('工號')) {
            empNoKey = k;
          }
          if (lk === '姓名' || lk === 'name' || lk.includes('姓名')) {
            nameKey = k;
          }
          if (lk.includes('獎金') || lk.includes('bonus') || lk.includes('績效')) {
            bonusKey = k;
          }
          // Match AA specifically (avoid conflict with other allowances containing "加給")
          if (lk.includes('aa') || lk === 'aa加給') {
            aaKey = k;
          }
          // Match license specifically
          if (lk.includes('證照') || lk.includes('license') || lk === '證照加給') {
            licenseKey = k;
          }
          if (lk.includes('其他') || lk.includes('other') || lk.includes('津貼')) {
            if (lk.includes('不列入') || lk.includes('免計') || lk.includes('exempt') || lk.includes('不計入')) {
              otherExemptKey = k;
            } else {
              otherKey = k;
            }
          }
          if (lk.includes('備註') || lk.includes('說明') || lk.includes('notes') || lk.includes('備注')) {
            notesKey = k;
          }
        });

        // Map and Match rows
        const parsed = rawRows.map((row, idx) => {
          const empNo = empNoKey ? String(row[empNoKey] || '').trim() : '';
          const name = nameKey ? String(row[nameKey] || '').trim() : '';

          // Omit missing fields (use undefined) so they do NOT overwrite DB values with 0
          const bonus = bonusKey ? parseFloat(row[bonusKey]) || 0 : undefined;
          const allowanceAA = aaKey ? parseFloat(row[aaKey]) || 0 : undefined;
          const allowanceLicense = licenseKey ? parseFloat(row[licenseKey]) || 0 : undefined;
          const otherAllowance = otherKey ? parseFloat(row[otherKey]) || 0 : undefined;
          const mealAllowance = otherExemptKey ? parseFloat(row[otherExemptKey]) || 0 : undefined;
          const notes = notesKey ? String(row[notesKey] || '').trim() : undefined;

          // Match in payrolls list
          let matchedPayroll = null;
          if (empNo) {
            matchedPayroll = payrolls.find(p => p.employee?.employeeNo === empNo);
          }
          if (!matchedPayroll && name) {
            matchedPayroll = payrolls.find(p => p.employee?.name === name);
          }

          return {
            rowIdx: idx + 2, // Excel row is 1-indexed, +1 for header
            employeeNo: empNo,
            employeeName: name,
            bonus,
            allowanceAA,
            allowanceLicense,
            otherAllowance,
            mealAllowance,
            notes,
            matchedName: matchedPayroll ? matchedPayroll.employee?.name : null,
            matchedDept: matchedPayroll ? matchedPayroll.employee?.department : null,
            status: matchedPayroll ? 'SUCCESS' : 'ERROR',
            statusText: matchedPayroll ? '比對成功' : '查無此員工'
          };
        });

        setPreviewData(parsed);
      } catch (err) {
        console.error(err);
        alert('解析 Excel 檔案失敗，請確保為有效的 .xlsx 或 .xls 檔案');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    const validAdjustments = previewData.filter(p => p.status === 'SUCCESS');
    if (validAdjustments.length === 0) {
      alert('無比對成功的員工資料可供匯入');
      return;
    }

    setLoading(true);
    try {
      await payrollService.batchUpdateAdjustments(year, month, validAdjustments);
      alert(`成功匯入 ${validAdjustments.length} 筆獎金與津貼調整！`);
      setFile(null);
      setPreviewData([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImportSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message || '匯入失敗');
    } finally {
      setLoading(false);
    }
  };

  const previewColumns = [
    { title: 'Excel 行', key: 'rowIdx', align: 'center', width: '80px' },
    { title: '工號', key: 'employeeNo' },
    { title: '姓名', key: 'employeeName', bold: true },
    { title: '比對結果', key: 'matchedName', render: (val, row) => val ? `${val} (${row.matchedDept})` : '—' },
    { title: '獎金 (NT$)', key: 'bonus', align: 'right', render: (val) => val !== undefined ? val.toLocaleString('zh-TW') : '—' },
    { title: 'AA加給 (NT$)', key: 'allowanceAA', align: 'right', render: (val) => val !== undefined ? val.toLocaleString('zh-TW') : '—' },
    { title: '證照加給', key: 'allowanceLicense', align: 'right', render: (val) => val !== undefined ? val.toLocaleString('zh-TW') : '—' },
    { title: '其他津貼 (NT$)', key: 'otherAllowance', align: 'right', render: (val) => val !== undefined ? val.toLocaleString('zh-TW') : '—' },
    { title: '其他津貼(免計) (NT$)', key: 'mealAllowance', align: 'right', render: (val) => val !== undefined ? val.toLocaleString('zh-TW') : '—' },
    { title: '備註', key: 'notes', render: (val) => val !== undefined ? val : '—' },
    { 
      title: '比對狀態', 
      key: 'statusText', 
      render: (val, row) => (
        <span style={{ 
          color: row.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-error)',
          fontWeight: '600',
          fontSize: 'var(--text-xs)'
        }}>
          {val}
        </span>
      )
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`${year} 年 ${month} 月 批量匯入獎金津貼`}
      footer={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="outline" onClick={onClose} disabled={loading}>取消</Button>
          <Button 
            variant="primary" 
            icon="upload" 
            loading={loading} 
            disabled={previewData.length === 0} 
            onClick={handleConfirmImport}
          >
            確認匯入 ({previewData.filter(p => p.status === 'SUCCESS').length} 筆)
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-600)', flex: 1 }}>
            說明：請上傳包含工號、姓名、獎金 (如績效獎金)、AA加給、證照加給、其他津貼等欄位的 Excel 試算表。系統將自動比對本月已生成的薪資明細草稿並填入，並進行重新計算。
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            icon="download" 
            onClick={handleDownloadTemplate}
            title="下載範例檔案"
          />
        </div>

        <div style={{ 
          border: '2px dashed var(--color-neutral-300)', 
          borderRadius: 'var(--radius-lg)', 
          padding: 'var(--space-6)', 
          textAlign: 'center', 
          backgroundColor: 'var(--color-neutral-50)',
          cursor: 'pointer'
        }}
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-neutral-400)' }}>
            description
          </span>
          <p style={{ margin: 'var(--space-2) 0', fontWeight: '500' }}>
            {file ? `已選擇：${file.name}` : '點擊此處選擇 Excel 檔案'}
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }} 
          />
        </div>

        {previewData.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <h4 style={{ margin: 0 }}>匯入預覽 ({previewData.length} 筆紀錄)</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-neutral-200)', borderRadius: 'var(--radius-md)' }}>
              <DataTable 
                columns={previewColumns}
                data={previewData}
                emptyMessage="無可匯入的預覽資料"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

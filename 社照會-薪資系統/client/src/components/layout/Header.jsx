import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal } from '../common';

export default function Header() {
  const location = useLocation();
  const [isLogOpen, setIsLogOpen] = useState(false);

  const getPageTitle = (path) => {
    if (path === '/') return '儀表板';
    if (path.startsWith('/employees')) return '員工基本資料管理';
    if (path.startsWith('/attendance')) return '員工出勤紀錄管理';
    if (path.startsWith('/leaves')) return '請假審核與管理';
    if (path.startsWith('/payroll')) return '每月薪資結算作業';
    if (path.startsWith('/reports')) return '薪資報表與統計';
    if (path.startsWith('/settings')) return '系統費率與參數設定';
    return '社照會薪資系統';
  };

  return (
    <>
      <header style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--surface-primary)',
        borderBottom: '1px solid var(--color-neutral-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'fixed',
        top: 0,
        left: 'var(--active-sidebar-width, 260px)',
        right: 0,
        zIndex: 'var(--z-header)',
        boxShadow: 'var(--shadow-xs)',
        transition: 'left var(--transition-normal)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{
            width: '4px',
            height: '20px',
            backgroundColor: 'var(--color-primary-600)',
            borderRadius: 'var(--radius-full)'
          }} />
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', margin: 0 }}>
            {getPageTitle(location.pathname)}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {/* Version & Update Log Button */}
          <button 
            onClick={() => setIsLogOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary-50)',
              color: 'var(--color-primary-700)',
              fontSize: 'var(--text-xs)',
              fontWeight: '600',
              cursor: 'pointer',
              border: '1px solid var(--color-primary-200)',
              transition: 'all var(--transition-fast)'
            }}
            className="version-log-btn"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>new_releases</span>
            <span>v1.1.2 更新紀錄</span>
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-neutral-100)',
            color: 'var(--color-neutral-700)',
            fontSize: 'var(--text-xs)',
            fontWeight: '500'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>verified_user</span>
            連線安全
          </div>
        </div>
      </header>

      {/* Update Log Modal */}
      <Modal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        title="系統更新紀錄"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', lineHeight: '1.6' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge status-approved" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>v1.1.2</span>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-neutral-800)' }}>平日時數薪資計算精度優化 (2026-06-21)</span>
            </div>
            <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--space-5)', margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-600)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>平日工時計算精度提升</strong>：平日時數工資在計算時，工作時數（工時）計算到小數點第四位後再乘上約定時薪，以減少因早期四捨五入到小數點第二位所造成的薪資微幅誤差。</li>
              <li><strong>加班延長工時維持不變</strong>：加班的延長工時計算公式仍維持四捨五入到小數點第二位不變。</li>
            </ul>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-neutral-200)', margin: '4px 0' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge status-approved" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'var(--color-neutral-200)', color: 'var(--color-neutral-600)' }}>v1.1.1</span>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-neutral-800)' }}>薪資表單勾選體驗優化 (2026-06-21)</span>
            </div>
            <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--space-5)', margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-600)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>勾選區域擴大</strong>：大幅擴展薪資結算列表中，全選及單選勾選框（Checkbox）的點擊範圍至整格儲存格。點選勾選框旁的空白區域亦能完成勾選。</li>
              <li><strong>防止誤觸行點擊跳轉</strong>：在點選勾選欄儲存格、其他輸入框或按鈕時，主動阻斷事件冒泡，防止誤觸列表的「點擊查看明細」功能而造成頁面跳轉。</li>
            </ul>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-neutral-200)', margin: '4px 0' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge status-approved" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: 'var(--color-neutral-200)', color: 'var(--color-neutral-600)' }}>v1.1.0</span>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-neutral-800)' }}>核心功能優化發佈 (2026-06-06)</span>
            </div>
            <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--space-5)', margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-600)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>Supabase 唯讀同步整合</strong>：出勤及請假管理全面改由外部系統管理，此處重構為唯讀動態快取同步（開啟頁面、計算時自動拉取更新，清空過期快取以防止 data drift）。</li>
              <li><strong>名冊與出勤管理調整</strong>：隱藏員工編號（工號）欄位，將「部門」欄位調整至首欄。</li>
              <li><strong>DataTable 快速排序</strong>：列表表頭支持點擊升降冪快速排序，並有箭頭方向提示（支持 nested properties 排序）。</li>
              <li><strong>請假管理日期篩選</strong>：新增年月份篩選器，對齊出勤管理的篩選與按月份動態同步功能。</li>
              <li><strong>側邊選單縮放</strong>：新增摺疊按鈕，側邊選單可一鍵縮合為 72px 圖示模式，右側版面將自適應並平滑調整寬度。</li>
              <li><strong>UI/UX 優化與字體放大</strong>：全面調大字體大小級距以防止字體過小，並加入頁面切換淡入動畫，操作感更流暢 premium。</li>
            </ul>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--color-neutral-200)', margin: '4px 0' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge status-draft" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>v1.0.0</span>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-neutral-800)' }}>薪資系統初始發佈 (2026-06-06)</span>
            </div>
            <ul style={{ listStyleType: 'disc', paddingLeft: 'var(--space-5)', margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-600)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li><strong>台灣勞動法規結算引擎</strong>：支持加班費（1.334x/1.667x）、勞保、健保、雇主額外負擔成本、預扣所得稅及自提勞退的精確計算。</li>
              <li><strong>PDF 薪資單導出</strong>：支持單人薪資單生成與預覽，以及整月多名員工薪資明細一鍵合併批次下載。</li>
              <li><strong>財務分析報表</strong>：提供月度彙總表、年度成本走勢圖、部門佔比、勞健保申報清單與 CSV 檔案導出。</li>
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}

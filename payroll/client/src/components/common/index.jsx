import React from 'react';
import { createPortal } from 'react-dom';

// ==========================================
// 1. LoadingSpinner
// ==========================================
export function LoadingSpinner({ fullPage, size = 'md' }) {
  const spinner = <div className={`spinner spinner-${size}`} />;
  
  if (fullPage) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999
      }}>
        {spinner}
      </div>
    );
  }
  return spinner;
}

// ==========================================
// 2. Button
// ==========================================
export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading, 
  disabled, 
  icon,
  type = 'button',
  onClick,
  ...props 
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      {...props}
    >
      {loading && <div className="spinner spinner-sm" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />}
      {!loading && icon && <span className="material-symbols-outlined icon-sm">{icon}</span>}
      {children}
    </button>
  );
}

// ==========================================
// 3. Badge
// ==========================================
export function Badge({ status, text }) {
  const getStatusClass = (statusStr) => {
    switch (String(statusStr).toUpperCase()) {
      case 'APPROVED':
      case 'PRESENT':
      case 'SUCCESS':
        return 'status-approved';
      case 'PENDING':
      case 'LOCKED':
      case 'INFO':
        return 'status-locked';
      case 'DRAFT':
      case 'WARNING':
        return 'status-draft';
      case 'REJECTED':
      case 'ABSENT':
      case 'ERROR':
        return 'status-rejected';
      default:
        return 'status-draft';
    }
  };

  const getStatusText = (statusStr) => {
    switch (String(statusStr).toUpperCase()) {
      case 'APPROVED': return '已核准';
      case 'LOCKED': return '已鎖定';
      case 'DRAFT': return '草稿';
      case 'PENDING': return '待審核';
      case 'REJECTED': return '已駁回';
      case 'PRESENT': return '出勤';
      case 'ABSENT': return '曠職';
      case 'LEAVE': return '請假';
      case 'HOLIDAY': return '例假日';
      default: return statusStr;
    }
  };

  return (
    <span className={`badge ${getStatusClass(status)}`}>
      {text || getStatusText(status)}
    </span>
  );
}

// ==========================================
// 4. Card
// ==========================================
export function Card({ title, subtitle, extra, footer, children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {(title || subtitle || extra) && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--color-neutral-100)',
          paddingBottom: 'var(--space-3)'
        }}>
          <div>
            {title && <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{title}</h3>}
            {subtitle && <p style={{ margin: 0, color: 'var(--color-neutral-500)', fontSize: 'var(--text-xs)' }}>{subtitle}</p>}
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      {children}
      {footer && (
        <div style={{ 
          marginTop: 'var(--space-4)', 
          borderTop: '1px solid var(--color-neutral-100)', 
          paddingTop: 'var(--space-3)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-2)'
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}

export function SummaryCard({ title, value, icon, trend, trendDirection = 'up', color = 'primary' }) {
  return (
    <div className="card" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-4)',
      borderLeft: `4px solid var(--color-${color}-500)`
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '48px',
        height: '48px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: `var(--color-${color}-50)`,
        color: `var(--color-${color}-600)`
      }}>
        <span className="material-symbols-outlined icon-lg">{icon}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-neutral-500)' }}>{title}</p>
        <h3 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 'bold' }} className="font-mono">{value}</h3>
        {trend && (
          <p style={{ 
            margin: 0, 
            fontSize: 'var(--text-xs)', 
            color: trendDirection === 'up' ? 'var(--color-success)' : 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}>
            <span className="material-symbols-outlined icon-sm" style={{ fontSize: '14px' }}>
              {trendDirection === 'up' ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 5. Input
// ==========================================
export function Input({ 
  label, 
  error, 
  type = 'text', 
  value = '', 
  onChange, 
  options = [], 
  required,
  ...props 
}) {
  const inputStyle = {
    width: '100%',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    border: error ? '1px solid var(--color-error)' : '1px solid var(--color-neutral-300)',
    fontSize: 'var(--text-base)',
    outline: 'none',
    backgroundColor: 'var(--color-neutral-0)',
    transition: 'border-color var(--transition-fast)'
  };

  return (
    <div style={{ marginBottom: 'var(--space-4)', width: '100%' }}>
      {label && (
        <label style={{ 
          display: 'block', 
          marginBottom: 'var(--space-1)', 
          fontWeight: '500', 
          fontSize: 'var(--text-sm)',
          color: 'var(--color-neutral-700)'
        }}>
          {label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}
      
      {type === 'select' ? (
        <select 
          style={inputStyle} 
          value={value} 
          onChange={onChange} 
          required={required}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          value={value}
          onChange={onChange}
          required={required}
          {...props}
        />
      ) : (
        <input
          type={type}
          style={inputStyle}
          value={value}
          onChange={onChange}
          required={required}
          {...props}
        />
      )}
      
      {error && (
        <p style={{ 
          margin: 'var(--space-1) 0 0 0', 
          fontSize: 'var(--text-xs)', 
          color: 'var(--color-error)' 
        }}>{error}</p>
      )}
    </div>
  );
}

// ==========================================
// 6. DataTable
// ==========================================
export function DataTable({ columns = [], data = [], loading, emptyMessage = '暫無資料', onRowClick }) {
  const [sortField, setSortField] = React.useState(null);
  const [sortDirection, setSortDirection] = React.useState('asc');

  const handleSort = (col) => {
    if (!col.key) return;
    if (col.sortable === false) return;

    if (sortField === col.key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(col.key);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ 
        padding: 'var(--space-10)', 
        textAlign: 'center', 
        color: 'var(--color-neutral-400)',
        backgroundColor: 'var(--color-neutral-0)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-neutral-200)'
      }}>
        <span className="material-symbols-outlined icon-lg" style={{ fontSize: '48px', marginBottom: 'var(--space-2)' }}>
          database_off
        </span>
        <p style={{ margin: 0 }}>{emptyMessage}</p>
      </div>
    );
  }

  let sortedData = [...data];
  if (sortField) {
    sortedData.sort((a, b) => {
      let valA = a;
      let valB = b;

      if (typeof sortField === 'string' && sortField.includes('.')) {
        const parts = sortField.split('.');
        valA = parts.reduce((obj, p) => obj?.[p], a);
        valB = parts.reduce((obj, p) => obj?.[p], b);
      } else {
        valA = a[sortField];
        valB = b[sortField];
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return sortDirection === 'asc' 
          ? (valA === valB ? 0 : valA ? -1 : 1)
          : (valA === valB ? 0 : valA ? 1 : -1);
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      
      return sortDirection === 'asc' 
        ? strA.localeCompare(strB, 'zh-TW', { numeric: true }) 
        : strB.localeCompare(strA, 'zh-TW', { numeric: true });
    });
  }

  return (
    <div style={{ 
      overflowX: 'auto', 
      backgroundColor: 'var(--color-neutral-0)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-neutral-200)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-neutral-200)' }}>
            {columns.map((col, idx) => {
              const isSorted = sortField === col.key;
              const canSort = col.key && col.sortable !== false && col.key !== 'actions';
              
              return (
                <th 
                  key={idx} 
                  onClick={() => canSort && handleSort(col)}
                  style={{ 
                    padding: 'var(--space-3) var(--space-4)', 
                    fontWeight: '600', 
                    color: 'var(--color-neutral-700)',
                    fontSize: 'var(--text-sm)',
                    textAlign: col.align || 'left',
                    cursor: canSort ? 'pointer' : 'default',
                    userSelect: 'none',
                    transition: 'background-color var(--transition-fast)'
                  }}
                  className={canSort ? 'table-header-sortable' : ''}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' 
                  }}>
                    <span>{col.title}</span>
                    {canSort && (
                      <span className="material-symbols-outlined" style={{ 
                        fontSize: '16px', 
                        color: isSorted ? 'var(--color-primary-600)' : 'var(--color-neutral-400)',
                        opacity: isSorted ? 1 : 0.5
                      }}>
                        {isSorted ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIdx) => (
            <tr 
              key={row.id || rowIdx} 
              onClick={(e) => {
                if (
                  e.target.tagName === 'INPUT' ||
                  e.target.tagName === 'BUTTON' ||
                  e.target.tagName === 'A' ||
                  e.target.closest('button') ||
                  e.target.closest('a') ||
                  e.target.closest('input')
                ) {
                  return;
                }
                onRowClick && onRowClick(row);
              }}
              style={{ 
                borderBottom: '1px solid var(--color-neutral-100)',
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background-color var(--transition-fast)'
              }}
              className="table-row-hover"
            >
              {columns.map((col, colIdx) => (
                <td key={colIdx} style={{ 
                  padding: 'var(--space-3) var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  textAlign: col.align || 'left',
                  fontWeight: col.bold ? '600' : 'normal'
                }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// 7. Modal
// ==========================================
export function Modal({ isOpen, title, onClose, children, footer, size = 'md' }) {
  if (!isOpen) return null;

  const widthMap = {
    sm: '400px',
    md: '600px',
    lg: '800px',
    xl: '1000px'
  };

  const modalElement = (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999
    }}>
      <div className="animate-scale-in" style={{
        backgroundColor: 'var(--color-neutral-0)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        width: '100%',
        maxWidth: widthMap[size],
        margin: 'var(--space-4)',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--color-neutral-200)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button 
            onClick={onClose}
            style={{ 
              color: 'var(--color-neutral-500)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        {/* Body */}
        <div style={{
          padding: 'var(--space-4)',
          overflowY: 'auto',
          flex: 1
        }}>
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div style={{
            padding: 'var(--space-4)',
            borderTop: '1px solid var(--color-neutral-200)',
            backgroundColor: 'var(--color-neutral-50)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)'
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
}

// ==========================================
// 8. Pagination
// ==========================================
export function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 'var(--space-4)',
      padding: '0 var(--space-2)'
    }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-500)' }}>
        顯示第 {((page - 1) * pageSize) + 1} 至 {Math.min(page * pageSize, total)} 筆，共 {total} 筆資料
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={page === 1} 
          onClick={() => onPageChange(page - 1)}
        >
          上一頁
        </Button>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-3)',
          fontSize: 'var(--text-sm)',
          fontWeight: '500',
          color: 'var(--color-neutral-700)'
        }}>
          {page} / {totalPages}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={page === totalPages} 
          onClick={() => onPageChange(page + 1)}
        >
          下一頁
        </Button>
      </div>
    </div>
  );
}

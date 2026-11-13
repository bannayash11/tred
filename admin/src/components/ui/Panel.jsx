import React from 'react';

export default function Panel({ children, className = '', soft = false }) {
  return (
    <div className={`${soft ? 'admin-panel-soft' : 'admin-panel'} ${className}`.trim()}>
      {children}
    </div>
  );
}

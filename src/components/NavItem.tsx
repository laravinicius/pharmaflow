import React from 'react';

export function NavItem({ icon, label, active, onClick, collapsed }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; collapsed: boolean
}) {
  return (
    <button onClick={onClick}
      style={active
        ? { background: 'rgba(255,255,255,0.15)', color: 'white' }
        : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
        active ? 'font-semibold' : 'text-white opacity-60 hover:opacity-100 hover:bg-white/10'
      }`}>
      <span style={active ? { color: '#FBBF24' } : undefined}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
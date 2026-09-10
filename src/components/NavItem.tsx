import React from 'react';
import { COLORS } from '../../config/branding';

export function NavItem({ icon, label, active, onClick, collapsed }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; collapsed: boolean
}) {
  return (
    <button onClick={onClick}
      style={active
        ? { background: COLORS.navActiveBg, color: 'white' }
        : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
        active ? 'font-semibold' : 'text-white opacity-60 hover:opacity-100 hover:bg-white/10'
      }`}>
      <span style={active ? { color: COLORS.navActive } : undefined}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
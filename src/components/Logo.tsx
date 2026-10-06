import React from 'react';
import { BRAND, COLORS, LOGO } from '../../config/branding';

export function CrossIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="10" y="2" width="4" height="20" rx="2" fill={color}/>
      <rect x="2" y="10" width="20" height="4" rx="2" fill={color}/>
    </svg>
  );
}

function LogoImage({ sizePx, rounded = 'rounded-xl', fillWidth = false, variant = 'white' }: { sizePx: number; rounded?: string; fillWidth?: boolean; variant?: 'white' | 'original' }) {
  const [useFallback, setUseFallback] = React.useState(false);
  const gradient = `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%)`;
  const asset = variant === 'original' ? LOGO.original : LOGO.white;
  const src = useFallback ? asset.fallback : asset.src;

  if (!src) {
    return (
      <div className={`flex items-center justify-center shrink-0 shadow-md ${rounded}`}
        style={{ width: sizePx, height: sizePx, background: gradient }}>
        <CrossIcon size={Math.round(sizePx * 0.55)} />
      </div>
    );
  }
  return (
    <img src={src} alt={BRAND.name}
      className={`shadow-md object-contain ${rounded} ${fillWidth ? 'w-full h-auto' : 'shrink-0'}`}
      style={fillWidth ? { maxWidth: sizePx } : { width: sizePx, height: sizePx }}
      onError={() => !useFallback && setUseFallback(true)} />
  );
}

export function BrandLogo({ size = 'md' }: { size?: 'icon' | 'md' | 'lg' | 'sidebar' }) {
  if (size === 'icon') return <LogoImage sizePx={40} variant="white" />;

  if (size === 'sidebar') {
    return (
      <div className="w-full flex flex-col items-center gap-2">
        <LogoImage sizePx={200} fillWidth variant="white" />
        <span className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase leading-tight">{BRAND.caption}</span>
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <LogoImage sizePx={448} fillWidth variant="original" />
    );
  }

  return (
    <div className="flex items-center gap-3">
      <LogoImage sizePx={40} variant="white" />
      <div>
        <div className="font-black text-lg leading-tight tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          {LOGO.textParts.map((part, i) => (
            <span key={i} style={{ color: part.color }}>{part.text}</span>
          ))}
        </div>
        <div className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase leading-tight">{BRAND.caption}</div>
      </div>
    </div>
  );
}
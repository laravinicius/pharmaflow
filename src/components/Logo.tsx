import React from 'react';

export const PRIMARY = '#C5243E';
export const SECONDARY = '#243465';
export const FARMA_COLOR = '#4A90D9'; // azul mais claro — visível tanto no fundo branco quanto no navy

export function CrossIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="10" y="2" width="4" height="20" rx="2" fill="white"/>
      <rect x="2" y="10" width="20" height="4" rx="2" fill="white"/>
    </svg>
  );
}

// Logo otimizado em WebP (fallback para PNG se não carregar) - versão sem background
const LOGO_SRC_WHITE = 'logo_white_nobg.webp';
const LOGO_FALLBACK_WHITE = 'logo_white_nobg.png';
const LOGO_SRC_ORIGINAL = 'logo_nobg.webp';
const LOGO_FALLBACK_ORIGINAL = 'logo_nobg.png';

function LogoImage({ sizePx, rounded = 'rounded-xl', fillWidth = false, variant = 'white' }: { sizePx: number; rounded?: string; fillWidth?: boolean; variant?: 'white' | 'original' }) {
  const [useFallback, setUseFallback] = React.useState(false);
  const gradient = `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`;
  const src = useFallback
    ? (variant === 'original' ? LOGO_FALLBACK_ORIGINAL : LOGO_FALLBACK_WHITE)
    : (variant === 'original' ? LOGO_SRC_ORIGINAL : LOGO_SRC_WHITE);

  if (!src) {
    return (
      <div className={`flex items-center justify-center shrink-0 shadow-md ${rounded}`}
        style={{ width: sizePx, height: sizePx, background: gradient }}>
        <CrossIcon size={Math.round(sizePx * 0.55)} />
      </div>
    );
  }
  return (
    <img src={src} alt="PIX Farma"
      className={`shadow-md object-contain ${rounded} ${fillWidth ? 'w-full h-auto' : 'shrink-0'}`}
      style={fillWidth ? { maxWidth: sizePx } : { width: sizePx, height: sizePx }}
      onError={() => !useFallback && setUseFallback(true)} />
  );
}

export function PixFarmaLogo({ size = 'md' }: { size?: 'icon' | 'md' | 'lg' | 'sidebar' }) {
  if (size === 'icon') return <LogoImage sizePx={40} variant="white" />;

  if (size === 'sidebar') {
    return (
      <div className="w-full flex flex-col items-center gap-2">
        <LogoImage sizePx={200} fillWidth variant="white" />
        <span className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase leading-tight">Manipulação</span>
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
          <span style={{ color: PRIMARY }}>Pix</span><span style={{ color: FARMA_COLOR }}>Farma</span>
        </div>
        <div className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase leading-tight">Manipulação</div>
      </div>
    </div>
  );
}
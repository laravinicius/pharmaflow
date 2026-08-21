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
const LOGO_SRC = 'logo_nobg.webp';
const LOGO_FALLBACK = 'logo_nobg.png';

function LogoImage({ sizePx, rounded = 'rounded-xl', fillWidth = false }: { sizePx: number; rounded?: string; fillWidth?: boolean }) {
  const [useFallback, setUseFallback] = React.useState(false);
  const gradient = `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`;
  const src = useFallback ? LOGO_FALLBACK : LOGO_SRC;

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
      className={`shadow-md object-contain bg-white ${rounded} ${fillWidth ? 'w-full h-auto' : 'shrink-0'}`}
      style={fillWidth ? { maxWidth: sizePx } : { width: sizePx, height: sizePx }}
      onError={() => !useFallback && setUseFallback(true)} />
  );
}

export function PixFarmaLogo({ size = 'md' }: { size?: 'icon' | 'md' | 'lg' | 'sidebar' }) {
  if (size === 'icon') return <LogoImage sizePx={40} />;

  if (size === 'sidebar') {
    return (
      <div className="w-full flex flex-col items-center gap-2">
        <LogoImage sizePx={200} fillWidth />
        <span className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase leading-tight">Manipulação</span>
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center gap-3">
        <LogoImage sizePx={80} rounded="rounded-2xl" />
        <div className="text-center">
          <div className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            <span style={{ color: PRIMARY }}>Pix</span><span style={{ color: FARMA_COLOR }}>Farma</span>
          </div>
          <div className="text-xs text-zinc-400 font-medium tracking-widest uppercase mt-0.5">Sistema de Manipulação</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <LogoImage sizePx={40} />
      <div>
        <div className="font-black text-lg leading-tight tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          <span style={{ color: PRIMARY }}>Pix</span><span style={{ color: FARMA_COLOR }}>Farma</span>
        </div>
        <div className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase leading-tight">Manipulação</div>
      </div>
    </div>
  );
}
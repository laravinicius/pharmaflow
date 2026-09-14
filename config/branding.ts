// ─── Configuração central de marca ────────────────────────────────────────────
// Único arquivo que diferencia a versão genérica das versões por cliente.
// Sempre importe as cores da marca daqui (e não hex solto nos componentes),
// para que trocar de cliente = apenas editar este arquivo.

export const BRAND = {
  name: 'PIX Farma',
  windowTitle: 'PIX Farma - Manipulação',
  caption: 'Manipulação',
};

export const COLORS = {
  primary: '#C5243E',
  primaryDark: '#9B1A2E',
  secondary: '#243465',
  secondaryDark: '#1A2850',
  accent: '#4A90D9',
  lightRedBg: '#FEF0F2',
  lightRedBorder: '#FED7DB',
  lightBlueBg: '#EFF2FA',
  lightBlueBorder: '#D0DCE8',
  selectionBg: '#FED7DB',
  selectionColor: '#8C1A3D',
  navActive: '#FBBF24',
  navActiveBg: 'rgba(197, 36, 62, 0.2)',
  pinkSoft: '#fff0f3',
  blueSoft: '#f0f4ff',
  rowAlt: '#f8faff',
};

export const GRADIENTS = {
  primary: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
  secondary: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.secondaryDark})`,
};

export const LOGO = {
  original: {
    src: 'logo_nobg.webp',
    fallback: 'logo_nobg.png',
  },
  white: {
    src: 'logo_white_nobg.webp',
    fallback: 'logo_white_nobg.png',
  },
  // Quando src for null (ex.: versão genérica), renderiza o CrossIcon + texto
  textParts: [
    { text: 'Pix', color: COLORS.primary },
    { text: 'Farma', color: COLORS.accent },
  ],
};
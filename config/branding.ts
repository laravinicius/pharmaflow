// ─── Configuração central de marca ────────────────────────────────────────────
// Único arquivo que diferencia a versão genérica das versões por cliente.
// Sempre importe as cores da marca daqui (e não hex solto nos componentes),
// para que trocar de cliente = apenas editar este arquivo.

export const BRAND = {
  name: 'PharmaFlow',
  windowTitle: 'PharmaFlow - Manipulação',
  caption: 'Manipulação',
};

export const COLORS = {
  primary: '#111827',
  primaryDark: '#000000',
  secondary: '#000000',
  secondaryDark: '#111827',
  accent: '#374151',
  lightRedBg: '#fafafa',
  lightRedBorder: '#e4e4e7',
  lightBlueBg: '#f4f4f5',
  lightBlueBorder: '#e4e4e7',
  selectionBg: '#e4e4e7',
  selectionColor: '#111827',
  navActive: '#ffffff',
  navActiveBg: 'rgba(255, 255, 255, 0.15)',
  pinkSoft: '#fafafa',
  blueSoft: '#f4f4f5',
  rowAlt: '#f8f8f8',
};

export const GRADIENTS = {
  primary: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
  secondary: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.secondaryDark})`,
};

export const LOGO = {
  original: {
    src: null,
    fallback: null,
  },
  white: {
    src: null,
    fallback: null,
  },
  // Quando src for null (ex.: versão genérica), renderiza o CrossIcon + texto
  textParts: [
    { text: 'Pharma', color: COLORS.primary },
    { text: 'Flow', color: COLORS.accent },
  ],
};

import type { ClientProfile } from './types';

export default {
  id: 'pix-farma',
  brand: { name: 'PIX Farma', windowTitle: 'PIX Farma - Manipulação', caption: 'Manipulação',
    textParts: [{ text: 'Pix', color: '#C5243E' }, { text: 'Farma', color: '#4A90D9' }] },
  colors: {
    primary: '#C5243E', primaryDark: '#9B1A2E', secondary: '#243465', secondaryDark: '#1A2850',
    accent: '#4A90D9', lightRedBg: '#FEF0F2', lightRedBorder: '#FED7DB',
    lightBlueBg: '#EFF2FA', lightBlueBorder: '#D0DCE8', selectionBg: '#FED7DB',
    selectionColor: '#8C1A3D', navActive: '#FBBF24', navActiveBg: 'rgba(197, 36, 62, 0.2)',
    pinkSoft: '#fff0f3', blueSoft: '#f0f4ff', rowAlt: '#f8faff',
  },
  visual: {
    style: 'pix', bodyFont: "'DM Sans', sans-serif", headingFont: 'Georgia, serif',
    background: '#FAFAFA', surface: '#FFFFFF', text: '#18181B', border: '#E4E4E7',
    loginBackground: 'linear-gradient(135deg, #fff0f3 0%, #fff 50%, #f0f4ff 100%)',
  },
  assets: {
    logo: 'public/logo_nobg.webp', logoFallback: 'public/logo_nobg.png', logoWhite: 'public/logo_white_nobg.webp',
    symbol: 'public/logo_nobg.webp', symbolWhite: 'public/logo_white_nobg.webp', icon: 'public/icon.ico', fonts: [],
  },
  messages: {
    whatsappReady: `Olá!
Passando para avisar que seu manipulado já chegou aqui na Pix - Jardim Paulista! \u{1F9EA} \u{1F4A0}
Nosso horário de atendimento é das 08:00 às 20:00 De segunda a sábado.`,
  },
  modules: { formulas: true, customers: true, insumos: true, savedFormulas: true, users: true, audit: true, settings: true },
  rules: { inactivityTimeoutMs: 5 * 60 * 1000 },
  desktop: {
    appId: 'com.pharmaflow.app', packageName: 'pharmaflow', productName: 'PIX Farma',
    executableName: 'PIX Farma', userDataDirectory: 'pharmaflow',
    artifactName: 'PIX-Farma-Setup-${version}.${ext}', updaterCacheDirName: 'pharmaflow-updater',
  },
  // O endereço antigo redireciona para MagisForm. Preservado nos aplicativos instalados.
  distribution: { owner: 'laravinicius', repo: 'pharmaflow', releaseRepo: 'MagisForm', configured: true },
} satisfies ClientProfile;

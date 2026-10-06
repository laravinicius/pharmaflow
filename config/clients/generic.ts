import type { ClientProfile } from './types';

export default {
  id: 'generic',
  brand: { name: 'MagisForm', windowTitle: 'MagisForm - Manipulação', caption: 'Manipulação',
    textParts: [{ text: 'MagisForm', color: '#173E35' }] },
  colors: {
    primary: '#173E35', primaryDark: '#102D26', secondary: '#173E35', secondaryDark: '#102D26',
    accent: '#D95C4F', lightRedBg: '#DCE8E1', lightRedBorder: '#C6D8CC',
    lightBlueBg: '#FFFDF8', lightBlueBorder: '#DCDDD4', selectionBg: '#DCE8E1',
    selectionColor: '#173E35', navActive: '#FFFDF8', navActiveBg: 'rgba(220, 232, 225, 0.16)',
    pinkSoft: '#F4F1E9', blueSoft: '#DCE8E1', rowAlt: '#F4F1E9',
  },
  visual: {
    style: 'website', bodyFont: "'Atkinson Hyperlegible Next', 'Segoe UI', sans-serif",
    headingFont: 'Vollkorn, Georgia, serif', background: '#F4F1E9', surface: '#FFFDF8',
    text: '#17201D', border: '#DCDDD4', loginBackground: '#F4F1E9',
  },
  assets: {
    logo: 'website/assets/brand/logo-horizontal-green.svg', logoWhite: 'website/assets/brand/logo-horizontal-white.svg',
    symbol: 'website/assets/brand/symbol-green.svg', symbolWhite: 'website/assets/brand/symbol-white.svg',
    icon: 'website/assets/brand/favicon.svg',
    fonts: ['website/assets/fonts/atkinson-hyperlegible-next.woff', 'website/assets/fonts/vollkorn.woff',
      'website/assets/fonts/atkinson-OFL.txt', 'website/assets/fonts/vollkorn-OFL.txt'],
  },
  messages: { whatsappReady: 'Olá!\nSeu manipulado está pronto para retirada. Entre em contato com nossa equipe para combinar a retirada.' },
  modules: { formulas: true, customers: true, insumos: true, savedFormulas: true, users: true, audit: true, settings: true },
  rules: { inactivityTimeoutMs: 5 * 60 * 1000 },
  desktop: {
    appId: 'com.magisform.generic', packageName: 'magisform-generic', productName: 'MagisForm',
    executableName: 'MagisForm', userDataDirectory: 'magisform-generic',
    artifactName: 'MagisForm-Setup-${version}.${ext}', updaterCacheDirName: 'magisform-generic-updater',
  },
  // Destino reservado. Só habilitar após criar o repositório de distribuição e o segredo do CI.
  distribution: { owner: 'laravinicius', repo: 'MagisForm-generic-releases', releaseRepo: 'MagisForm-generic-releases', configured: false },
} satisfies ClientProfile;

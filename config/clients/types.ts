export interface ClientProfile {
  id: string;
  brand: { name: string; windowTitle: string; caption: string; textParts: { text: string; color: string }[] };
  colors: {
    primary: string; primaryDark: string; secondary: string; secondaryDark: string;
    accent: string; lightRedBg: string; lightRedBorder: string; lightBlueBg: string;
    lightBlueBorder: string; selectionBg: string; selectionColor: string;
    navActive: string; navActiveBg: string; pinkSoft: string; blueSoft: string; rowAlt: string;
  };
  visual: {
    style: 'pix' | 'website'; bodyFont: string; headingFont: string;
    background: string; surface: string; text: string; border: string; loginBackground: string;
  };
  assets: { logo: string; logoFallback?: string; logoWhite: string; symbol: string; symbolWhite: string; icon: string; fonts: string[] };
  messages: { whatsappReady: string };
  // Nesta etapa todos os módulos permanecem disponíveis; novas opções exigem UI e IPC.
  modules: {
    formulas: true; customers: true; insumos: true; savedFormulas: true;
    users: true; audit: true; settings: true;
  };
  rules: { inactivityTimeoutMs: number };
  desktop: {
    appId: string; packageName: string; productName: string; executableName: string;
    userDataDirectory: string; artifactName: string; updaterCacheDirName: string;
  };
  distribution: { owner: string; repo: string; releaseRepo: string; configured: boolean };
}

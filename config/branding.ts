// Fachada compatível com os imports existentes. O build fixa o perfil nos dois processos.
export const CLIENT = __CLIENT_PROFILE__;
export const BRAND = CLIENT.brand;
export const COLORS = CLIENT.colors;
export const MESSAGES = CLIENT.messages;
export const RULES = CLIENT.rules;
export const GRADIENTS = {
  primary: CLIENT.visual.style === 'website' ? COLORS.primary : `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
  secondary: CLIENT.visual.style === 'website' ? COLORS.secondary : `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.secondaryDark})`,
};
const asset = (source: string) => `brand/${source.split('/').pop()}`;
export const LOGO = {
  original: { src: asset(CLIENT.assets.logo), fallback: asset(CLIENT.assets.logoFallback ?? CLIENT.assets.logo) },
  white: { src: asset(CLIENT.assets.logoWhite), fallback: asset(CLIENT.assets.logoWhite) },
  symbol: { src: asset(CLIENT.assets.symbol), white: asset(CLIENT.assets.symbolWhite) },
  textParts: BRAND.textParts,
};

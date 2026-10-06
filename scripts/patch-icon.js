// Compatibilidade com chamadas antigas: prepara somente os assets temporários do perfil.
import { selectClient, prepareAssets } from './client-profile.mjs';
await prepareAssets(await selectClient());

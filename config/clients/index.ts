import pixFarma from './pix-farma';
import generic from './generic';
import type { ClientProfile } from './types';

export const CLIENT_PROFILES: Record<string, ClientProfile> = { 'pix-farma': pixFarma, generic };

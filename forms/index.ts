import { f01PersonalMarketing } from './f01-personal-marketing';
import { f13PicLokasi } from './f13-pic-lokasi';
import type { FormSchema } from './types';

export const formRegistry: Record<string, FormSchema> = {
  personal_marketing: f01PersonalMarketing,
  pic_lokasi: f13PicLokasi,
};

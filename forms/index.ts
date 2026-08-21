import { f01PersonalMarketing } from './f01-personal-marketing';
import type { FormSchema } from './types';

export const formRegistry: Record<string, FormSchema> = {
  personal_marketing: f01PersonalMarketing,
};

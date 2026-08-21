'use client';

import type { Field } from '../../forms/types';
import { LampiranInput } from './LampiranInput';

export function Lampiran({ field, reportId }: { field: Field; reportId?: string | null }) {
  return <LampiranInput name={field.key} reportId={reportId} fieldKeyAsli={field.key} />;
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

export type PolicyMap = Record<string, unknown>;

async function ambilPolicy(): Promise<PolicyMap> {
  const supabase = createClient();
  const { data, error } = await supabase.from('policy').select('key, value');
  if (error) throw error;

  const peta: PolicyMap = {};
  for (const baris of data ?? []) {
    peta[baris.key] = baris.value;
  }
  return peta;
}

export function usePolicy() {
  return useQuery({
    queryKey: ['policy'],
    queryFn: ambilPolicy,
    staleTime: 5 * 60 * 1000,
  });
}

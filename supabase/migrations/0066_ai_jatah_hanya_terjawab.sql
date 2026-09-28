-- Jatah pesan asisten AI hanya terpakai oleh pertanyaan yang DIJAWAB
-- (29 September 2026, instruksi CEO). Sebelum ini setiap pesan 'user'
-- dihitung saat disimpan -- kalau Gemini gagal (mis. 503 overloaded),
-- penanya kehilangan jatah tanpa pernah mendapat jawaban.
--
-- Aturan baru, satu tempat (ai_terpakai_hari_ini): pesan user hari ini
-- dihitung kalau
--   (a) sudah ada jawaban model yang menunjuk ke pesan itu (balasan_untuk), ATAU
--   (b) masih "dalam proses": dibuat < 2 menit lalu dan belum dijawab.
-- (b) menutup celah kirim banyak pertanyaan sekaligus sebelum jawabannya
-- tersimpan. Pertanyaan yang gagal berhenti dihitung sesudah 2 menit --
-- jatahnya kembali sendiri, tanpa perlu hapus/ubah baris (ai_pesan tetap
-- append-only).

begin;

alter table public.ai_pesan
  add column balasan_untuk uuid references public.ai_pesan(id) on delete cascade;
create index ai_pesan_balasan_untuk_idx on public.ai_pesan (balasan_untuk);

-- Jawaban lama: tautkan ke pesan user TERAKHIR sebelum jawaban itu di
-- percakapan yang sama.
update public.ai_pesan m set balasan_untuk = (
  select u.id from public.ai_pesan u
  where u.percakapan_id = m.percakapan_id and u.peran = 'user' and u.created_at <= m.created_at
  order by u.created_at desc limit 1
)
where m.peran = 'model' and m.balasan_untuk is null;

-- Hanya jawaban model yang boleh menunjuk, dan HANYA ke pesan user di
-- percakapan milik sendiri yang sama -- supaya tidak ada yang bisa menandai
-- pertanyaan orang lain "terjawab" (menghabiskan jatah orang lain).
alter table public.ai_pesan add constraint ai_pesan_balasan_hanya_model
  check (balasan_untuk is null or peran = 'model');

drop policy ai_pesan_insert on public.ai_pesan;
create policy ai_pesan_insert on public.ai_pesan for insert
  with check (
    user_id = auth.uid()
    and public.boleh_pakai_ai()
    and exists (select 1 from public.ai_percakapan c where c.id = percakapan_id and c.user_id = auth.uid())
    and (
      balasan_untuk is null
      or exists (
        select 1 from public.ai_pesan u
        where u.id = ai_pesan.balasan_untuk and u.percakapan_id = ai_pesan.percakapan_id and u.user_id = auth.uid() and u.peran = 'user'
      )
    )
  );

create or replace function public.ai_terpakai_hari_ini(p_user uuid)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.ai_pesan u
  where u.user_id = p_user and u.peran = 'user'
    and u.created_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')
    and (
      exists (select 1 from public.ai_pesan m where m.balasan_untuk = u.id)
      or u.created_at > now() - interval '2 minutes'
    );
$$;
revoke all on function public.ai_terpakai_hari_ini(uuid) from public, anon, authenticated;

create or replace function public.ai_status()
returns table (aktif boolean, boleh boolean, batas int, terpakai int)
language sql stable security definer set search_path = public as $$
  with p as (
    select
      coalesce((select (value #>> '{}')::int from public.policy where key = 'ai_batas_pesan_harian'), 0) as batas,
      coalesce((select jsonb_array_length(value) from public.policy
                where key = 'ai_peran_boleh' and jsonb_typeof(value) = 'array'), 0) as jumlah_peran
  )
  select
    p.batas > 0 and p.jumlah_peran > 0,
    public.boleh_pakai_ai(),
    p.batas,
    public.ai_terpakai_hari_ini(auth.uid())
  from p;
$$;

create or replace function public.ai_jaga_batas_pesan()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_batas int;
begin
  if new.peran <> 'user' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('ai_batas_pesan:' || new.user_id::text));
  v_batas := coalesce((select (value #>> '{}')::int from public.policy where key = 'ai_batas_pesan_harian'), 0);
  if v_batas <= 0 then
    raise exception 'AI_TIDAK_AKTIF' using errcode = 'P0001';
  end if;
  if public.ai_terpakai_hari_ini(new.user_id) >= v_batas then
    raise exception 'BATAS_PESAN_AI:%', v_batas using errcode = 'P0001';
  end if;
  return new;
end $$;

commit;

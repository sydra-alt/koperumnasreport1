-- CEO (6 September 2026): divisi Ery diperbarui dari 'IT' ke 'Indokopi' --
-- jabatannya masih boleh menyebut IT/DTI, tapi `divisi` yang menentukan
-- `is_hrd_kadiv()` dan pengelompokan laporan harus mencerminkan tempat
-- kerjanya SEKARANG (manager Indokopi Jatinegara), bukan riwayat divisinya.
update public.profile set divisi = 'Indokopi' where nama = 'Ery';

import { f01PersonalMarketing } from './f01-personal-marketing';
import { f13PicLokasi } from './f13-pic-lokasi';
import { f14Hrd } from './f14-hrd';
import { f14Security } from './f14-security';
import { f14Perizinan } from './f14-perizinan';
import { f14It } from './f14-it';
import { f15Pembangunan } from './f15-pembangunan';
import { f15Dti } from './f15-dti';
import { f15Kendaraan } from './f15-kendaraan';
import { f15Cs } from './f15-cs';
import { f15Ga } from './f15-ga';
import { f16ManagerResto } from './f16-manager-resto';
import { f16Thrifting } from './f16-thrifting';
import { f16KontrolFnb } from './f16-kontrol-fnb';
import { f17Accounting } from './f17-accounting';
import { f21Pusat } from './f21-pusat';
import type { FormSchema } from './types';

export const formRegistry: Record<string, FormSchema> = {
  personal_marketing: f01PersonalMarketing,
  pic_lokasi: f13PicLokasi,
  hrd: f14Hrd,
  security: f14Security,
  perizinan: f14Perizinan,
  it: f14It,
  pembangunan: f15Pembangunan,
  dti: f15Dti,
  kendaraan: f15Kendaraan,
  cs: f15Cs,
  ga: f15Ga,
  manager_resto: f16ManagerResto,
  thrifting: f16Thrifting,
  kontrol_fnb: f16KontrolFnb,
  accounting: f17Accounting,
  pusat: f21Pusat,
};

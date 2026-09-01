import { localeTag } from '@/i18n/i18n';

export const eur = (n: number): string =>
  new Intl.NumberFormat(localeTag(), {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

export const pct = (n: number): string => `${n}%`;

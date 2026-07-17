export const eur = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

export const pct = (n: number): string => `${n}%`;

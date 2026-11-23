import type { Mode } from './types';

export const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'int', label: 'Integer', hint: 'whole numbers in the range' },
  { value: 'dec', label: 'Decimal', hint: 'decimal fractions with fixed precision' },
];

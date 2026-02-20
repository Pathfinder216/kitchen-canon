import { formatScaledAmount } from './useScaling';

describe('formatScaledAmount', () => {
  it('returns empty string for null', () => {
    expect(formatScaledAmount(null)).toBe('');
  });

  it('formats integers without decimals', () => {
    expect(formatScaledAmount(2)).toBe('2');
    expect(formatScaledAmount(10)).toBe('10');
  });

  it('uses fraction glyphs for common fractions', () => {
    expect(formatScaledAmount(0.5)).toBe('½');
    expect(formatScaledAmount(0.25)).toBe('¼');
    expect(formatScaledAmount(0.75)).toBe('¾');
    expect(formatScaledAmount(0.333)).toBe('⅓');
  });

  it('combines whole number with fraction', () => {
    expect(formatScaledAmount(1.5)).toBe('1 ½');
    expect(formatScaledAmount(2.25)).toBe('2 ¼');
  });

  it('falls back to decimal for unusual amounts', () => {
    expect(formatScaledAmount(1.3)).toBe('1.3');
    expect(formatScaledAmount(3.14)).toBe('3.14');
  });

  it('trims trailing zeros', () => {
    expect(formatScaledAmount(1.10)).toBe('1.1');
    expect(formatScaledAmount(2.00)).toBe('2');
  });
});

import { describe, it, expect } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('returns empty string for null, undefined, and zero', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(undefined)).toBe('');
    expect(formatDuration(0)).toBe('');
  });

  it('shows sub-hour values as minutes only', () => {
    expect(formatDuration(45)).toBe('45 min');
  });

  it('rounds fractional minutes to the nearest minute', () => {
    expect(formatDuration(59.6)).toBe('1 h'); // rounds to 60
    expect(formatDuration(45.4)).toBe('45 min');
  });

  it('formats whole hours without minutes', () => {
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(120)).toBe('2 h');
  });

  it('formats hours and minutes together', () => {
    expect(formatDuration(61)).toBe('1 h 1 min');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(135)).toBe('2 h 15 min');
  });
});

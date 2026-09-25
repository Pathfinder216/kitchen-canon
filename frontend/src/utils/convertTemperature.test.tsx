import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { annotateTemperatures, annotateTemperaturesText, convertTemperature } from './convertTemperature';

describe('convertTemperature', () => {
  it('rounds oven temperatures the way oven charts do', () => {
    expect(convertTemperature(350, 'F')).toBe(180);
    expect(convertTemperature(375, 'F')).toBe(190);
    expect(convertTemperature(400, 'F')).toBe(200);
    expect(convertTemperature(425, 'F')).toBe(220);
    expect(convertTemperature(180, 'C')).toBe(350);
    expect(convertTemperature(200, 'C')).toBe(400);
    expect(convertTemperature(220, 'C')).toBe(425);
  });

  it('keeps whole-degree precision below oven range', () => {
    expect(convertTemperature(110, 'F')).toBe(43);
    expect(convertTemperature(165, 'F')).toBe(74);
    expect(convertTemperature(63, 'C')).toBe(145);
  });
});

describe('annotateTemperaturesText', () => {
  const metric = (s: string) => annotateTemperaturesText(s, 'metric');
  const imperial = (s: string) => annotateTemperaturesText(s, 'imperial');

  it('appends the conversion rather than replacing', () => {
    expect(metric('Heat oven to 400°F.')).toBe('Heat oven to 400°F (200°C).');
  });

  it('matches the common spellings', () => {
    expect(metric('Bake at 400 °F')).toBe('Bake at 400 °F (200°C)');
    expect(metric('Bake at 400 degrees Fahrenheit')).toBe('Bake at 400 degrees Fahrenheit (200°C)');
    expect(metric('Bake at 350 degrees F')).toBe('Bake at 350 degrees F (180°C)');
    expect(imperial('Bake at 200C')).toBe('Bake at 200C (400°F)');
    expect(imperial('Bake at 180 °C until golden')).toBe('Bake at 180 °C (350°F) until golden');
    expect(imperial('Bake at 180 degrees celsius')).toBe('Bake at 180 degrees celsius (350°F)');
  });

  it('does not touch temperatures already in the target system', () => {
    expect(metric('Bake at 200°C')).toBe('Bake at 200°C');
    expect(imperial('Bake at 400°F')).toBe('Bake at 400°F');
  });

  it('guards against false positives', () => {
    const plain = [
      'step 3 of 4',
      'Add 12 cups of stock',
      'Add 2 c flour',
      'Add 12c water', // bare lowercase letter: a cup, not °C
      'Cook 350 degrees for 20 minutes', // no scale given
      'Bake at 400° for 20 minutes',
      'Use a 1400W microwave',
    ];
    for (const s of plain) {
      expect(metric(s), s).toBe(s);
      expect(imperial(s), s).toBe(s);
    }
  });

  it('skips temperatures the author already paired with a conversion', () => {
    expect(metric('Heat oven to 400°F (200°C)')).toBe('Heat oven to 400°F (200°C)');
    expect(imperial('Heat oven to 200°C / 400°F')).toBe('Heat oven to 200°C / 400°F');
  });

  it('converts every temperature in a step', () => {
    expect(metric('Start at 450°F, then drop to 350°F')).toBe(
      'Start at 450°F (230°C), then drop to 350°F (180°C)',
    );
  });

  it('is a no-op for the original preference', () => {
    expect(annotateTemperaturesText('Heat oven to 400°F', 'original')).toBe('Heat oven to 400°F');
  });
});

describe('annotateTemperatures (React nodes)', () => {
  it('renders the conversion as a styled annotation span', () => {
    const { container } = render(<p>{annotateTemperatures('Heat oven to 400°F now', 'metric')}</p>);
    expect(container.textContent).toBe('Heat oven to 400°F (200°C) now');
    const span = container.querySelector('[data-converted-temperature]');
    expect(span?.textContent).toBe('(200°C)');
  });

  it('returns the text as-is when nothing converts', () => {
    expect(annotateTemperatures('Stir well', 'metric')).toEqual(['Stir well']);
  });
});

import { describe, expect, it } from 'vitest';
import { styles } from '../styles';
import { qrPlaceholder } from './placeholder';
import { qrToSvg } from './image';

describe('qrPlaceholder', () => {
  it('is a flat SVG that fills its container, with the city colors', () => {
    const svg = qrPlaceholder({ data: 'https://example.com', style: 'costera' });
    expect(svg.startsWith('<svg width="100%" height="100%" ')).toBe(true);
    expect(svg).toContain(`fill="${styles.costera.palette.roof}"`);
    expect(svg).toContain(`fill="${styles.costera.palette.ground}"`);
  });

  it('is the very same code the city draws', () => {
    const plain = qrToSvg('https://example.com', { dark: styles.moderna.palette.roof, light: styles.moderna.palette.ground });
    expect(qrPlaceholder({ data: 'https://example.com' }).replace(' width="100%" height="100%"', '')).toBe(plain);
  });

  it('uses level H with a plaza, as the city does', () => {
    const withPlaza = qrPlaceholder({ data: 'https://example.com', plaza: true });
    expect(withPlaza).toBe(qrPlaceholder({ data: 'https://example.com', errorCorrection: 'H' }));
    expect(withPlaza).not.toBe(qrPlaceholder({ data: 'https://example.com' }));
  });

  it('keeps roof and ground colors at night (the code scans the same)', () => {
    expect(qrPlaceholder({ data: 'hola', style: 'nevada', time: 'night' })).toBe(qrPlaceholder({ data: 'hola', style: 'nevada' }));
  });

  it('puts the title in the image', () => {
    expect(qrPlaceholder({ data: 'hola', title: 'Mi QR' })).toContain('<title>Mi QR</title>');
  });

  it('rejects invalid data like the city does', () => {
    expect(() => qrPlaceholder({ data: '' })).toThrow(/non-empty/);
  });
});

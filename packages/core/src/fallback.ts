import { qrToSvg } from './qr/image';
import type { QrCityEcc, QrCityStyle } from './types';

export interface FlatQr {
  /** Shows another code (or the same one in other colors). */
  update(data: string, errorCorrection: QrCityEcc, style: QrCityStyle): void;
  dispose(): void;
}

/**
 * A plain, scannable QR drawn inside `host`: what people get when WebGL is not available (or the
 * GPU context was lost for good). It uses the style's dark roof and light ground colors, so it keeps
 * the look of the city and the same contrast.
 *
 * `overlay`: lay it over an existing canvas instead of replacing the content.
 */
export function mountFlatQr(
  host: HTMLElement,
  initial: { data: string; errorCorrection: QrCityEcc; style: QrCityStyle; label: string },
  overlay = false,
): FlatQr {
  const box = document.createElement('div');
  box.dataset.qrCity = 'fallback';
  box.style.cssText =
    `${overlay ? 'position:absolute;inset:0;' : 'position:relative;width:100%;height:100%;'}` +
    'display:flex;align-items:center;justify-content:center;overflow:hidden';
  host.appendChild(box);

  function render(data: string, errorCorrection: QrCityEcc, style: QrCityStyle) {
    const { roof, ground } = style.palette;
    box.style.background = ground;
    box.innerHTML = qrToSvg(data, { errorCorrection, dark: roof, light: ground, title: initial.label });
    const svg = box.firstElementChild as SVGElement;
    // A square that fits the box, whatever its shape.
    svg.style.cssText = 'display:block;width:100%;height:100%;max-width:100%;max-height:100%;aspect-ratio:1/1';
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
  render(initial.data, initial.errorCorrection, initial.style);

  return {
    update: render,
    dispose: () => box.remove(),
  };
}

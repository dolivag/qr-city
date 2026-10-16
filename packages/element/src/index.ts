import { QrCityElement } from './qr-city-element';

export { QrCityElement } from './qr-city-element';
export type { QrCityEventMap } from './qr-city-element';
export type {
  QrCityController,
  QrCityIntroStage,
  QrCityOptions,
  QrCityStyle,
  QrCityStyleId,
  QrCityView,
} from '@qr-city/core';

/** Registers the custom element. Safe to call on the server and more than once. */
export function defineQrCity(tagName = 'qr-city'): void {
  if (typeof customElements === 'undefined') return;
  if (customElements.get(tagName)) return;
  // A constructor can only be registered once, so extra tag names get their own subclass.
  customElements.define(tagName, tagName === 'qr-city' ? QrCityElement : class extends QrCityElement {});
}

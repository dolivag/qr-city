import type { QrCityStyle } from '../types';

export const nevada: QrCityStyle = {
  id: 'nevada',
  name: 'Nevada',
  description: 'Chalets de madera, pinos y nieve cayendo',
  palette: {
    sky: '#eef2f7',
    hemiSky: '#f7faff',
    hemiGround: '#dfe5ee',
    hemiIntensity: 1.0,
    sun: '#fff6ec',
    sunIntensity: 0.45,
    walk: '#fbfcfe',
    ground: '#f7f9fc',
    road: '#e6ebf2',
    dash: '#ffffff',
    base: '#dde4ee',
    roof: '#3a3550',
    towers: ['#d9b99b', '#c9a383', '#e4cdb4', '#bfa08a'],
    houses: ['#d9b99b', '#e4cdb4', '#cfae92', '#ead9c6'],
  },
  buildings: { houseBias: 0.55, skyBias: 0.9, heightMul: 0.45, windowColor: '#f3e7c9' },
  vegetation: { kind: 'pine', colors: ['#7fae98', '#8fbaa4', '#6f9f8c'] },
  traffic: { carColors: ['#f4a5a0', '#9cc2f0', '#ffffff', '#f6d38a'] },
  flyers: { kind: 'snow', color: '#ffffff' },
  quietZone: 5,
};

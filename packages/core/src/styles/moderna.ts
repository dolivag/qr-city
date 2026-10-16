import type { QrCityStyle } from '../types';

export const moderna: QrCityStyle = {
  id: 'moderna',
  name: 'Moderna',
  description: 'Rascacielos pastel, parques y pájaros',
  palette: {
    sky: '#eef1f8',
    hemiSky: '#f4f6ff',
    hemiGround: '#d8cfe0',
    hemiIntensity: 0.95,
    sun: '#fff3e2',
    sunIntensity: 0.55,
    walk: '#f3f4f8',
    ground: '#eef0f6',
    road: '#dfe4ee',
    dash: '#ffffff',
    base: '#cfd5e2',
    roof: '#36415f',
    towers: ['#bfe3d4', '#f6cdb8', '#d5cff2', '#bcd7f0', '#f3e4ad', '#f2c6d6'],
    houses: ['#fbe3d3', '#e3eefa', '#e6f4e8', '#f8eecb'],
  },
  buildings: { houseBias: 0.15, skyBias: 0.5, heightMul: 1, windowColor: '#c9d2e3' },
  vegetation: { kind: 'round', colors: ['#a8d5b0', '#bfe0a8', '#9fd0c0'] },
  traffic: { carColors: ['#f4a5a0', '#f6d38a', '#9cc2f0', '#ffffff', '#a6dcc0', '#c8b8f0'] },
  flyers: { kind: 'birds', color: '#ffffff' },
  quietZone: 5,
};

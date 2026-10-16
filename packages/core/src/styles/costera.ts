import type { QrCityStyle } from '../types';

export const costera: QrCityStyle = {
  id: 'costera',
  name: 'Costera',
  description: 'Casas blancas, palmeras, barcos y gaviotas',
  palette: {
    sky: '#e4f4f6',
    hemiSky: '#f2fbff',
    hemiGround: '#e8dcc4',
    hemiIntensity: 0.95,
    sun: '#fff1d6',
    sunIntensity: 0.6,
    walk: '#f7f1e3',
    ground: '#f6f2e8',
    road: '#e7e2d4',
    dash: '#ffffff',
    base: '#9fd3df',
    water: '#c4e7ee',
    roof: '#2a4d5c',
    towers: ['#ffffff', '#d8eef5', '#f6e7c8', '#cde7e3', '#f3d6c9'],
    houses: ['#ffffff', '#f4f8fb', '#f9efdc', '#e3f2f4'],
  },
  buildings: { houseBias: 0.4, skyBias: 0.82, heightMul: 0.55, windowColor: '#9fc7d6' },
  vegetation: { kind: 'palm', colors: ['#8fcf9e', '#a5d98a'] },
  traffic: { carColors: ['#ffffff', '#f6d38a', '#8fd0de', '#f4a5a0', '#b8e3c8'] },
  flyers: { kind: 'gulls', color: '#ffffff' },
  quietZone: 6,
};

import { styles } from '@qr-city/core';
import type { QrCityStyle } from '@qr-city/core';

/**
 * "Papel y tinta": a warm, restrained palette for the demo (bone / sand / stone towers,
 * one terracotta accent). Keeps the scannability invariant: ink roofs on light ground.
 */
export const paper: QrCityStyle = {
  ...styles.moderna,
  id: 'papel',
  name: 'Papel',
  description: 'Hueso, arena y piedra con un único acento terracota',
  palette: {
    sky: '#EFEBE2',
    hemiSky: '#F7F3EA',
    hemiGround: '#CFC6B4',
    hemiIntensity: 0.95,
    sun: '#FFF1DC',
    sunIntensity: 0.6,
    walk: '#F5F2E9',
    ground: '#F0ECE2',
    road: '#DDD7C8',
    dash: '#FBF8F0',
    base: '#C9C0AE',
    roof: '#1C1B18',
    towers: ['#E4DCCB', '#D9C7A8', '#BFB8A8', '#E9E2D2', '#CDB59A', '#D3CCBC', '#C9C0AE', '#C2441F'],
    houses: ['#EDE3D1', '#E2D5BD', '#F1EADB', '#DCCDB4'],
  },
  buildings: { ...styles.moderna.buildings, windowColor: '#B9AF9B' },
  vegetation: { kind: 'round', colors: ['#8FA07A', '#A3B28A', '#7F9475'] },
  traffic: { carColors: ['#C2441F', '#1C1B18', '#F7F4EC', '#8A857A', '#D9C7A8'] },
  flyers: { kind: 'birds', color: '#3A372F' },
  door: {
    background: '#E9E3D6',
    veil: '#F7F3EA',
    light: { sky: '#FFFFFF', ground: '#D8CFBE', intensity: 0.9, sun: '#FFF1DC', sunIntensity: 0.5 },
    frame: '#34312B',
    frameDark: '#1C1B18',
    panel: '#C2441F',
    panelRaised: '#CF5A36',
    brass: '#C8A25A',
    plaque: { frame: '#E9E0CC', paper: '#F7F3EA', ink: '#1C1B18' },
    step: '#D9D2C0',
    mat: '#BDB4A0',
    pot: '#C9B79A',
    plants: ['#8FA07A', '#A3B28A', '#7F9475'],
    floaters: ['#E4DCCB', '#D9C7A8', '#BFB8A8', '#CDB59A', '#E9E2D2'],
    glow: '#FFF8EA',
    warm: '#FFEFD6',
    lobbyFloor: '#D9D2C0',
  },
};

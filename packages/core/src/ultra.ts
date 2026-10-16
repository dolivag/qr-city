import { BoxGeometry, CylinderGeometry, Mesh, SphereGeometry } from 'three';
import { registerUltra } from './scene/ultraKit';

/**
 * Importing this entry point turns on the extra detail of `quality: 'ultra'`:
 * bumpers, grilles, roof antennas and pillars on cars; root flares and thicker branching on trees.
 * It has no exports: the import itself registers the kit.
 */
registerUltra({
  decorateCar(car, k, { geo, lambert, basic }, { trim }) {
    const bumperF = geo(new BoxGeometry(0.03, 0.045, 0.2));
    const grille = geo(new BoxGeometry(0.012, 0.03, 0.12));
    const pillar = geo(new BoxGeometry(0.014, 0.075, 0.012));
    const antenna = geo(new CylinderGeometry(0.003, 0.003, 0.09, 5).translate(0, 0.045, 0));
    const plate = geo(new BoxGeometry(0.004, 0.022, 0.05));
    const plateMat = basic(0xf4f1e6);
    const place = (mesh: Mesh, x: number, y: number, z: number) => {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      car.add(mesh);
    };
    place(new Mesh(bumperF, trim), k.front + 0.005, 0.09, 0);
    place(new Mesh(bumperF, trim), k.rear - 0.005, 0.09, 0);
    place(new Mesh(grille, lambert(0x2a2f3d)), k.front + 0.022, 0.125, 0);
    place(new Mesh(plate, plateMat), k.rear - 0.022, 0.11, 0);
    for (const z of [-0.088, 0.088]) place(new Mesh(pillar, trim), k.mirrorX - 0.012, k.mirrorY + 0.035, z);
    place(new Mesh(antenna, trim), k.mirrorX - 0.14, k.mirrorY + 0.065, 0.07);
  },

  decorateTree(tree, kind, { geo, lambert }, s) {
    const bark = lambert(0xa98468);
    const flare = geo(new CylinderGeometry(0.045, 0.07, 0.06, 10).translate(0, 0.03, 0));
    const rootGeo = geo(new SphereGeometry(0.03, 8, 6).scale(1.6, 0.5, 0.8));
    if (kind === 'neon') return;
    const base = new Mesh(flare, bark);
    base.scale.setScalar(s);
    base.castShadow = true;
    tree.add(base);
    for (let i = 0; i < 4; i++) {
      const r = new Mesh(rootGeo, bark);
      const a = (i / 4) * Math.PI * 2 + 0.5;
      r.position.set(Math.cos(a) * 0.05 * s, 0.008, Math.sin(a) * 0.05 * s);
      r.rotation.y = -a;
      tree.add(r);
    }
  },
});

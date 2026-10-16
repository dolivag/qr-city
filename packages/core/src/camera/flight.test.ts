import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createFlight, FLIGHT_END } from './flight';
import { fitHalfHeight, ISO } from './ortho';

const door = new Vector3(3.5, 0, -2.5);
const d = new Vector3(1, 0, 0);

describe('door flight', () => {
  it('ends where the orthographic isometric camera starts (seamless swap)', () => {
    const size = 41;
    const aspect = 1.5;
    const cam = new PerspectiveCamera();
    createFlight(d, door, size).place(FLIGHT_END, cam, aspect);
    // Visible half-height at the target distance must match the ortho frame.
    const dist = cam.position.distanceTo(new Vector3(0, 3, 0));
    const visible = dist * Math.tan((cam.fov * Math.PI) / 360);
    expect(cam.fov).toBeCloseTo(2, 5);
    expect(visible).toBeCloseTo(fitHalfHeight(size, 0, aspect), 4);
    // And it looks along the isometric direction.
    const dir = new Vector3(0, 3, 0).sub(cam.position).normalize();
    const polar = Math.acos(-dir.y);
    expect(polar).toBeCloseTo(ISO.polar, 4);
  });

  it('starts inside the lobby, behind the facade', () => {
    const cam = new PerspectiveCamera();
    createFlight(d, door, 41).place(0, cam, 1);
    expect((cam.position.clone().sub(door)).dot(d)).toBeLessThan(0);
  });

  it('keeps the door open while leaving and closes it by the time the camera settles', () => {
    const cam = new PerspectiveCamera();
    const f = createFlight(d, door, 41);
    expect(f.place(1, cam, 1)).toBeCloseTo(-1.9);
    expect(f.place(3.8, cam, 1)).toBeCloseTo(0);
    expect(f.place(FLIGHT_END, cam, 1)).toBeCloseTo(0);
  });

  it('has a continuous camera path', () => {
    const f = createFlight(d, door, 41);
    const cam = new PerspectiveCamera();
    let prev: Vector3 | null = null;
    for (let t = 0; t <= FLIGHT_END; t += 0.05) {
      f.place(t, cam, 1);
      // The dolly zoom pulls back exponentially, so compare each step with the distance travelled so far.
      if (prev) expect(cam.position.distanceTo(prev)).toBeLessThan(0.2 * Math.max(1, cam.position.length()));
      prev = cam.position.clone();
    }
  });
});

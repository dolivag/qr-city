import { describe, expect, it } from 'vitest';
import { createGovernor } from './adaptive';

/** Feeds `n` frames of `ms` and counts the step-downs. */
const run = (g: ReturnType<typeof createGovernor>, ms: number, n: number) => {
  let steps = 0;
  for (let i = 0; i < n; i++) if (g.sample(ms)) steps++;
  return steps;
};

describe('createGovernor', () => {
  it('never steps down on a smooth device', () => {
    expect(run(createGovernor(), 16, 5000)).toBe(0);
  });

  it('steps down after two slow windows, past the warm-up', () => {
    const g = createGovernor();
    // 1.5 s of warm-up (30 frames of 50 ms), then two windows of 40 frames (2 s each)
    expect(run(g, 50, 30 + 79)).toBe(0);
    expect(run(g, 50, 1)).toBe(1);
  });

  it('acts within seconds even on a very slow device (1 fps)', () => {
    const g = createGovernor();
    // warm-up: 2 frames; each window closes after 3 frames
    expect(run(g, 1000, 2 + 5)).toBe(0);
    expect(run(g, 1000, 1)).toBe(1);
  });

  it('one slow window between fast ones is not enough', () => {
    const g = createGovernor();
    run(g, 16, 100);
    expect(run(g, 50, 40) + run(g, 16, 60) + run(g, 50, 40) + run(g, 16, 60)).toBe(0);
  });

  it('ignores the page being away (hidden tab)', () => {
    expect(run(createGovernor(), 5000, 500)).toBe(0);
  });

  it('waits a warm-up again after a step down', () => {
    const g = createGovernor();
    expect(run(g, 50, 30 + 80)).toBe(1);
    expect(run(g, 50, 30 + 79)).toBe(0);
    expect(run(g, 50, 1)).toBe(1);
  });
});

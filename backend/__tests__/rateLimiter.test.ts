import { createRateLimiter } from '../src/utils/rateLimiter';

describe('rateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('blocks after limit and resets after window', () => {
    const rl = createRateLimiter();
    expect(rl.allow('key', 3, 1000)).toBe(true);
    expect(rl.allow('key', 3, 1000)).toBe(true);
    expect(rl.allow('key', 3, 1000)).toBe(true);
    // 4th call should be blocked
    expect(rl.allow('key', 3, 1000)).toBe(false);

    // advance past window
    jest.advanceTimersByTime(1001);

    // counter should reset
    expect(rl.allow('key', 3, 1000)).toBe(true);
  });
});

import { rules5e, rules2024 } from './index.js';

describe('race-rules/index', () => {
  it('exports rules5e as a defined value', () => {
    expect(rules5e).toBeDefined();
  });

  it('exports rules2024 as a defined value', () => {
    expect(rules2024).toBeDefined();
  });

  it('exports are different objects', () => {
    expect(rules5e).not.toBe(rules2024);
  });
});

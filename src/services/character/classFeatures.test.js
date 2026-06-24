// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Top-level hoisted mocks — these are called once, but the factories
// capture the module-scoped variables which are reset in beforeEach.
vi.mock('./classRules.js', () => ({ default: {} }));
vi.mock('./classRules2024.js', () => ({ default: {} }));

describe('classFeatures.getClassFeatures', () => {
  let mockedClassRules;
  let mockedClassRules2024;

  beforeEach(async () => {
    // Get the mocked module instances after hoisted mocks are resolved
    const classRulesModule = await import('./classRules.js');
    const classRules2024Module = await import('./classRules2024.js');
    mockedClassRules = classRulesModule.default;
    mockedClassRules2024 = classRules2024Module.default;

    // Clear all properties from previous tests
    const clear = (obj) => {
      const keys = Object.keys(obj);
      for (const key of keys) {
        delete obj[key];
      }
    };
    clear(mockedClassRules);
    clear(mockedClassRules2024);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makePlayerStats = (overrides = {}) => ({
    rules: '5e',
    class: { name: 'Bard' },
    level: 1,
    ...overrides,
  });

  const classes = [
    'Bard', 'Cleric', 'Druid', 'Paladin', 'Sorcerer',
    'Warlock', 'Wizard', 'Monk', 'Rogue', 'Ranger',
  ];

  for (const ruleSet of ['5e', '2024']) {
    for (const className of classes) {
      const getFeatureMethod = `get${className}Features`;
      const expectedReturn = { [className]: true };

      it(`returns feature object for ${className} with ${ruleSet} ruleset`, async () => {
        const mock = ruleSet === '5e' ? mockedClassRules : mockedClassRules2024;
        mock[getFeatureMethod] = vi.fn(() => expectedReturn);
        const { getClassFeatures } = await import('./classFeatures.js');

        const result = getClassFeatures(makePlayerStats({ rules: ruleSet, class: { name: className } }));

        expect(result).toEqual(expectedReturn);
        expect(mock[getFeatureMethod]).toHaveBeenCalledTimes(1);
        expect(mock[getFeatureMethod]).toHaveBeenCalledWith(expect.objectContaining({ rules: ruleSet, class: { name: className } }));
      });

      it(`does not call the other ruleset module for ${className} ${ruleSet}`, async () => {
        const mock = ruleSet === '5e' ? mockedClassRules : mockedClassRules2024;
        const otherMock = ruleSet === '5e' ? mockedClassRules2024 : mockedClassRules;
        const otherMethod = `get${className}Features`;
        mock[getFeatureMethod] = vi.fn(() => expectedReturn);
        otherMock[otherMethod] = vi.fn(() => ({ wrong: true }));
        const { getClassFeatures } = await import('./classFeatures.js');

        getClassFeatures(makePlayerStats({ rules: ruleSet, class: { name: className } }));

        expect(otherMock[otherMethod]).not.toHaveBeenCalled();
      });
    }
  }

  it('returns null for unknown class name', async () => {
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures(makePlayerStats({ class: { name: 'UnknownClass' } }));
    expect(result).toBeNull();
  });

  it('returns null when class property is missing', async () => {
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e' });
    expect(result).toBeNull();
  });

  it('returns null when class property is null', async () => {
    const { getClassFeatures } = await import('./classFeatures.js');
    const result = getClassFeatures({ rules: '5e', class: null });
    expect(result).toBeNull();
  });

  it('throws when playerStats is null', async () => {
    const { getClassFeatures } = await import('./classFeatures.js');
    expect(() => getClassFeatures(null)).toThrow(TypeError);
  });

  it('returns undefined when class method exists but returns undefined', async () => {
    const { getClassFeatures } = await import('./classFeatures.js');
    mockedClassRules.getBardFeatures = vi.fn(() => undefined);
    const result = getClassFeatures(makePlayerStats());
    expect(result).toBeUndefined();
  });

  it('passes the full playerStats object to the class method', async () => {
    const capturedArgs = [];
    mockedClassRules.getBardFeatures = vi.fn((arg) => {
      capturedArgs.push(arg);
      return { received: true };
    });
    const { getClassFeatures } = await import('./classFeatures.js');
    const inputStats = makePlayerStats({ level: 5, class: { name: 'Bard', subclass: { name: 'Lore' } } });
    getClassFeatures(inputStats);
    expect(capturedArgs.length).toBe(1);
    expect(capturedArgs[0]).toEqual(inputStats);
  });
});

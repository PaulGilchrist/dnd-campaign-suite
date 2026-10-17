// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./classRules.js', () => ({ default: {} }));
vi.mock('./classRules2024.js', () => ({ default: {} }));

const clearObj = (obj) => {
  const keys = Object.keys(obj);
  for (const key of keys) {
    delete obj[key];
  }
};

const KNOWN_CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Sorcerer', 'Warlock', 'Wizard', 'Monk', 'Rogue', 'Ranger'];

describe('classFeatures.getClassFeatures', () => {
  let mockedClassRules;
  let mockedClassRules2024;
  let getClassFeatures;

  beforeEach(async () => {
    const classRulesModule = await import('./classRules.js');
    const classRules2024Module = await import('./classRules2024.js');
    mockedClassRules = classRulesModule.default;
    mockedClassRules2024 = classRules2024Module.default;

    clearObj(mockedClassRules);
    clearObj(mockedClassRules2024);

    ({ getClassFeatures } = await import('./classFeatures.js'));
  });

  const makePlayerStats = (overrides = {}) => ({
    rules: '5e',
    class: { name: 'Bard' },
    level: 1,
    ...overrides,
  });

  // rules field selects module: only '2024' routes to classRules2024; '5e' and
  // undefined (legacy characters) fall back to classRules.
  it.each([
    ['2024', '2024'],
    ['5e', '5e'],
    [undefined, '5e'],
  ])('routes rules=%s to the %s module', async (rules, expectedModule) => {
    const target = expectedModule === '2024' ? mockedClassRules2024 : mockedClassRules;
    const other = expectedModule === '2024' ? mockedClassRules : mockedClassRules2024;
    target.getBardFeatures = vi.fn(() => ({ ruleset: expectedModule }));
    other.getBardFeatures = vi.fn(() => ({ ruleset: expectedModule === '2024' ? '5e' : '2024' }));

    const result = getClassFeatures(makePlayerStats({ rules }));

    expect(target.getBardFeatures).toHaveBeenCalledTimes(1);
    expect(other.getBardFeatures).not.toHaveBeenCalled();
    expect(result).toEqual({ ruleset: expectedModule });
  });

  // FEATURE_GETTERS maps exactly the ten classes both ruleset modules implement
  // (Barbarian/Fighter render via class_levels elsewhere and are absent by design).
  it.each([
    ['5e', 'classRules'],
    ['2024', 'classRules2024'],
  ])('delegates each known class to get%sFeatures (%s)', async (rules, moduleName) => {
    const target = moduleName === 'classRules2024' ? mockedClassRules2024 : mockedClassRules;

    for (const className of KNOWN_CLASSES) {
      const method = `get${className}Features`;
      target[method] = vi.fn(() => ({ [className]: true }));

      const result = getClassFeatures(makePlayerStats({ rules, class: { name: className } }));

      expect(result).toEqual({ [className]: true });
      expect(target[method]).toHaveBeenCalledTimes(1);
    }
  });

  it('passes the full playerStats object through to the class method', async () => {
    const inputStats = makePlayerStats({ level: 5, class: { name: 'Bard', subclass: { name: 'Lore' } } });
    mockedClassRules.getBardFeatures = vi.fn(() => ({ received: true }));

    getClassFeatures(inputStats);

    expect(mockedClassRules.getBardFeatures).toHaveBeenCalledWith(inputStats);
  });

  // Missing class name (or unknown/case-mismatched one) has no getter: null.
  it.each([
    ['unknown class name', makePlayerStats({ class: { name: 'UnknownClass' } })],
    ['lowercase class name (case-sensitive)', makePlayerStats({ class: { name: 'bard' } })],
    ['missing class property', { rules: '5e' }],
    ['null class property', { rules: '5e', class: null }],
    ['empty playerStats object', {}],
  ])('returns null for %s', async (_label, stats) => {
    expect(getClassFeatures(stats)).toBeNull();
  });

  it('throws when playerStats is null or undefined (no optional chain on rules)', async () => {
    expect(() => getClassFeatures(null)).toThrow();
    expect(() => getClassFeatures(undefined)).toThrow();
  });

  // Defensive branch: getter name exists in FEATURE_GETTERS but the module
  // does not implement it.
  it('returns undefined when the rules module lacks the class method', async () => {
    // beforeEach already cleared both mocks; no getter attached.
    expect(getClassFeatures(makePlayerStats())).toBeUndefined();
  });
});

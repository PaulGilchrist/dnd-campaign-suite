import * as raceRulesModule from './index.js';

const EXPECTED_METHODS = [
  'getImmunities',
  'getRace',
  'getRacialBonus',
  'getResistances',
  'getSenses',
  'addTraits',
  'getTraits',
];

describe('race-rules/index', () => {
  it('exports rules5e as a defined value', () => {
    expect(raceRulesModule.rules5e).toBeDefined();
  });

  it('exports rules2024 as a defined value', () => {
    expect(raceRulesModule.rules2024).toBeDefined();
  });

  it('exports are different objects', () => {
    expect(raceRulesModule.rules5e).not.toBe(raceRulesModule.rules2024);
  });

  it.each(EXPECTED_METHODS)('rules5e has method %s', (method) => {
    expect(typeof raceRulesModule.rules5e[method]).toBe('function');
  });

  it.each(EXPECTED_METHODS)('rules2024 has method %s', (method) => {
    expect(typeof raceRulesModule.rules2024[method]).toBe('function');
  });

  it('exports only rules5e and rules2024', () => {
    expect(Object.keys(raceRulesModule)).toEqual(['rules5e', 'rules2024']);
  });
});

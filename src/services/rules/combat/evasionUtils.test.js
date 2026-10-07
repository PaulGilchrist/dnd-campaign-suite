// @improved-by-ai
// CLA-124/CLA-125: shared evasion eligibility helper — mirror of
// resolveSaveEvasion (saveProcessing.js:332): own evasion gated on
// NOT Incapacitated + dcSuccess 'half' + save-type match; shared
// (shareable, shareRange >= 5) fills in; Circle of Power stacks regardless;
// detail.evasionActive honored for remote-SSE dispatches (SP-023 family).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAoESaveEvasion, evasionLedgerName, isLeadingEvasionSelected, stampLeadingEvasionSelections, LEADING_EVASION_KEY } from './evasionUtils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isCircleOfPowerActive } from '../../automation/handlers/buffs/circleOfPowerHandler.js';

const EVASION = [{ source: 'Evasion', saveType: 'DEX', shareable: false, shareRange: 0 }];
const SHARED = [{ source: 'Paladin Aura', saveType: 'DEX', shareable: true, shareRange: 30 }];

const characters = [
  { name: 'Monk', computedStats: { evasionEffects: EVASION } },
  { name: 'Paladin', computedStats: { evasionEffects: SHARED } },
  { name: 'Dwarf', computedStats: { evasionEffects: [] } },
];

const baseArgs = { characters, detail: undefined, targetName: 'Monk', saveType: 'Dexterity', dcSuccess: 'half', campaignName: 'test-campaign' };

describe('evasionUtils.resolveAoESaveEvasion (CLA-124/CLA-125)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
    isCircleOfPowerActive.mockReturnValue(false);
  });

  it('own DEX evasion on a half-damage save → feature evasion active', () => {
    const r = resolveAoESaveEvasion(baseArgs);
    expect(r.featureEvasionActive).toBe(true);
    expect(r.hasOwnEvasion).toBe(true);
    expect(evasionLedgerName(r)).toBe('Evasion');
  });

  it('save-type mismatch (CON row) → no evasion fold', () => {
    const r = resolveAoESaveEvasion({ ...baseArgs, saveType: 'Constitution' });
    expect(r.featureEvasionActive).toBe(false);
  });

  it('dcSuccess not half → no evasion fold (evasion is a half-damage clause)', () => {
    const r = resolveAoESaveEvasion({ ...baseArgs, dcSuccess: 'none' });
    expect(r.featureEvasionActive).toBe(false);
  });

  it('Incapacitated exemption: own evasion holder that is Incapacitated does not fold', () => {
    getRuntimeValue.mockImplementation(() => ['Incapacitated']);
    const r = resolveAoESaveEvasion(baseArgs);
    expect(r.hasOwnEvasion).toBe(false);
    expect(r.featureEvasionActive).toBe(false);
    expect(r.isIncapacitated).toBe(true);
  });

  it('CLA-211: shareable-holder presence alone does NOT fold (no stamp)', () => {
    getRuntimeValue.mockImplementation((_key, rk) => (rk === LEADING_EVASION_KEY ? {} : []));
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf' });
    expect(r.hasOwnEvasion).toBe(false);
    expect(r.hasSharedEvasion).toBe(false);
    expect(r.evasionActive).toBe(false);
  });

  it('CLA-211: GM-stamped target folds shared Leading Evasion', () => {
    getRuntimeValue.mockImplementation((_key, rk) => (rk === LEADING_EVASION_KEY ? { 'p-1': ['Dwarf'] } : []));
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf', detail: { promptId: 'p-1' } });
    expect(r.hasOwnEvasion).toBe(false);
    expect(r.hasSharedEvasion).toBe(true);
    expect(evasionLedgerName(r)).toBe('Leading Evasion');
  });

  it('CLA-211: stamp for a different promptId does not leak across saves', () => {
    getRuntimeValue.mockImplementation((_key, rk) => (rk === LEADING_EVASION_KEY ? { 'p-1': ['Dwarf'] } : []));
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf', detail: { promptId: 'p-2' } });
    expect(r.hasSharedEvasion).toBe(false);
  });

  it('CLA-211: Incapacitated stamped target still does not fold', () => {
    getRuntimeValue.mockImplementation((name, rk) => {
      if (rk === LEADING_EVASION_KEY) return { 'p-1': ['Dwarf'] };
      if (name === 'Dwarf') return ['Incapacitated'];
      return [];
    });
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf', detail: { promptId: 'p-1' } });
    expect(r.hasSharedEvasion).toBe(false);
  });

  it('Circle of Power stacks on an otherwise-unprotected target and names itself', () => {
    isCircleOfPowerActive.mockReturnValue(true);
    const bare = [{ name: 'Dwarf', computedStats: {} }];
    const r = resolveAoESaveEvasion({ ...baseArgs, characters: bare, targetName: 'Dwarf' });
    expect(r.evasionActive).toBe(true);
    expect(r.hasCircleOfPower).toBe(true);
    expect(evasionLedgerName(r)).toBe('Circle of Power');
  });

  it('detail.evasionActive (prompt-roller flag) folds when local stats miss; CoP double-attribution stays separated', () => {
    const r = resolveAoESaveEvasion({ ...baseArgs, characters: [], detail: { evasionActive: true } });
    expect(r.featureEvasionActive).toBe(true);
    isCircleOfPowerActive.mockReturnValue(true);
    const cop = resolveAoESaveEvasion({ ...baseArgs, characters: [], detail: { evasionActive: true }, targetName: 'Dwarf' });
    expect(cop.hasCircleOfPower).toBe(true);
    expect(cop.featureEvasionActive).toBe(false);
    expect(cop.evasionActive).toBe(true);
  });

  it('missing computedStats (CLA-124 persisted-stub shape) → inert, no crash', () => {
    const r = resolveAoESaveEvasion({ ...baseArgs, characters: [{ name: 'Monk', type: 'player', currentHp: 1, maxHp: 1 }] });
    expect(r.featureEvasionActive).toBe(false);
    expect(r.evasionActive).toBe(false);
  });
});

describe('evasionUtils CLA-211 share-selection stamp helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue([]);
  });

  it('stampLeadingEvasionSelections merges into existing store and writes once', () => {
    getRuntimeValue.mockReturnValue({ 'p-1': ['Dwarf'] });
    stampLeadingEvasionSelections('test-campaign', [['p-1', ['Elf']], ['p-2', ['Goblin']]]);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', LEADING_EVASION_KEY, {
      'p-1': ['Dwarf', 'Elf'],
      'p-2': ['Goblin'],
    }, 'test-campaign');
  });

  it('stampLeadingEvasionSelections never duplicates names', () => {
    getRuntimeValue.mockReturnValue({ 'p-1': ['Dwarf'] });
    stampLeadingEvasionSelections('test-campaign', [['p-1', ['Dwarf']]]);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', LEADING_EVASION_KEY, { 'p-1': ['Dwarf'] }, 'test-campaign');
  });

  it('isLeadingEvasionSelected: true only for stamped prompt/target pairs', () => {
    getRuntimeValue.mockReturnValue({ 'p-1': ['Dwarf'] });
    expect(isLeadingEvasionSelected('test-campaign', 'p-1', 'Dwarf')).toBe(true);
    expect(isLeadingEvasionSelected('test-campaign', 'p-1', 'Elf')).toBe(false);
    expect(isLeadingEvasionSelected('test-campaign', null, 'Dwarf')).toBe(false);
    expect(isLeadingEvasionSelected('test-campaign', 'p-1', null)).toBe(false);
  });
});

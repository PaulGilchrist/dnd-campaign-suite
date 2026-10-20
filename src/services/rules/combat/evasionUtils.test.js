// @maintained-by-ai
// CLA-124/CLA-125 + CLA-211: shared evasion eligibility helper — mirrors
// resolveSaveEvasion (saveProcessing.js:332) gate order: own evasion gated on
// NOT Incapacitated + dcSuccess 'half' + save-type match; shared Leading
// Evasion folds ONLY on the GM's chooser stamp (leadingEvasionSelections
// [promptId] — blanket shareable-holder presence no longer folds); Circle of
// Power stacks regardless and is NOT Incapacitated-gated; detail.evasionActive
// honored for remote-SSE dispatches (SP-023 family).
// Lane: evasion UTIL specifics only — computeDamageAfterEvasion arithmetic is
// owned by applyDamage.helpers.test.js and the real-'full'-through-evasion
// falsifier by applyDamage.save-full.test.js; neither is re-driven here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveAoESaveEvasion,
  evasionLedgerName,
  isLeadingEvasionSelected,
  stampLeadingEvasionSelections,
  clearLeadingEvasionSelection,
  LEADING_EVASION_KEY,
} from './evasionUtils.js';

const runtimeStore = {};

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
  setRuntimeValue: vi.fn((name, key, value) => { runtimeStore[`${name}.${key}`] = value; }),
}));

vi.mock('../../automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isCircleOfPowerActive } from '../../automation/handlers/buffs/circleOfPowerHandler.js';

const EVASION = [{ source: 'Evasion', saveType: 'DEX', shareable: false, shareRange: 0 }];
const SHARED = [{ source: 'Paladin Aura', saveType: 'DEX', shareable: true, shareRange: 30 }];

const characters = [
  { name: 'Monk', computedStats: { evasionEffects: EVASION } },
  { name: 'Paladin', computedStats: { evasionEffects: SHARED } },
  { name: 'Dwarf', computedStats: { evasionEffects: [] } },
];

const baseArgs = { characters, detail: undefined, targetName: 'Monk', saveType: 'Dexterity', dcSuccess: 'half', campaignName: 'test-campaign' };

const stampLeading = (map) => { runtimeStore[`campaign.${LEADING_EVASION_KEY}`] = map; };
const conditions = (name, list) => { runtimeStore[`${name}.activeConditions`] = list; };

describe('evasionUtils.resolveAoESaveEvasion (CLA-124/CLA-125/CLA-211)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    isCircleOfPowerActive.mockReturnValue(false);
  });

  it('own DEX evasion on a half-damage save → feature evasion active, ledger names Evasion', () => {
    const r = resolveAoESaveEvasion(baseArgs);
    expect(r.hasOwnEvasion).toBe(true);
    expect(r.featureEvasionActive).toBe(true);
    expect(r.evasionActive).toBe(true);
    expect(evasionLedgerName(r)).toBe('Evasion');
  });

  // Each row leaves exactly one eligibility gate unmet on an own-evasion
  // holder: wrong save type, or dcSuccess outside the honest disk canon
  // ('half' is the only folding value; none/full/other never fold).
  it.each([
    ['save-type mismatch (CON row)', { saveType: 'Constitution' }],
    ['dcSuccess "none"', { dcSuccess: 'none' }],
    ['dcSuccess "full"', { dcSuccess: 'full' }],
    ['dcSuccess "other"', { dcSuccess: 'other' }],
  ])('gate unmet — %s → no evasion fold', (_label, overrides) => {
    const r = resolveAoESaveEvasion({ ...baseArgs, ...overrides });
    expect(r.hasOwnEvasion).toBe(false);
    expect(r.featureEvasionActive).toBe(false);
    expect(r.evasionActive).toBe(false);
  });

  it.each(['Incapacitated', 'incapacitated'])(
    'Incapacitated exemption ("%(i)"): own-evasion holder does not fold', (condition) => {
      conditions('Monk', [condition]);
      const r = resolveAoESaveEvasion(baseArgs);
      expect(r.isIncapacitated).toBe(true);
      expect(r.hasOwnEvasion).toBe(false);
      expect(r.featureEvasionActive).toBe(false);
    });

  it('CLA-211: shareable-holder presence alone does NOT fold (no stamp)', () => {
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf' });
    expect(r.hasOwnEvasion).toBe(false);
    expect(r.hasSharedEvasion).toBe(false);
    expect(r.evasionActive).toBe(false);
  });

  it('CLA-211: GM-stamped target folds shared Leading Evasion and ledger names it', () => {
    stampLeading({ 'p-1': ['Dwarf'] });
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf', detail: { promptId: 'p-1' } });
    expect(r.hasOwnEvasion).toBe(false);
    expect(r.hasSharedEvasion).toBe(true);
    expect(r.evasionActive).toBe(true);
    expect(evasionLedgerName(r)).toBe('Leading Evasion');
  });

  it('CLA-211: stamp for a different promptId does not leak across saves', () => {
    stampLeading({ 'p-1': ['Dwarf'] });
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf', detail: { promptId: 'p-2' } });
    expect(r.hasSharedEvasion).toBe(false);
    expect(r.evasionActive).toBe(false);
  });

  it('CLA-211: Incapacitated stamped target still does not fold', () => {
    stampLeading({ 'p-1': ['Dwarf'] });
    conditions('Dwarf', ['Incapacitated']);
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf', detail: { promptId: 'p-1' } });
    expect(r.hasSharedEvasion).toBe(false);
    expect(r.evasionActive).toBe(false);
  });

  it('Circle of Power stacks on an otherwise-unprotected target and names itself', () => {
    isCircleOfPowerActive.mockReturnValue(true);
    const r = resolveAoESaveEvasion({ ...baseArgs, characters: [{ name: 'Dwarf', computedStats: {} }], targetName: 'Dwarf' });
    expect(r.hasCircleOfPower).toBe(true);
    expect(r.featureEvasionActive).toBe(false);
    expect(r.evasionActive).toBe(true);
    expect(evasionLedgerName(r)).toBe('Circle of Power');
  });

  it('detail.evasionActive (prompt-roller flag) folds when local stats miss; CoP double-attribution stays separated', () => {
    const r = resolveAoESaveEvasion({ ...baseArgs, characters: [], detail: { evasionActive: true } });
    expect(r.featureEvasionActive).toBe(true);
    expect(r.evasionActive).toBe(true);

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
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
  });

  it('stampLeadingEvasionSelections merges prompts, dedupes names, writes once', () => {
    stampLeading({ 'p-1': ['Dwarf'] });
    stampLeadingEvasionSelections('test-campaign', [['p-1', ['Elf', 'Dwarf']], ['p-2', ['Goblin']]]);
    const stamped = { 'p-1': ['Dwarf', 'Elf'], 'p-2': ['Goblin'] };
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', LEADING_EVASION_KEY, stamped, 'test-campaign');
    expect(runtimeStore[`campaign.${LEADING_EVASION_KEY}`]).toEqual(stamped);
  });

  it('isLeadingEvasionSelected: true only for stamped prompt/target pairs', () => {
    stampLeading({ 'p-1': ['Dwarf'] });
    expect(isLeadingEvasionSelected('test-campaign', 'p-1', 'Dwarf')).toBe(true);
    expect(isLeadingEvasionSelected('test-campaign', 'p-1', 'Elf')).toBe(false);
    expect(isLeadingEvasionSelected('test-campaign', null, 'Dwarf')).toBe(false);
    expect(isLeadingEvasionSelected('test-campaign', 'p-1', null)).toBe(false);
  });

  it('clearLeadingEvasionSelection prunes only the answered prompt; unknown prompts are a no-op', () => {
    stampLeading({ 'p-1': ['Dwarf'], 'p-2': ['Elf'] });
    clearLeadingEvasionSelection('test-campaign', 'p-1');
    expect(runtimeStore[`campaign.${LEADING_EVASION_KEY}`]).toEqual({ 'p-2': ['Elf'] });

    clearLeadingEvasionSelection('test-campaign', 'p-404');
    clearLeadingEvasionSelection('test-campaign', null);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1); // no pointless broadcast writes
    expect(runtimeStore[`campaign.${LEADING_EVASION_KEY}`]).toEqual({ 'p-2': ['Elf'] });
  });
});

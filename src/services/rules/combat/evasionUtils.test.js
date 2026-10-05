// @improved-by-ai
// CLA-124/CLA-125: shared evasion eligibility helper — mirror of
// resolveSaveEvasion (saveProcessing.js:332): own evasion gated on
// NOT Incapacitated + dcSuccess 'half' + save-type match; shared
// (shareable, shareRange >= 5) fills in; Circle of Power stacks regardless;
// detail.evasionActive honored for remote-SSE dispatches (SP-023 family).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAoESaveEvasion, evasionLedgerName } from './evasionUtils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
}));

vi.mock('../../automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

  it('shared Leading Evasion: nearby shareable holder covers a non-holder target', () => {
    const r = resolveAoESaveEvasion({ ...baseArgs, targetName: 'Dwarf' });
    expect(r.hasOwnEvasion).toBe(false);
    expect(r.hasSharedEvasion).toBe(true);
    expect(evasionLedgerName(r)).toBe('Leading Evasion');
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

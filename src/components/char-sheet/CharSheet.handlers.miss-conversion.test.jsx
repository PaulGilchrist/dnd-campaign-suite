// @maintained-by-ai
// Regression ledger for the Boon-of-Combat-Prowess hit-flag split
// (bug-boon-combat-prowess-hit-flag-not-persisted): a miss converted to a hit
// deals damage AS A HIT (Done dispatches dice-roll-done {hit:true}), so the
// persisted roll records — campaign.lastAttack and the <attacker>.lastAttackRoll
// twin — must flip hit:true too, or every lastAttack.hit rider (Stunning
// Strike's gate first among them) wrongly denies the legitimate hit.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY,
} from '../../services/rules/features/boonOfCombatProwess.js';
import { handleStrokeOfLuck } from './CharSheet.handlers';

import {
  createMockStore,
  createMockPlayerStats,
} from './CharSheet.test-utils';

// ---------------------------------------------------------------------------
// Mocks — services (mirror CharSheet.featureRiders.test.jsx conventions)
// ---------------------------------------------------------------------------

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn().mockResolvedValue({ creatures: [] }),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue({ damageApplied: true }),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
  executeEmpoweredReroll: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getManeuversForRules: vi.fn().mockResolvedValue([]),
  getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockStore = createMockStore();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const campaignName = 'test-campaign';
const playerName = 'Disciplined_Monk';

const createPlayerStats = (overrides = {}) => createMockPlayerStats({ name: playerName, ...overrides });

// The roll-time shape attackPostProcessing.storeCampaignLastAttack stamps on a miss.
const missLastAttack = (overrides = {}) => ({
  attackerName: playerName,
  targetName: 'EvasiveFighter',
  d20: 6,
  d20Rolls: [6, 9],
  bonus: 11,
  total: 17,
  targetAc: 18,
  effectiveAc: 18,
  hit: false,
  isCrit: false,
  weaponType: 'melee',
  isAutoMiss: false,
  attackName: 'Quarterstaff',
  rollType: 'attack',
  damageFormula: '1d6+5',
  ...overrides,
});

const missLastAttackRoll = (overrides = {}) => ({
  attackName: 'Quarterstaff',
  attackerName: playerName,
  d20: 6,
  bonus: 11,
  targetName: 'EvasiveFighter',
  targetAc: 18,
  hit: false,
  isCrit: false,
  effectiveAc: 18,
  ...overrides,
});

const missAttackPopup = (overrides = {}) => ({
  name: 'Quarterstaff',
  rolls: [6, 9],
  bonus: 11,
  hit: false,
  targetName: 'EvasiveFighter',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('miss→hit conversion persists the hit flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
  });

  it('FT-007: boon conversion flips campaign.lastAttack to hit:true with the missConverted marker, preserving the rest of the record', async () => {
    mockStore.set('campaign:lastAttack', missLastAttack());

    await handleStrokeOfLuck(createPlayerStats(), campaignName, missAttackPopup(), 'boonOfCombatProwess');

    const la = mockStore.get('campaign:lastAttack');
    expect(la.hit).toBe(true);
    expect(la.missConverted).toBe(true);
    expect(la.convertedBy).toBe('Boon of Combat Prowess');
    // Honest-logging fields stay byte-unchanged (the d20 really was a 6 vs AC 18).
    expect(la.d20).toBe(6);
    expect(la.d20Rolls).toEqual([6, 9]);
    expect(la.total).toBe(17);
    expect(la.targetAc).toBe(18);
    expect(la.effectiveAc).toBe(18);
    expect(la.weaponType).toBe('melee');
    expect(la.damageFormula).toBe('1d6+5');
  });

  it('FT-007: boon conversion flips the attacker lastAttackRoll twin to hit:true with the same marker', async () => {
    mockStore.set('Disciplined_Monk:lastAttackRoll', missLastAttackRoll());

    await handleStrokeOfLuck(createPlayerStats(), campaignName, missAttackPopup(), 'boonOfCombatProwess');

    const roll = mockStore.get('Disciplined_Monk:lastAttackRoll');
    expect(roll.hit).toBe(true);
    expect(roll.missConverted).toBe(true);
    expect(roll.convertedBy).toBe('Boon of Combat Prowess');
    expect(roll.targetAc).toBe(18);
  });

  it('FT-007: the latch stamp and the ability_use log survive alongside the record rewrite', async () => {
    const { addEntry } = await import('../../services/ui/logService.js');
    mockStore.set('campaign:lastAttack', missLastAttack());

    await handleStrokeOfLuck(createPlayerStats(), campaignName, missAttackPopup(), 'boonOfCombatProwess');

    expect(mockStore.get(`${playerName}:${BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY}`)).toBe(1);
    const entry = addEntry.mock.calls.at(-1)[1];
    expect(entry.abilityName).toBe('Boon of Combat Prowess');
    expect(entry.description).toContain('Miss converted to Hit');
  });

  it('Stroke of Luck on a missed ATTACK roll (hit:false popup) also rewrites the persisted records', async () => {
    mockStore.set('campaign:lastAttack', missLastAttack());
    mockStore.set('Disciplined_Monk:lastAttackRoll', missLastAttackRoll());

    await handleStrokeOfLuck(createPlayerStats(), campaignName, missAttackPopup(), 'strokeOfLuck');

    expect(mockStore.get('campaign:lastAttack').hit).toBe(true);
    expect(mockStore.get('campaign:lastAttack').convertedBy).toBe('Stroke of Luck');
    expect(mockStore.get('Disciplined_Monk:lastAttackRoll').hit).toBe(true);
    expect(mockStore.get('Disciplined_Monk:strokeOfLuckUsed')).toBe(true);
  });

  it('Stroke of Luck on a check/save D20 test (no hit:false popup) writes nothing to the last-attack records', async () => {
    mockStore.set('campaign:lastAttack', missLastAttack());
    mockStore.set('Disciplined_Monk:lastAttackRoll', missLastAttackRoll());

    await handleStrokeOfLuck(createPlayerStats(), campaignName, { name: 'Persuasion', rolls: [4], bonus: 5 }, 'strokeOfLuck');

    // Stale records from an earlier attack must not be laundered by a check conversion.
    expect(mockStore.get('campaign:lastAttack').hit).toBe(false);
    expect(mockStore.get('campaign:lastAttack').missConverted).toBeUndefined();
    expect(mockStore.get('Disciplined_Monk:lastAttackRoll').hit).toBe(false);
  });

  it('refuses to rewrite a lastAttack that belongs to a different attacker or already hit', async () => {
    mockStore.set('campaign:lastAttack', missLastAttack({ attackerName: 'EvasiveFighter' }));
    mockStore.set('Disciplined_Monk:lastAttackRoll', missLastAttackRoll({ hit: true }));

    await handleStrokeOfLuck(createPlayerStats(), campaignName, missAttackPopup(), 'boonOfCombatProwess');

    expect(mockStore.get('campaign:lastAttack').hit).toBe(false);
    expect(mockStore.get('campaign:lastAttack').missConverted).toBeUndefined();
    // The already-hit twin must be left byte-untouched (no marker added).
    expect(mockStore.get('Disciplined_Monk:lastAttackRoll').missConverted).toBeUndefined();
  });

  it('a hit-true lastAttack belonging to the attacker still upgrades nothing (only hit===false records flip)', async () => {
    mockStore.set('campaign:lastAttack', missLastAttack({ hit: true }));

    await handleStrokeOfLuck(createPlayerStats(), campaignName, missAttackPopup(), 'boonOfCombatProwess');

    expect(mockStore.get('campaign:lastAttack').missConverted).toBeUndefined();
  });
});

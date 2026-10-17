// @maintained-by-ai
// Spells lane: Feign Death — touch, auto-success (no save). Modal target
// selection + buff/condition latch that persists until an event seam
// (initiative roll / short / long rest clears the expiration — never a clock).
// Resistance table is "all except psychic"; poisoned is actively stripped.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'TestCaster' },
      { name: 'AllyB' },
      { name: 'EnemyC' },
    ],
  })),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(() => Promise.resolve({ attackerPos: { x: 0, y: 0 } })),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, applyFeignDeath } from './feignDeathHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

const APPEARS_DEAD = 'Target appears dead: Blinded, Incapacitated, Speed 0, Resistant to all damage except Psychic, Immune to Poisoned.';
const EXPIRES_ON = ' Expires on initiative roll, short rest, or long rest.';

// Rules table: resistant to everything except psychic.
const RESIST_ALL_BUT_PSYCHIC = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'radiant', 'slashing', 'thunder',
];

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Feign Death',
    automation: {
      type: 'feign_death',
      ...automation,
    },
  };
}

// Keyed runtime stub mirroring the real store: writes are visible to the
// handler's later reads (condition-append then poisoned-strip reads the
// post-write state). Replaces brittle positional mockReturnValueOnce chains.
// seed: { '<targetName>': { activeBuffs: [...], activeConditions: [...] } }
function mockRuntimeStore(seed = {}) {
  const store = JSON.parse(JSON.stringify(seed));
  getRuntimeValue.mockImplementation((name, key) => store[name]?.[key] ?? null);
  setRuntimeValue.mockImplementation((name, key, value) => {
    store[name] = { ...store[name], [key]: value };
    return Promise.resolve();
  });
  return store;
}

function getConditionsCalls(targetName) {
  return setRuntimeValue.mock.calls.filter(
    call => call[0] === targetName && call[1] === 'activeConditions'
  );
}

// ── Tests ──────────────────────────────────────────────────────

describe('feignDeathHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps explicit return values/impls — fully reset the
    // stateful runtime mocks so per-test stubs never leak forward.
    getRuntimeValue.mockReset().mockReturnValue(null);
    setRuntimeValue.mockReset();
  });

  describe('handle (target selection modal)', () => {
    it('returns feignDeathTargetSelection modal with defaults (Touch/8ft, 1 hour)', async () => {
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('feignDeathTargetSelection');
      expect(result.payload).toEqual({
        name: 'Feign Death',
        creatureTargets: ['TestCaster', 'AllyB', 'EnemyC'],
        range: 'Touch',
        rangeFt: 8, // rangeToFeet('Touch') = MELEE_RANGE_FT
        duration: '1 hour',
        attackerPos: null,
      });
    });

    it('spell overrides default range and duration', async () => {
      const action = {
        name: 'Feign Death',
        automation: { type: 'feign_death' },
        spell: { range: '60 feet', duration: '8 hours' },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null, []);

      expect(result.payload.range).toBe('60 feet');
      expect(result.payload.rangeFt).toBe(60);
      expect(result.payload.duration).toBe('8 hours');
    });

    it('no combat summary: empty creatureTargets', async () => {
      vi.mocked(getCombatSummary).mockReturnValueOnce(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  describe('applyFeignDeath (activation)', () => {
    it('no valid targets (empty array or non-array): null, zero side effects', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      expect(await applyFeignDeath(action, ps, campaignName, null, [])).toBeNull();
      expect(await applyFeignDeath(action, ps, campaignName, null, 'AllyB')).toBeNull();

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addExpiration).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('applies Feign Death buff: all-but-psychic resistances, poison immunity', async () => {
      mockRuntimeStore();

      const result = await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['AllyB']);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(setRuntimeValue).toHaveBeenCalledWith('AllyB', 'activeBuffs', [{
        name: 'Feign Death',
        effect: 'feign_death',
        duration: '1 hour',
        resistanceTypes: RESIST_ALL_BUT_PSYCHIC,
        conditionImmunity: ['poisoned'],
        sourceCharacter: 'TestCaster',
      }], campaignName);
    });

    it('applies exact condition table blinded, incapacitated, speed_zero', async () => {
      mockRuntimeStore();

      await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['AllyB']);

      expect(getConditionsCalls('AllyB')).toEqual([
        ['AllyB', 'activeConditions', ['blinded', 'incapacitated', 'speed_zero'], campaignName],
      ]);
    });

    it('registers expiration on event seam (expireOnCreatureName), never a clock', async () => {
      mockRuntimeStore();

      await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['AllyB']);

      expect(addExpiration).toHaveBeenCalledWith({
        attackerName: 'TestCaster',
        targetName: 'AllyB',
        effects: [{ type: 'remove_feign_death_buff', buffName: 'Feign Death' }],
        campaignName,
        rounds: undefined,
        expireOnCreatureName: 'AllyB',
      });
    });

    it('logs ability_use with full description and popup for other target', async () => {
      mockRuntimeStore();

      const result = await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['AllyB']);

      expect(result.payload.description).toBe(
        `TestCaster cast Feign Death on AllyB. ${APPEARS_DEAD}`
      );
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Feign Death',
        description: `TestCaster cast Feign Death on AllyB. ${APPEARS_DEAD}${EXPIRES_ON}`,
      });
    });

    it('logs "themself" when caster targets self', async () => {
      mockRuntimeStore();

      await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['TestCaster']);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: `TestCaster cast Feign Death on themself. ${APPEARS_DEAD}${EXPIRES_ON}`,
      }));
    });

    it('custom spell duration lands on the buff', async () => {
      mockRuntimeStore();
      const action = {
        name: 'Feign Death',
        automation: { type: 'feign_death' },
        spell: { duration: '8 hours' },
      };

      await applyFeignDeath(action, makePlayerStats(), campaignName, null, ['AllyB']);

      const buffsCall = setRuntimeValue.mock.calls.find(
        call => call[0] === 'AllyB' && call[1] === 'activeBuffs'
      );
      expect(buffsCall[2][0].duration).toBe('8 hours');
    });

    it('already-active buff is not re-added, but latch still enforced', async () => {
      mockRuntimeStore({
        AllyB: { activeBuffs: [{ name: 'Feign Death', effect: 'feign_death' }] },
      });

      await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['AllyB']);

      expect(setRuntimeValue).not.toHaveBeenCalledWith('AllyB', 'activeBuffs', expect.anything(), campaignName);
      // conditions and expiration still applied even when buff was a dupe
      expect(getConditionsCalls('AllyB')).toEqual([
        ['AllyB', 'activeConditions', ['blinded', 'incapacitated', 'speed_zero'], campaignName],
      ]);
      expect(addExpiration).toHaveBeenCalledTimes(1);
    });

    it('does not duplicate conditions already present', async () => {
      mockRuntimeStore({
        AllyB: { activeConditions: ['blinded', 'incapacitated'] },
      });

      await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['AllyB']);

      expect(getConditionsCalls('AllyB')).toEqual([
        ['AllyB', 'activeConditions', ['blinded', 'incapacitated', 'speed_zero'], campaignName],
      ]);
    });

    it('strips poisoned post-apply (two-write sequence)', async () => {
      mockRuntimeStore({
        AllyB: { activeConditions: ['poisoned', 'blinded'] },
      });

      await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['AllyB']);

      // Write 1: append latch conditions; write 2: filtered re-read strips poisoned.
      expect(getConditionsCalls('AllyB')).toEqual([
        ['AllyB', 'activeConditions', ['poisoned', 'blinded', 'incapacitated', 'speed_zero'], campaignName],
        ['AllyB', 'activeConditions', ['blinded', 'incapacitated', 'speed_zero'], campaignName],
      ]);
    });

    it('multiple targets: per-target buff/expiration/log, plural popup', async () => {
      mockRuntimeStore();

      const result = await applyFeignDeath(makeAction(), makePlayerStats(), campaignName, null, ['AllyB', 'EnemyC']);

      expect(result.payload.description).toBe(
        'TestCaster cast Feign Death on AllyB, EnemyC. Targets appear dead: Blinded, Incapacitated, Speed 0, Resistant to all damage except Psychic, Immune to Poisoned.'
      );
      for (const target of ['AllyB', 'EnemyC']) {
        const buffsCall = setRuntimeValue.mock.calls.find(
          call => call[0] === target && call[1] === 'activeBuffs'
        );
        expect(buffsCall[2]).toHaveLength(1);
        expect(buffsCall[2][0]).toEqual(expect.objectContaining({ effect: 'feign_death', sourceCharacter: 'TestCaster' }));
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({ targetName: target, expireOnCreatureName: target }));
      }
      expect(addEntry).toHaveBeenCalledTimes(2);
    });
  });
});

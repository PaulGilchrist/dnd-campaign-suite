// @maintained-by-ai
/**
 * Lane: MAIN per-type clear dispatch, pinned through the PUBLIC wrapper
 * clearAllExpirationEffects (rest/initiative seam): queue read → dispatch-all
 * → exact store writes. Per-type sibling lanes call clearExpirationEffects
 * directly; this file proves those same handlers fire when reached through
 * the wrapper. No round/maturity arithmetic lives on this entry —
 * clearAllExpirationEffects dispatches every queued entry unconditionally
 * (maturity math is expireStaleEffects.test.js / the expirationQueue lane).
 *
 * Owned elsewhere — do not duplicate here:
 *   - unknown-type no-op, shape-family, charmed/dominated, break_concentration,
 *     clear_runtime_value, remove_smite_of_protection, clear_silence_zone,
 *     remove_summoned_creatures: clearExpirationEffects_additional_types.test.js (#1287)
 *   - outgoing/incoming queue wiring, multi-entry scan + Infinity purge seam,
 *     remove_heroism_buff, remove_target_effect FT-082 scoping, max-HP reverts,
 *     bait_and_switch_clear on a remote target: clearAllExpirationEffects_additional.test.js (#1285)
 *   - rest-scene cleanup (Flesh to Stone, Prismatic Spray, Otto's Irresistible
 *     Dance, Sanctuary badges, object transforms, coverRefresh, early returns,
 *     8h buff preserve): clearAllExpirationEffects_rest_cleanup.test.js (#1286)
 *   - remove_aura_of_life_buff / aura_of_life_hp_protection_end merged-write
 *     leg (SP-008): clearExpirationEffects.aura-of-life.test.js (#1289)
 *   - calm_emotions_end (SP-020 B5): clearExpirationEffects.calm-emotions-end.test.js (#1290)
 *   - fly_speed_equals_walk_speed buff strip + CLA-096/CLA-096-incapacitated
 *     logs (direct dispatch): clearExpirationEffects.draconic-flight-expiry.test.js (#1291)
 *   - dragon_wings flag + strip + expiry log (direct dispatch):
 *     clearExpirationEffects.dragon-wings-expiry.test.js (#1292). The
 *     dragon_wings row below is deliberate, not a dupe: it is the only pin
 *     of that handler reached via the PUBLIC wrapper.
 *   - frightful_presence_immunity_grant (MA-0048) / weakening_breath_auto_success
 *     (MA-0102): their per-spell clearExpirationEffects.*.test.js files (#1293 et al.)
 *
 * Cited by: clearExpirationEffects_additional_types.test.js header (main queue
 * types — condition, stunned, speed_zero, remove_active_buff, feign death,
 * haste, bardic/maneuver flags — owned here), clearAllExpirationEffects_additional.test.js
 * :98 and :284, naturesSanctuaryHandler.test.js:9 (remove_natures_sanctuary
 * expiry effects owned here).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getActiveCreatureName: vi.fn(() => 'Goblin'),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (typeof expr === 'number') return expr;
    return 1;
  }),
}));

import { clearAllExpirationEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import utils from '../../ui/utils.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  // Explicit resets so a stateful setter staged by one test (feign death)
  // cannot leak into the next.
  getRuntimeValue.mockReset();
  setRuntimeValue.mockReset();
  getAllStoreKeys.mockReset();
  getAllStoreKeys.mockReturnValue([]);
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => String(v));
}

// emptyRuntime baseline: Goblin owns the only queued list; every other read is
// inert. `staged` maps 'Name::key' to the values a handler must see.
function emptyRuntime(myList = [], staged = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === KEY) return name === 'Goblin' ? myList : [];
    const composite = `${name}::${key}`;
    if (composite in staged) return staged[composite];
    if (key === 'activeConditions' || key.startsWith('_advantageOn_')) return [];
    return null;
  });
}

// Writes recorded for one (name, key) pair.
const writesTo = (name, key) =>
  setRuntimeValue.mock.calls.filter((c) => c[0] === name && c[1] === key);

// ---------------------------------------------------------------------------
// clearExpirationEffects — effect type handling (via clearAllExpirationEffects)
// ---------------------------------------------------------------------------
describe('clearExpirationEffects effect types (via clearAllExpirationEffects)', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    emptyRuntime();
  });

  it('type condition — strips the named condition, other bytes untouched', () => {
    emptyRuntime(
      [{ target: 'Orc', effects: [{ type: 'condition', condition: 'stunned' }], appliedRound: 1 }],
      { 'Orc::activeConditions': ['frightened', 'stunned', 'blinded'] },
    );

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Orc',
      'activeConditions',
      ['frightened', 'blinded'],
      'MyCampaign',
    );
  });

  it('type advantage_on_target — removes one target from the attacker store, preserving the others', () => {
    emptyRuntime(
      [{ target: 'Human', effects: [{ type: 'advantage_on_target' }], appliedRound: 1 }],
      { 'Goblin::_advantageOn_Human': ['Orc', 'Human', 'Elf'] },
    );

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      '_advantageOn_Human',
      ['Orc', 'Elf'],
      'MyCampaign',
    );
  });

  it('type stunned — one entry, both branches: stunned condition removed AND speed_halved nulled', () => {
    emptyRuntime(
      [{
        target: 'Orc',
        effects: [
          { type: 'stunned', condition: 'stunned' },
          { type: 'stunned', condition: 'speed_halved' },
        ],
        appliedRound: 1,
      }],
      { 'Orc::activeConditions': ['stunned', 'poisoned'] },
    );

    clearAllExpirationEffects('Goblin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions', ['poisoned'], 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Orc', 'stunned_speedHalved', null, 'MyCampaign');
  });

  describe('flight/buff removal effect types', () => {
    // fly_speed_equals_walk_speed is deliberately absent: #1291
    // (clearExpirationEffects.draconic-flight-expiry.test.js) owns that
    // handler's exact strip + log via direct dispatch.
    const flightBuffTests = [
      { type: 'fly_speed_20_hover', buff: 'fly_speed_20_hover', extraChecks: [] },
      {
        // Via-wrapper pin distinct from #1292's direct-dispatch file.
        type: 'dragon_wings',
        buff: 'dragon_wings',
        extraChecks: [{ key: 'dragonWingsActive', value: false }],
      },
      { type: 'ice_walk', buff: 'ice_walk', extraChecks: [] },
      { type: 'speed_boost', buff: 'speed_boost', extraChecks: [] },
    ];

    it.each(flightBuffTests)(
      'removes $type buff from activeBuffs, preserving other buffs',
      ({ type, buff, extraChecks }) => {
        emptyRuntime(
          [{ target: 'Human', effects: [{ type }], appliedRound: 1 }],
          { 'Human::activeBuffs': [{ effect: buff, duration: 3 }, { effect: 'double_move', duration: 2 }] },
        );

        clearAllExpirationEffects('Goblin', 'MyCampaign');

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Human',
          'activeBuffs',
          [{ effect: 'double_move', duration: 2 }],
          'MyCampaign',
        );
        for (const check of extraChecks) {
          expect(setRuntimeValue).toHaveBeenCalledWith('Human', check.key, check.value, 'MyCampaign');
        }
      },
    );
  });

  describe('remove_active_buff effect type', () => {
    it('removes buff by name from activeBuffs', () => {
      emptyRuntime(
        [{ target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'RecklessAttack' }], appliedRound: 1 }],
        {
          'Human::activeBuffs': [
            { name: 'RecklessAttack', effect: 'reckless_attack', duration: 3 },
            { name: 'DivineSmite', effect: 'divine_smite', duration: 2 },
          ],
        },
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'activeBuffs',
        [{ name: 'DivineSmite', effect: 'divine_smite', duration: 2 }],
        'MyCampaign',
      );
    });

    it('BUG CLA-198: clears innerRadianceActive when the Inner Radiance buff expires', () => {
      emptyRuntime(
        [{ target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Inner Radiance' }], appliedRound: 1 }],
        {
          'Human::activeBuffs': [
            { name: 'Inner Radiance', effect: 'inner_radiance', duration: '1_minute' },
          ],
        },
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeBuffs', [], 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'innerRadianceActive', null, 'MyCampaign');
    });

    it('BUG CLA-402: clears awakenedMindTarget when the Awakened Mind buff expires', () => {
      emptyRuntime(
        [{ target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Awakened Mind' }], appliedRound: 1 }],
        {
          'Human::activeBuffs': [
            { name: 'Awakened Mind', effect: 'telepathic_speech', duration: 'warlock_level_minutes' },
          ],
          'Human::awakenedMindTarget': 'Bandit 1',
        },
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeBuffs', [], 'MyCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'awakenedMindTarget', null, 'MyCampaign');
    });

    // PRESERVED-CITED-BY #1285 (designated owner when _additional folded its
    // dupes) — keep this test's name/intent; only its assertions were tightened.
    it('removes haste buff without adding lethargy conditions', () => {
      emptyRuntime(
        [{ target: 'Human', effects: [{ type: 'remove_active_buff', buffName: 'Haste' }], appliedRound: 1 }],
        {
          'Human::activeBuffs': [{ name: 'Haste', effect: 'haste', duration: 3 }],
          'Human::activeConditions': ['poisoned'],
          'Human::conditionEffects': { saveAdvantageCount: 1, saveAdvantageAbilities: ['DEX'] },
        },
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeBuffs', [], 'MyCampaign');
      // Haste's own save-advantage bookkeeping winds down...
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Human',
        'conditionEffects',
        { saveAdvantageCount: 0, saveAdvantageAbilities: [] },
        'MyCampaign',
      );
      // ...and NO lethargy-style condition write happens at all
      // (no speed_zero / incapacitated appended to the stored conditions).
      expect(writesTo('Human', 'activeConditions')).toHaveLength(0);
    });
  });

  describe('state-clearing effect types', () => {
    const stateClearingTests = [
      {
        type: 'peerless_athlete_end',
        stage: { activeBuffs: [{ name: 'PeerlessAthlete', effect: 'peerless_athlete', duration: 2 }] },
        checks: [
          { key: 'peerlessAthleteActive', value: false },
          { key: 'activeBuffs', value: [] },
        ],
      },
      {
        type: 'large_form_end',
        stage: { activeBuffs: [{ name: 'LargeForm', effect: 'large_form', duration: 2 }] },
        checks: [
          { key: 'largeFormActive', value: false },
          { key: 'activeBuffs', value: [] },
        ],
      },
      {
        type: 'remove_bardic_inspiration',
        checks: [
          { key: 'bardicInspirationDie', value: null },
          { key: 'bardicInspirationGrantedBy', value: null },
          { key: 'bardicInspirationCombatOptions', value: null },
        ],
      },
      {
        type: 'inspiring_movement_no_oa',
        checks: [
          { key: 'inspiringMovementNoOA', value: null },
        ],
      },
      {
        type: 'inspiring_movement_granted',
        checks: [
          { key: 'inspiringMovementGranted', value: null },
        ],
      },
      {
        // remove_natures_sanctuary expiry is owned HERE (cited by
        // naturesSanctuaryHandler.test.js:9) — flag clears AND the log.
        type: 'remove_natures_sanctuary',
        checks: [
          { key: 'naturesSanctuaryActive', value: null },
          { key: 'naturesSanctuaryMoves', value: null },
          { key: 'naturesSanctuaryRange', value: null },
          { key: 'naturesSanctuaryResistance', value: null },
          { key: 'naturesSanctuaryCreatures', value: null },
        ],
        abilityName: "Nature's Sanctuary",
      },
      {
        type: 'maneuvering_step_granted',
        checks: [
          { key: 'maneuveringStepGranted', value: null },
          { key: 'maneuveringStepNoOA', value: null },
          { key: 'maneuveringStepNoOASource', value: null },
        ],
      },
      {
        type: 'remove_bulwark_of_force',
        checks: [
          { key: 'bulwarkOfForceActive', value: null },
          { key: 'bulwarkOfForceTargets', value: null },
        ],
      },
      {
        type: 'unbreakable_majesty',
        checks: [
          { key: 'unbreakableMajestyActive', value: null },
          { key: 'unbreakableMajestySaveDc', value: null },
        ],
      },
      {
        type: 'remove_cosmic_omen',
        checks: [
          { key: 'cosmicOmenEffect', value: null },
        ],
      },
      {
        type: 'remove_regenerate_buff',
        checks: [
          { key: 'regenerateActive', value: null },
          { key: 'regenerateSource', value: null },
        ],
      },
    ];

    it.each(stateClearingTests)(
      'clears $type state',
      ({ type, stage = {}, checks, abilityName }) => {
        emptyRuntime(
          [{ target: 'Human', effects: [{ type }], appliedRound: 1 }],
          Object.fromEntries(Object.entries(stage).map(([k, v]) => [`Human::${k}`, v])),
        );

        clearAllExpirationEffects('Goblin', 'MyCampaign');

        for (const check of checks) {
          expect(setRuntimeValue).toHaveBeenCalledWith(
            'Human',
            check.key,
            check.value,
            'MyCampaign',
          );
        }
        if (abilityName) {
          expect(addEntry).toHaveBeenCalledWith('MyCampaign', expect.objectContaining({ abilityName }));
        }
      },
    );
  });

  describe('tashas_laughter_expiration effect type', () => {
    // Simple-name dispatch via the same wrapper is pinned by #1285 :112;
    // this pins the whitespace→underscore damage-trigger key transformation.
    it('resets the damage trigger flag under the space-to-underscore key', () => {
      emptyRuntime(
        [{ target: 'Orc War Chief', effects: [{ type: 'tashas_laughter_expiration' }], appliedRound: 1 }],
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Orc War Chief',
        'tashas_laughter_Orc_War_Chief_damageTrigger',
        false,
        'MyCampaign',
      );
    });
  });

  describe('speed_zero effect type', () => {
    it('removes speed_zero from activeConditions, leaving the surviving bytes', () => {
      emptyRuntime(
        [{ target: 'Human', effects: [{ type: 'speed_zero' }], appliedRound: 1 }],
        { 'Human::activeConditions': ['speed_zero', 'poisoned'] },
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeConditions', ['poisoned'], 'MyCampaign');
    });
  });

  describe('remove_feign_death_buff effect type', () => {
    it('removes the buff and exactly blinded+incapacitated+speed_zero, converging to the surviving bytes', () => {
      const myList = [
        { target: 'Human', effects: [{ type: 'remove_feign_death_buff', buffName: 'FeignDeath' }], appliedRound: 1 },
      ];
      // Stateful store: each sequential condition removal READS the previous
      // write, so the final bytes prove the cumulative behavior — a static
      // mock would let a handler that removed only ONE condition still pass.
      const store = {
        'Human::activeBuffs': [{ name: 'FeignDeath', duration: 3 }, { name: 'OtherBuff', duration: 2 }],
        'Human::activeConditions': ['blinded', 'incapacitated', 'speed_zero', 'poisoned'],
      };
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === KEY) return name === 'Goblin' ? myList : [];
        return store[`${name}::${key}`] ?? null;
      });
      setRuntimeValue.mockImplementation((name, key, value) => {
        store[`${name}::${key}`] = value;
      });

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(store['Human::activeConditions']).toEqual(['poisoned']);
      expect(store['Human::activeBuffs']).toEqual([{ name: 'OtherBuff', duration: 2 }]);
    });
  });

  describe('avenging_angel_aura effect type', () => {
    it('removes target from aura targets list', () => {
      emptyRuntime(
        [{ target: 'Human', effects: [{ type: 'avenging_angel_aura' }], appliedRound: 1 }],
        { 'Goblin::avengingAngelAuraTargets': ['Human', 'Elf'] },
      );

      clearAllExpirationEffects('Goblin', 'MyCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'avengingAngelAuraTargets', ['Elf'], 'MyCampaign');
    });
  });
});

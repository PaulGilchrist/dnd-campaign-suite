// @maintained-by-ai
/**
 * Lane: the distinct effect TYPES dispatched by the EXPIRATION_HANDLERS table
 * in clearExpirationEffects.js that no other lane pins. Tested at the unit
 * seam (clearExpirationEffects called directly) so surrounding queue/rest
 * writes cannot mask a broken handler dispatch.
 *
 * Owned elsewhere — do not duplicate here:
 *   - main queue types (condition, stunned, speed_zero, remove_active_buff,
 *     feign death, haste, bardic/maneuver flags, etc.): clearExpirationEffects.test.js
 *   - outgoing/incoming queue wiring + Infinity purge seam:
 *     clearAllExpirationEffects_additional.test.js
 *   - rest-scene cleanup (Otto, Flesh to Stone, Prismatic Spray, 8h preserve):
 *     clearAllExpirationEffects_rest_cleanup.test.js
 *   - remove_aura_of_life_buff / aura_of_life_hp_protection_end:
 *     clearExpirationEffects.aura-of-life.test.js (SP-008, stronger merged-write pin)
 *   - hurl_through_hell_return / calm_emotions_end / fly_speed_equals_walk_speed /
 *     dragon_wings / frightful_presence_immunity_grant / weakening_breath_auto_success:
 *     their per-spell clearExpirationEffects.*.test.js files
 *   - Holy Nimbus damage: auraDamageService.test.js + expirations_applyAuraDamage.test.js
 *
 * Cited by: smiteOfProtectionHandler.test.js (remove_smite_of_protection expiry
 * side) and SilenceModal.test.jsx (clear_silence_zone zone consumption).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
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
  getCombatSummary: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
  restoreSuppressedConditions: vi.fn(),
}));

vi.mock('../../combat/summons/summonedCreatureService.js', () => ({
  removeSummonedCreatures: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/polymorphService.js', () => ({
  revertPolymorph: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/animalShapesService.js', () => ({
  revertAnimalShapes: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/truePolymorphService.js', () => ({
  revertTruePolymorph: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/shapechangeService.js', () => ({
  revertShapechange: vi.fn(),
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';
import { addEntry } from '../../ui/logService.js';
import { breakConcentration, cleanupConcentrationEffects } from '../../combat/concentration/concentrationService.js';
import { removeSummonedCreatures } from '../../combat/summons/summonedCreatureService.js';
import { revertPolymorph } from '../../automation/handlers/spells/polymorphService.js';
import { revertAnimalShapes } from '../../automation/handlers/spells/animalShapesService.js';
import { revertTruePolymorph } from '../../automation/handlers/spells/truePolymorphService.js';
import { revertShapechange } from '../../automation/handlers/spells/shapechangeService.js';

const CAMPAIGN = 'MyCampaign';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
  utils.getName.mockImplementation((v) => String(v));
  // Baseline: empty runtime. Each test overrides exactly the reads it stages.
  getRuntimeValue.mockImplementation(() => null);
}

// Writes recorded for one (name, key) pair.
const writesTo = (name, key) =>
  setRuntimeValue.mock.calls.filter((c) => c[0] === name && c[1] === key);

// ---------------------------------------------------------------------------
// Shape-family types: each routes to its own revert service
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — shape-family types', () => {
  beforeEach(resetMocks);

  it('routes polymorph, animal_shapes, true_polymorph and shapechange to their own revert services', () => {
    clearExpirationEffects(
      [
        { type: 'polymorph' },
        { type: 'animal_shapes' },
        { type: 'true_polymorph' },
        { type: 'shapechange' },
      ],
      'Orc', 'Caster', CAMPAIGN,
    );

    // Each type dispatches to exactly its own service, exactly once —
    // a mis-wired handler breaks the times(1) or the not-called pair.
    expect(revertPolymorph).toHaveBeenCalledTimes(1);
    expect(revertAnimalShapes).toHaveBeenCalledTimes(1);
    expect(revertTruePolymorph).toHaveBeenCalledTimes(1);
    expect(revertShapechange).toHaveBeenCalledTimes(1);
    for (const revert of [revertPolymorph, revertAnimalShapes, revertTruePolymorph, revertShapechange]) {
      expect(revert).toHaveBeenCalledWith('Orc', CAMPAIGN);
    }
  });
});

// ---------------------------------------------------------------------------
// charmed / dominated: both map to removing the charmed condition
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — charmed and dominated types', () => {
  beforeEach(resetMocks);

  it.each(['charmed', 'dominated'])(
    "'%s' expiry strips the charmed condition from the target and preserves other conditions",
    (type) => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Orc' && key === 'activeConditions') return ['charmed', 'poisoned'];
        return null;
      });

      clearExpirationEffects([{ type }], 'Orc', 'Caster', CAMPAIGN);

      expect(setRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions', ['poisoned'], CAMPAIGN);
      // No condition write anywhere may still carry 'charmed'
      // (covers both the activeConditions and NPC-condition legs).
      for (const call of setRuntimeValue.mock.calls) {
        if (Array.isArray(call[2])) {
          expect(call[2]).not.toContain('charmed');
        }
      }
    },
  );
});

// ---------------------------------------------------------------------------
// break_concentration
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — break_concentration', () => {
  beforeEach(resetMocks);

  it('breaks the concentration, cleans up its effects, persists the summary and broadcasts', () => {
    const cs = { creatures: [{ name: 'Caster', concentration: { spell: 'Fireball' } }] };
    getCombatSummary.mockReturnValue(cs);
    breakConcentration.mockReturnValue('Fireball');

    clearExpirationEffects([{ type: 'break_concentration' }], 'Caster', 'Attacker', CAMPAIGN);

    expect(breakConcentration).toHaveBeenCalledWith(cs, 'Caster');
    expect(cleanupConcentrationEffects).toHaveBeenCalledWith('Caster', 'Fireball', CAMPAIGN);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent.mock.calls[0][0].type).toBe('combat-summary-updated');
  });

  it('does nothing when there is no combat summary', () => {
    getCombatSummary.mockReturnValue(null);

    clearExpirationEffects([{ type: 'break_concentration' }], 'Caster', 'Attacker', CAMPAIGN);

    expect(breakConcentration).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it('persists nothing when the caster holds no concentration to break', () => {
    const cs = { creatures: [{ name: 'Caster', concentration: null }] };
    getCombatSummary.mockReturnValue(cs);
    breakConcentration.mockReturnValue(null);

    clearExpirationEffects([{ type: 'break_concentration' }], 'Caster', 'Attacker', CAMPAIGN);

    expect(breakConcentration).toHaveBeenCalledWith(cs, 'Caster');
    expect(cleanupConcentrationEffects).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clear_runtime_value
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — clear_runtime_value', () => {
  beforeEach(resetMocks);

  it('nulls the named key on effect.creatureName — not on the expiration target', () => {
    clearExpirationEffects(
      [{ type: 'clear_runtime_value', creatureName: 'Caster', key: 'myCustomFlag' }],
      'UnrelatedTarget', 'Attacker', CAMPAIGN,
    );

    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Caster', 'myCustomFlag', null, CAMPAIGN);
    expect(writesTo('UnrelatedTarget', 'myCustomFlag')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// remove_smite_of_protection (cited by smiteOfProtectionHandler.test.js)
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — remove_smite_of_protection', () => {
  beforeEach(resetMocks);

  it.each([
    { stored: 3, expected: 4, label: 'increments the existing coverRefresh count' },
    { stored: null, expected: 1, label: 'starts coverRefresh at 1 when none was recorded' },
  ])('$label', ({ stored, expected }) => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'coverRefresh') return stored;
      return null;
    });

    clearExpirationEffects([{ type: 'remove_smite_of_protection' }], 'Paladin', 'Attacker', CAMPAIGN);

    expect(setRuntimeValue).toHaveBeenCalledWith('Paladin', 'smiteOfProtectionActive', null, CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'coverRefresh', expected, CAMPAIGN);
  });
});

// ---------------------------------------------------------------------------
// clear_silence_zone (cited by SilenceModal.test.jsx zone consumption)
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — clear_silence_zone', () => {
  beforeEach(resetMocks);

  it('strips Deafened from this caster\'s silenced targets and removes only this caster\'s silenced targetEffects', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [
        { effect: 'silenced', source: 'Caster', target: 'Orc' },
        { effect: 'silenced', source: 'Caster', target: 'Human' },
        { effect: 'silenced', source: 'OtherCaster', target: 'Troll' },
        { effect: 'slow', source: 'Caster', target: 'Orc' },
      ];
      if (name === 'Orc' && key === 'activeConditions') return ['deafened', 'poisoned'];
      if (name === 'Human' && key === 'activeConditions') return ['deafened', 'fatigued'];
      if (name === 'Troll' && key === 'activeConditions') return ['deafened'];
      return null;
    });

    clearExpirationEffects(
      [{ type: 'clear_silence_zone', casterName: 'Caster' }],
      'Caster', 'Caster', CAMPAIGN,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith('Orc', 'activeConditions', ['poisoned'], CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeConditions', ['fatigued'], CAMPAIGN);
    // Exact payload: another caster's silence and an unrelated slow survive.
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
      { effect: 'silenced', source: 'OtherCaster', target: 'Troll' },
      { effect: 'slow', source: 'Caster', target: 'Orc' },
    ], CAMPAIGN);
    // The foreign-zone Troll is never touched.
    expect(setRuntimeValue.mock.calls.filter((c) => c[0] === 'Troll')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// dispatcher contract: unknown types are inert
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — unknown effect types', () => {
  beforeEach(resetMocks);

  it('ignores unknown types without writing anything', () => {
    clearExpirationEffects([{ type: 'not_a_registered_type' }], 'Orc', 'Caster', CAMPAIGN);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(revertPolymorph).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// remove_summoned_creatures (SP-114)
// ---------------------------------------------------------------------------
describe('clearExpirationEffects — SP-114 remove_summoned_creatures', () => {
  beforeEach(resetMocks);

  it('clears the matching caster concentration, persists the summary, removes summons and logs', () => {
    const cs = {
      creatures: [
        { name: 'Wizard', concentration: { spell: 'Summon Aberration', dc: 18 } },
        { name: 'Aberrant Spirit (Mind Flayer)', summonedBy: 'Wizard', summonSource: 'spell' },
      ],
    };
    getCombatSummary.mockReturnValue(cs);

    clearExpirationEffects(
      [{ type: 'remove_summoned_creatures', spell: 'Summon Aberration' }],
      'Wizard', 'Wizard', 'test-campaign',
    );

    expect(cs.creatures.find((c) => c.name === 'Wizard').concentration).toBeNull();
    expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'test-campaign');
    expect(removeSummonedCreatures).toHaveBeenCalledWith('Wizard', 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'summons',
      characterName: 'Wizard',
      summonName: 'Summon Aberration',
      description: 'Summon Aberration ends — summoned creatures disappear.',
    }));
  });

  it('leaves a different concentration spell on the caster intact but still removes summons', () => {
    const cs = {
      creatures: [{ name: 'Wizard', concentration: { spell: 'Slow', dc: 18 } }],
    };
    getCombatSummary.mockReturnValue(cs);

    clearExpirationEffects(
      [{ type: 'remove_summoned_creatures', spell: 'Summon Aberration' }],
      'Wizard', 'Wizard', 'test-campaign',
    );

    expect(cs.creatures[0].concentration.spell).toBe('Slow');
    expect(storage.set).not.toHaveBeenCalled();
    expect(removeSummonedCreatures).toHaveBeenCalledWith('Wizard', 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'summons',
      characterName: 'Wizard',
    }));
  });
});

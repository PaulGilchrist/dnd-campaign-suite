// @maintained-by-ai
/**
 * LANE (family seam map in 2024-immunities.test.js header): addTraits/getTraits
 * only — species trait categorization through the REAL categories2024 binding,
 * lineage sub_traits extraction ('Trait (Lineage)' suffix), and the base →
 * lineage → subrace merge order. Other aspects live in 2024-race / -senses /
 * -resistances / -immunities / -racial-bonus; 5e mirror is 5e-traits.
 *
 * CONSUMERS (liveness): rules-actions.js:12 assigns getTraits output and folds
 * every lane into the player's action lists, so exact per-category membership,
 * order, and the buildItemSummary envelope are the contract.
 *
 * DISK ANCHOR: public/data/2024/races.json (verified 2026-10-16). Disk routing
 * is automation.casting_time-driven (Breath Weapon '1 action', Stonecunning
 * '1 bonus action', Stone's Endurance '1 reaction', Powerful Build 'passive')
 * plus categories2024 name lists (Draconic Ancestry/Fiendish Legacies →
 * characterAdvancement). featuresToIgnore is NOT read by categorizeFeatures —
 * Darkvision/Trance land in specialActions.
 *
 * #1916-FLAG (report-not-fix): "sub_traits" appears in ZERO files under
 * public/ (not just getRace's selectedLineage branch, but getTraits'
 * sub_traits extraction 2024.js:190-209 too) — every sub_traits fixture here
 * is labeled synthetic sheet/GM-supplied shape. Related latent hazard:
 * 2024.js:190 reads playerStats.race.traits WITHOUT ?. after a runtime-only
 * lineage resolves — a truthy runtime selection with no race would throw;
 * reported, not pinned here.
 *
 * RUNTIME SEAM: getTraits lineage channel (2024.js:187-189) = race.lineage ||
 * runtime '_gnomishLineageSelection' || resolveElfishLineage (which is
 * race.lineage || race.subrace.name || runtime '_elfishLineageSelection',
 * CLA-118). So in THIS lane gnomish runtime outranks elven subrace — an
 * asymmetry distinct from resolveGnomishLineage (2024.js:229-233, subrace
 * last) and from the elf speed lane (subrace first). getRuntimeValue is a
 * mutable vi.fn; afterEach mockReset restores the () => null baseline
 * (clearAllMocks would NOT undo mockImplementation). No ui/utils.js mock: the
 * traits lane never calls getAbilityLongName (getRace lane only).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import raceRules from './2024.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Mutable runtime-store seam; default null = nothing selected.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null)
}));

afterEach(() => {
  // Vitest ≥2: mockReset restores the original () => null implementation.
  getRuntimeValue.mockReset();
});

const runtimeSelection = (map) =>
  getRuntimeValue.mockImplementation((name, key) => map[key] ?? null);

// public/data/2024/races.json — Elf, verbatim (no automation on either).
const ELF_DARKVISION = {
  name: 'Darkvision',
  description: 'You have darkvision with a range of 60 feet.'
};
const ELF_TRANCE = {
  name: 'Trance',
  description: "You don't need to sleep, and magic can't put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trance-like meditation, during which you retain consciousness."
};

// Synthetic — no disk trait carries sub_traits (#1916 flag in header).
const LINEAGE_HOST_TRAIT = {
  name: 'Ancestry',
  sub_traits: [
    { name: 'High Elf', description: 'High Elf lineage description.' },
    { name: 'Wood Elf', description: 'Wood Elf lineage description.' }
  ]
};

const emptyEnvelope = {
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  characterAdvancement: []
};

describe('raceRules 2024 - addTraits', () => {
  it.each([[], [null, undefined], null, undefined])(
    'returns the exact empty envelope for %s input (exact-set)',
    (input) => {
      expect(raceRules.addTraits(input)).toEqual(emptyEnvelope);
    }
  );

  it('routes disk-anchored 2024 traits through casting_time and the real categories2024 name lists (exact per-category sets)', () => {
    const traits = [
      { name: 'Breath Weapon', description: 'Exhale destructive energy.', automation: { type: 'save_attack', casting_time: '1 action' } },
      { name: 'Stonecunning', description: 'Tremorsense bonus action.', automation: { casting_time: '1 bonus action' } },
      { name: "Stone's Endurance", description: 'Roll 1d12 to reduce damage.', automation: { type: 'stones_endurance', casting_time: '1 reaction' } },
      { name: 'Draconic Ancestry', description: 'Choose a dragon progenitor.' },
      { name: 'Fiendish Legacies', description: 'Choose a fiendish legacy.' },
      ELF_DARKVISION,
      ELF_TRANCE
    ];
    const result = raceRules.addTraits(traits);
    // name-list routing only when no casting_time exists (Draconic Ancestry /
    // Fiendish Legacies → characterAdvancement); featuresToIgnore is never
    // read, so Darkvision/Trance fall through to specialActions.
    expect(result.actions.map((t) => t.name)).toEqual(['Breath Weapon']);
    expect(result.bonusActions.map((t) => t.name)).toEqual(['Stonecunning']);
    expect(result.reactions.map((t) => t.name)).toEqual(["Stone's Endurance"]);
    expect(result.characterAdvancement.map((t) => t.name)).toEqual(['Draconic Ancestry', 'Fiendish Legacies']);
    // full-string disk-verbatim description + buildItemSummary envelope shape
    expect(result.specialActions).toEqual([ELF_DARKVISION, ELF_TRANCE].map((t) => ({
      name: t.name,
      level: null,
      description: t.description,
      details: undefined,
      automation: undefined
    })));
  });
});

describe('raceRules 2024 - getTraits', () => {
  it('returns the exact empty envelope for missing/empty sources ({}, raceless, traitsless, lineage-without-traits)', () => {
    for (const input of [{}, { race: {} }, { race: { traits: [] } }, { race: { lineage: 'High Elf' } }]) {
      expect(raceRules.getTraits(input)).toEqual(emptyEnvelope);
    }
  });

  it('passes Elf base traits through to specialActions with verbatim disk descriptions, other lanes empty (exact sets)', () => {
    const result = raceRules.getTraits({ race: { traits: [ELF_DARKVISION, ELF_TRANCE] } });
    expect(result.specialActions).toEqual([ELF_DARKVISION, ELF_TRANCE].map((t) => ({
      name: t.name,
      level: null,
      description: t.description,
      details: undefined,
      automation: undefined
    })));
    expect(result.actions).toEqual([]);
    expect(result.bonusActions).toEqual([]);
    expect(result.reactions).toEqual([]);
    expect(result.characterAdvancement).toEqual([]);
  });

  it.each([
    ['race.lineage wins even when runtime disagrees', { lineage: 'High Elf' }, { _gnomishLineageSelection: 'Wood Elf' }, 'High Elf'],
    ['runtime _gnomishLineageSelection (2024.js:188) injects with no sheet lineage', {}, { _gnomishLineageSelection: 'Wood Elf' }, 'Wood Elf'],
    ['elven subrace.name resolves via resolveElfishLineage', { subrace: { name: 'High Elf' } }, {}, 'High Elf'],
    ['legacy runtime _elfishLineageSelection is the last channel', {}, { _elfishLineageSelection: 'Wood Elf' }, 'Wood Elf'],
    ['gnomish runtime outranks elven subrace (this lane\'s asymmetry)', { subrace: { name: 'High Elf' } }, { _gnomishLineageSelection: 'Wood Elf' }, 'Wood Elf']
  ])('lineage channel precedence — %s (synthetic sub_traits, #1916)', (_label, raceFields, runtimeMap, expectedLineage) => {
    runtimeSelection(runtimeMap);
    const result = raceRules.getTraits({
      name: 'Tester',
      campaignName: 'test-campaign',
      race: { traits: [{ ...ELF_DARKVISION }, LINEAGE_HOST_TRAIT], ...raceFields }
    });
    expect(result.specialActions).toEqual([
      { name: 'Darkvision', level: null, description: ELF_DARKVISION.description, details: undefined, automation: undefined },
      // host trait passes through categorization untouched (description-less
      // row) — disk-dead lane artifact, pinned honestly (#1916 flag)
      { name: 'Ancestry', level: null, description: undefined, details: undefined, automation: undefined },
      { name: `Ancestry (${expectedLineage})`, level: null, description: `${expectedLineage} lineage description.`, details: null, automation: undefined }
    ]);
  });

  it('injects a lineage trait only on exact sub_traits name match; no-match and sub_traits-less hosts inject nothing (synthetic)', () => {
    // lineage resolved but host trait has no sub_traits → base traits only
    expect(raceRules.getTraits({ race: { lineage: 'High Elf', traits: [ELF_DARKVISION] } }).specialActions.map((t) => t.name))
      .toEqual(['Darkvision']);
    // sub_traits present but no entry matches the resolved lineage — only
    // the description-less host row survives, nothing is injected
    expect(raceRules.getTraits({ race: { lineage: 'High Elf', traits: [{ name: 'Ancestry', sub_traits: [{ name: 'Drow', description: 'Drow.' }] } ] } }).specialActions)
      .toEqual([{ name: 'Ancestry', level: null, description: undefined, details: undefined, automation: undefined }]);
    // mismatch picks the exact sibling only, suffix carries the sub_trait name
    const result = raceRules.getTraits({ race: { lineage: 'Wood Elf', traits: [LINEAGE_HOST_TRAIT] } });
    expect(result.specialActions).toEqual([
      { name: 'Ancestry', level: null, description: undefined, details: undefined, automation: undefined },
      { name: 'Ancestry (Wood Elf)', level: null, description: 'Wood Elf lineage description.', details: null, automation: undefined }
    ]);
  });

  it('merges in base → lineage → subrace order with base entries winning duplicates (exact set)', () => {
    const result = raceRules.getTraits({
      race: {
        lineage: 'High Elf',
        traits: [
          { name: 'Darkvision', description: 'Base darkvision' },
          LINEAGE_HOST_TRAIT
        ],
        subrace: {
          traits: [
            { name: 'Darkvision', description: 'Subrace darkvision' },
            { name: 'Subrace Trait', description: 'Appended last' }
          ]
        }
      }
    });
    // discriminating merge pin: the surviving Darkvision is the BASE one,
    // and order is base (incl. host row) → injected lineage → subrace
    expect(result.specialActions).toEqual([
      { name: 'Darkvision', level: null, description: 'Base darkvision', details: undefined, automation: undefined },
      { name: 'Ancestry', level: null, description: undefined, details: undefined, automation: undefined },
      { name: 'Ancestry (High Elf)', level: null, description: 'High Elf lineage description.', details: null, automation: undefined },
      { name: 'Subrace Trait', level: null, description: 'Appended last', details: undefined, automation: undefined }
    ]);
  });

  it('Goliath + Stone Giant subrace traits land in their disk-defined categories (exact sets)', () => {
    const result = raceRules.getTraits({
      name: 'Tester',
      campaignName: 'test-campaign',
      race: {
        name: 'Goliath',
        traits: [
          { name: 'Large Form', description: 'Expanded reach.', automation: { casting_time: '1 bonus action' } },
          { name: 'Powerful Build', description: 'Counted as one size larger.', automation: { casting_time: 'passive' } }
        ],
        subrace: {
          name: 'Stone Giant',
          traits: [{ name: "Stone's Endurance", description: 'Roll 1d12 + CON to reduce damage.', automation: { type: 'stones_endurance', casting_time: '1 reaction' } }]
        }
      }
    });
    expect(result.actions).toEqual([]);
    expect(result.bonusActions.map((t) => t.name)).toEqual(['Large Form']);
    expect(result.reactions.map((t) => t.name)).toEqual(["Stone's Endurance"]);
    expect(result.specialActions.map((t) => t.name)).toEqual(['Powerful Build']);
    expect(result.characterAdvancement).toEqual([]);
  });
});

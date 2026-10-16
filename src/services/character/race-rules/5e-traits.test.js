// @maintained-by-ai
/**
 * LANE (family seam map in 2024-immunities.test.js header; 5e half opens in
 * ./5e-immunities.test.js, both cited never edited): addTraits/getTraits only —
 * racial trait categorization through the REAL getCategories('5e') binding and
 * the base → subrace.racial_traits merge. Other aspects live in 5e-race /
 * -senses / -resistances / -immunities / -racial-bonus; the 2024 mirror is
 * 2024-traits.test.js; generic categorizer routing/dedupe/null-skip is owned
 * by featureCategorizationUtils.test.js pure lane — not re-pinned here.
 *
 * MIRROR DELTAS vs 2024-traits (pinned, do not inherit 2024 claims):
 *  - getTraits THROWS TypeError on missing race (unchained playerStats.race
 *    .traits at 5e.js:119) — never the 2024 empty-envelope-on-{} contract.
 *  - NO runtime lineage channel: 5e.js has zero getRuntimeValue calls
 *    (verified on disk) — no mocks needed, fully deterministic.
 *  - subrace traits are read from subrace.racial_traits (5e.js:120-121),
 *    NOT subrace.traits — a subrace carrying only .traits contributes
 *    nothing, pinned as a negative here.
 *
 * DISK ANCHOR: public/data/races.json (verified 2026-10-16). Routing is
 * automation.casting_time-driven: Breath Weapon/Half-Orc features '1 action',
 * Stonecunning '1 bonus action', Fey Ancestry/Dwarven Resilience 'passive'
 * (→ specialActions: passive only reaches characterAdvancement for names in
 * that list). The active 5e name lists (actions ['Avenging Angel'], reactions
 * ['Bend Luck'], characterAdvancement ['Mystic Arcanum'], bonusActions [])
 * collide with NO races.json trait, so every non-timed race trait lands in
 * specialActions; featuresToIgnore is not read by categorizeFeatures at all.
 * There is no '1 reaction' casting_time anywhere in races.json.
 *
 * CONSUMERS (liveness): rules-actions.js:12 assigns getTraits output and folds
 * every lane into the player's action lists; raceTraits.js lives via rules.js —
 * so exact per-category membership, order, and the buildItemSummary envelope
 * (extra keys like index/proficiencies/trait_specific are dropped; automation
 * passes through) are the contract.
 *
 * #1916-FLAG (report-not-fix): raceRules.addTraits has no consumer outside
 * this module besides getTraits itself — a public export exercised only
 * through the getTraits lane here.
 */
import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

// public/data/races.json — Elf traits verbatim (Darkvision/Trance carry no
// automation; Fey Ancestry declares casting_time 'passive').
const ELF_DARKVISION = {
  index: 'darkvision',
  name: 'Darkvision',
  description: 'You have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You cannot discern color in darkness, only shades of gray.',
  proficiencies: []
};
const ELF_FEY_ANCESTRY = {
  index: 'fey-ancestry',
  name: 'Fey Ancestry',
  description: 'You have advantage on saving throws against being charmed, and magic cannot put you to sleep.',
  proficiencies: [],
  automation: { type: 'conditional_advantage', target: 'saving_throw', condition: 'charmed', effect: 'advantage', casting_time: 'passive' }
};
const ELF_TRANCE = {
  index: 'trance',
  name: 'Trance',
  description: 'Elves do not need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day. (The Common word for such meditation is "trance.") While meditating, you can dream after a fashion; such dreams are actually mental exercises that have become reflexive through years of practice. After resting this way, you gain the same benefit that a human does from 8 hours of sleep.',
  proficiencies: []
};
// public/data/races.json — Elf > High Elf racial_traits verbatim; the
// trait_specific spell_options payload must NOT reach the summary envelope.
const HIGH_ELF_CANTRIP = {
  index: 'high-elf-cantrip',
  name: 'High Elf Cantrip',
  description: 'You know one cantrip of your choice form the wizard spell list. Intelligence is your spellcasting ability for it.',
  proficiencies: [],
  trait_specific: { spell_options: { choose: 1, from: ['Light', 'Mage Hand'] } }
};

const emptyEnvelope = {
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  characterAdvancement: []
};

// buildItemSummary projection (featureCategorizationUtils): exactly these
// five keys; extra disk keys are dropped, automation passes through.
const summary = (t) => ({
  name: t.name,
  level: null,
  description: t.description,
  details: undefined,
  automation: t.automation
});

describe('raceRules 5e - getTraits', () => {
  it('input contract: THROWS TypeError on missing race (unchained 5e.js:119 — never {} → envelope); traitsless race returns the exact empty envelope', () => {
    expect(() => raceRules.getTraits({})).toThrow(TypeError);
    expect(() => raceRules.getTraits({ name: 'Tester' })).toThrow(TypeError);
    // race present but traitsless is guarded downstream: exact empty envelope
    for (const input of [{ race: {} }, { race: { traits: [] } }]) {
      expect(raceRules.getTraits(input)).toEqual(emptyEnvelope);
    }
    // mirror delta: 2024-style lineage keys are inert here (no lineage channel)
    expect(raceRules.getTraits({ race: { lineage: 'High Elf' } })).toEqual(emptyEnvelope);
  });

  it('no runtime channel: subrace carrying only .traits contributes nothing — the lane reads subrace.racial_traits only', () => {
    const result = raceRules.getTraits({
      race: {
        traits: [ELF_DARKVISION],
        subrace: {
          name: 'High Elf',
          traits: [{ name: 'Wrong Field', description: '2024-shaped field, must be ignored' }]
        }
      }
    });
    expect(result.specialActions.map((t) => t.name)).toEqual(['Darkvision']);
    expect(result).toEqual({ ...emptyEnvelope, specialActions: [summary(ELF_DARKVISION)] });
  });

  it('real disk casting_time routes traits into their categories (Elf/Dwarf/Dragonborn verbatim, exact sets)', () => {
    // Elf: passive Fey Ancestry falls through to specialActions (passive only
    // reaches characterAdvancement for names listed there — none are races)
    const elf = raceRules.getTraits({ race: { traits: [ELF_DARKVISION, ELF_FEY_ANCESTRY, ELF_TRANCE] } });
    expect(elf.specialActions).toEqual([summary(ELF_DARKVISION), summary(ELF_FEY_ANCESTRY), summary(ELF_TRANCE)]);
    expect(elf.actions).toEqual([]);
    expect(elf.bonusActions).toEqual([]);
    expect(elf.reactions).toEqual([]);
    expect(elf.characterAdvancement).toEqual([]);

    // public/data/races.json — Dwarf: Stonecunning '1 bonus action'; passive
    // Dwarven Resilience and un-timed Darkvision/Tool Proficiency stay special
    const dwarf = raceRules.getTraits({
      race: {
        traits: [
          ELF_DARKVISION,
          { index: 'dwarven-resilience', name: 'Dwarven Resilience', description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.', proficiencies: [], automation: { type: 'conditional_advantage', target: 'saving_throw', condition: 'poison', effect: 'advantage', casting_time: 'passive' } },
          { index: 'stonecunning', name: 'Stonecunning', description: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.', proficiencies: [], automation: { type: 'stonecunning', effect: 'tremorsense_60ft', uses: 'proficiency_bonus', recharge: 'long_rest', casting_time: '1 bonus action' } }
        ]
      }
    });
    expect(dwarf.bonusActions.map((t) => t.name)).toEqual(['Stonecunning']);
    // automation object survives into the envelope verbatim
    expect(dwarf.bonusActions[0].automation.casting_time).toBe('1 bonus action');
    expect(dwarf.specialActions.map((t) => t.name)).toEqual(['Darkvision', 'Dwarven Resilience']);
    expect(dwarf.actions).toEqual([]);

    // public/data/races.json — Dragonborn: Breath Weapon '1 action' → actions
    const dragonborn = raceRules.getTraits({
      race: {
        traits: [
          { name: 'Draconic Ancestry', description: 'You have draconic ancestry. Choose one type of dragon from the Draconic Ancestry table.' },
          { name: 'Breath Weapon', description: 'You can use your action to exhale destructive energy.', automation: { type: 'save_attack', damage: '2d6', damageType: 'variable', saveType: 'DEX', saveDc: 'ability', shape: 'variable', uses: 1, recharge: 'short_rest', casting_time: '1 action' } }
        ]
      }
    });
    expect(dragonborn.actions.map((t) => t.name)).toEqual(['Breath Weapon']);
    expect(dragonborn.specialActions.map((t) => t.name)).toEqual(['Draconic Ancestry']);
  });

  it('merges base traits + verbatim High Elf racial_traits in base-first order; duplicate names collapse with the BASE entry winning (exact sets)', () => {
    const result = raceRules.getTraits({
      race: {
        traits: [
          { ...ELF_DARKVISION, description: 'Base darkvision' },
          ELF_FEY_ANCESTRY,
          ELF_TRANCE
        ],
        subrace: {
          name: 'High Elf',
          racial_traits: [
            // synthetic duplicate — no disk subrace re-lists Darkvision
            { name: 'Darkvision', description: 'Subrace darkvision — must lose to base' },
            HIGH_ELF_CANTRIP
          ]
        }
      }
    });
    // exact set: base order preserved, subrace appended, dup dropped, and the
    // surviving Darkvision carries the BASE description (mergeCategorizedFeatures
    // uniqBy name, base first). High Elf Cantrip verbatim minus extra disk keys.
    expect(result.specialActions).toEqual([
      { name: 'Darkvision', level: null, description: 'Base darkvision', details: undefined, automation: undefined },
      summary(ELF_FEY_ANCESTRY),
      summary(ELF_TRANCE),
      summary(HIGH_ELF_CANTRIP)
    ]);
    expect(result.actions).toEqual([]);
    expect(result.bonusActions).toEqual([]);
    expect(result.reactions).toEqual([]);
    expect(result.characterAdvancement).toEqual([]);
  });
});

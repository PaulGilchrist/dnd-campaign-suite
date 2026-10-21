// @maintained-by-ai
// CLA-231 regression: Mystic Arcanum spells (class.arcanums) are slotless free
// casts and must survive the "no spell slots at this level" filter in
// spellCalc2024.getSpellAbilities. Warlock Pact Magic slots cap at lv5, so
// before the fix every lv6+ arcanum was silently dropped from the sheet.
//
// Arcanum lane pins (spellCalc2024.js): grant from class.arcanums via the
// spells-DB (applyAutomationSpellGrants, deduped), the name-scoped exemption
// in keepSpellRow, and the arcanumNames set derived from class.arcanums.
// Unlock-gate canon (lv7/9/12/15) is owned by classRules2024.test.js; cast
// payment via mysticArcanumLevel counters is owned by
// spellPreparationService.isFreeCastAuthorized.test.js.
import { describe, it, expect, vi } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

// True collaborators on this path: runtime store (Spell Mastery / Savant reads)
// and the classRules major-table fallback. No call-count assertions, so no resets.
vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: () => undefined,
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: () => null,
}));

// ── Fixtures ──
// lv14 Pact Magic table mirrors public/data/2024/classes.json Warlock lv14:
// 3x lv5 slots, nothing at lv6+ — the capped table that made CLA-231 lethal.
// Only class_levels[level - 1] is read, so the 13 placeholders stay inert.
function makeWarlockStats({ arcanums = ['Eyebite', 'Etherealness'], spells = ['Eldritch Blast', 'Hex', 'Seeming'] } = {}) {
  return {
    name: 'HexWarlock',
    level: 14,
    proficiency: 5,
    class: {
      name: 'Warlock',
      spell_casting_ability: 'Charisma',
      arcanums,
      class_levels: [
        ...Array(13).fill({ level: 0 }),
        {
          level: 14,
          spellcasting: {
            cantrips_known: 4,
            spell_slots_level_1: 0,
            spell_slots_level_2: 0,
            spell_slots_level_3: 0,
            spell_slots_level_4: 0,
            spell_slots_level_5: 3,
            spell_slots_level_6: 0,
            spell_slots_level_7: 0,
            spell_slots_level_8: 0,
            spell_slots_level_9: 0,
            spell_type: 'prepared',
          },
        },
      ],
    },
    abilities: [
      { name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
    ],
    spells,
    automation: {},
  };
}

// Local spells-DB rows (getSpellAbilities consumes the allSpells argument;
// levels match public/data/spells.json canon for the arcanum names).
const spells2024 = [
  { name: 'Eldritch Blast', level: 0, casting_time: '1 action' },
  { name: 'Hex', level: 1, casting_time: '1 bonus action' },
  { name: 'Seeming', level: 5, casting_time: '1 action' },
  { name: 'Eyebite', level: 6, casting_time: '1 action' },
  { name: 'Etherealness', level: 7, casting_time: '1 action' },
  { name: 'Circle of Death', level: 6, casting_time: '1 action' },
];

const rowNames = spells => spells.map(s => s.name);

describe('spellCalc2024 — Mystic Arcanum slotless rows (CLA-231)', () => {
  it('grants selected arcanums above the lv5 Pact Magic cap as Always-prepared rows, deduped and sorted last', () => {
    // Eyebite reaches the sheet ONLY via the arcanums grant (not in known spells);
    // Etherealness is known AND selected — the grant must not double the row.
    // Circle of Death is a known lv6 spell that is NOT an arcanum — it must drop,
    // proving the exemption is name-scoped, not level-wide.
    const stats = makeWarlockStats({
      spells: ['Eldritch Blast', 'Hex', 'Seeming', 'Etherealness', 'Circle of Death'],
    });
    const result = getSpellAbilities(spells2024, stats);

    // precondition: slot table caps at lv5 — the arcanum rows are above it
    expect(result.spell_slots_level_5).toBe(3);
    expect(result.spell_slots_level_6).toBe(0);

    expect(rowNames(result.spells)).toEqual([
      'Eldritch Blast', 'Hex', 'Seeming', 'Eyebite', 'Etherealness',
    ]);
    const byName = name => result.spells.filter(s => s.name === name);
    expect(byName('Eyebite')[0].level).toBe(6);
    expect(byName('Etherealness')).toHaveLength(1);
    expect(result.spells.every(s => s.prepared === 'Always')).toBe(true);
  });

  it('drops arcanum-named lv6+ rows once removed from class.arcanums (exemption set is class.arcanums)', () => {
    // Rows now enter via the known-spells list only, so they survive the
    // pre-filter stages and genuinely die at the slot-level filter.
    const stats = makeWarlockStats({
      arcanums: [],
      spells: ['Eldritch Blast', 'Hex', 'Seeming', 'Eyebite', 'Etherealness'],
    });
    const result = getSpellAbilities(spells2024, stats);

    expect(rowNames(result.spells)).toEqual(['Eldritch Blast', 'Hex', 'Seeming']);
  });
});

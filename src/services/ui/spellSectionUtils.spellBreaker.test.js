// @maintained-by-ai
// CLA-322: Spell Breaker display-override registry helper — this file owns ONLY
// the gate law of isSpellBreakerBonusActionSpell (spellSectionUtils.js:101-106):
// which spell names the sheet rows / popups badge as "bonus action", gated on the
// collector-stamped passives[].type 'spell_breaker' and its stamped
// bonusActionSpells list ONLY (no school re-detection, no casting_time re-read).
// Gate-source law: automationCollector.js:51-59 turns disk passive_rule
// (classes.json 2024 :13366-13385, Abjurer lv10) into the stamped shape below;
// the helper reads that stamped shape, so a raw pre-collector disk shape or a
// same-named feature of another type never fires the badge. 5e regression gate:
// 5e never stamps spell_breaker, so the badge stays false there (arm table).
// Held elsewhere — cite, do not regrow here:
//   - popup "Casting Time:" row: SpellDetailPopup.spellBreaker.test.jsx
//   - table 'BA' time-column remap: CharSpells.Rendering.test.jsx:278
//   - section partitioning base law: CharActions.elderChampion.test.jsx
//   - refund/consume service contracts: helpers-spellBreaker.test.js,
//     counterSpellHandler.spellBreaker.test.js
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  // Exact-of-1 census: spellSectionUtils.js imports only getRuntimeValue (:1).
  // Constant null keeps Elder Champion / active-feature lanes inert so the
  // splitter calls in the section-invariance test are deterministic.
  getRuntimeValue: vi.fn(() => null),
}));

import {
  isSpellBreakerBonusActionSpell,
  getActionSpellNames,
  getBonusActionSpellNames,
  getExcludedSpellNames,
} from './spellSectionUtils.js';

const CAMPAIGN = 'test-campaign';

// Collector-faithful stamped shape (automationCollector.js:54-59), values verbatim
// from disk classes.json 2024 :13366-13385 (Abjurer lv10 'Spell Breaker').
const SPELL_BREAKER = {
  type: 'spell_breaker',
  name: 'Spell Breaker',
  spellLevel: 1,
  alwaysPreparedSpells: ['Counterspell', 'Dispel Magic'],
  bonusActionSpells: ['Dispel Magic'],
  dispelAbilityCheckBonus: 'proficiency_bonus',
  slotRetentionSpells: ['Counterspell', 'Dispel Magic'],
};

const caster = (passives) => ({
  name: 'DivinationWizard',
  automation: { passives },
  spellAbilities: { spells: [] },
});

describe('spellSectionUtils — isSpellBreakerBonusActionSpell gate law (CLA-322)', () => {
  // Disk rows: 2024 spells.json Dispel Magic casting_time 'Action' damage null,
  // Counterspell casting_time 'Reaction' — badgeable only via stamped list.
  it.each([
    ['listed in bonusActionSpells badges (disk: Dispel Magic)', SPELL_BREAKER, 'Dispel Magic', true],
    // Counterspell sits in alwaysPreparedSpells AND slotRetentionSpells on disk —
    // listing there must not leak into the bonus-action badge (gate reads one list).
    ['listed only in alwaysPrepared/slotRetention lists does not badge', SPELL_BREAKER, 'Counterspell', false],
    ['case-exact needle: disk names are Titlecase', SPELL_BREAKER, 'dispel magic', false],
    ['falsy spell name short-circuits', SPELL_BREAKER, '', false],
    ['null spell name short-circuits', SPELL_BREAKER, null, false],
  ])('%s', (_label, passive, spellName, expected) => {
    expect(isSpellBreakerBonusActionSpell(caster([passive]), spellName)).toBe(expected);
  });

  it('gates on stamped type, never name, and reads only the first spell_breaker passive', () => {
    // Raw pre-collector disk shape (passive_rule/effect) is invisible to the sheet lane.
    const rawDisk = { type: 'passive_rule', effect: 'spell_breaker', name: 'Spell Breaker', bonusActionSpells: ['Dispel Magic'] };
    expect(isSpellBreakerBonusActionSpell(caster([rawDisk]), 'Dispel Magic')).toBe(false);
    // find() semantics: a second stamped passive is never consulted.
    const second = { ...SPELL_BREAKER, bonusActionSpells: ['Counterspell'] };
    expect(isSpellBreakerBonusActionSpell(caster([SPELL_BREAKER, second]), 'Counterspell')).toBe(false);
    expect(isSpellBreakerBonusActionSpell(caster([SPELL_BREAKER, second]), 'Dispel Magic')).toBe(true);
  });

  it('is false without the Spell Breaker passive (5e regression gate)', () => {
    expect(isSpellBreakerBonusActionSpell(caster([]), 'Dispel Magic')).toBe(false);
    expect(isSpellBreakerBonusActionSpell({ automation: {} }, 'Dispel Magic')).toBe(false);
    expect(isSpellBreakerBonusActionSpell({}, 'Dispel Magic')).toBe(false);
    expect(isSpellBreakerBonusActionSpell(null, 'Dispel Magic')).toBe(false);
  });

  it('is false, not thrown, when the stamped passive lacks a populated bonusActionSpells list', () => {
    // Collector defaults the list to [] when disk omits it (automationCollector.js:58);
    // a hand-built passive lacking the key entirely hits the '|| []' guard (utils :105).
    // Fresh objects — the shared SPELL_BREAKER fixture must stay intact for later tests.
    expect(isSpellBreakerBonusActionSpell(caster([{ ...SPELL_BREAKER, bonusActionSpells: [] }]), 'Dispel Magic')).toBe(false);
    expect(isSpellBreakerBonusActionSpell(caster([{ type: 'spell_breaker', name: 'Spell Breaker' }]), 'Dispel Magic')).toBe(false);
  });

  it('is display-only: badge fires while section partitioning and the input stay untouched', () => {
    // Spell rows byte-cited from 2024 spells.json (Dispel Magic 'Action'/damage null;
    // Healing Word 'Bonus Action'; Counterspell 'Reaction').
    const stats = {
      name: 'DivinationWizard',
      automation: { passives: [SPELL_BREAKER] },
      spellAbilities: {
        spells: [
          { name: 'Dispel Magic', casting_time: 'Action', prepared: 'Prepared', damage: null },
          { name: 'Healing Word', casting_time: 'Bonus Action', prepared: 'Prepared' },
          { name: 'Counterspell', casting_time: 'Reaction', prepared: 'Prepared' },
        ],
      },
    };
    const snapshot = JSON.parse(JSON.stringify(stats)); // JSON-safe fixture

    expect(isSpellBreakerBonusActionSpell(stats, 'Dispel Magic')).toBe(true);
    // CLA-322 docstring law (:98-99): casting_time left untouched, so the badge
    // never relocates Dispel Magic out of its casting_time partition. Counterspell
    // is excluded via its own 'Reaction' time (Reactions section) — also unmoved.
    expect(getBonusActionSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Healing Word']));
    expect(getActionSpellNames(stats, CAMPAIGN)).toEqual(new Set());
    expect(getExcludedSpellNames(stats, CAMPAIGN)).toEqual(new Set(['Healing Word', 'Counterspell']));
    expect(stats.automation.passives[0].bonusActionSpells).toEqual(['Dispel Magic']);
    expect(stats).toEqual(snapshot); // purity: display gate mutates nothing
  });
});

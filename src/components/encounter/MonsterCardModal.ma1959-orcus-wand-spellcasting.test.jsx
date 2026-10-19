// @maintained-by-ai
// MA-1959 data lock + chip+shell fork lock: Orcus "Wand Spellcasting" rode a
// HALF-live fingerprint — the generic ActionSaveRoll shell was LIVE ("DC 18
// Wisdom" adjudicated on both faces) while the five spell names were plain
// text (zero .mc-dice-link-spell chips) because the row-name XOR at
// MonsterAction.jsx:422 is the EXACT /^spellcasting$/i test (MA-1958's
// sibling-row oracle on the SAME card). The bare shell was a MISLEADING
// affordance: it substituted a generic no-effect WIS save for a spell cast
// and paid nothing. Fix = MA-0421/MA-1958 inline markup DATA (+ honest
// dc_success:"none" — the row is damageless, half-default copy is MV-20
// misleading) PLUS the sanctioned chip+shell code fork: the canonical
// spell-selection idiom "casts one of the following spells" lets
// SpellCastLinks render SpellCastLinks ALONGSIDE the untouched ActionSaveRoll
// shell. Charge economy stays §70 ADVISORY text (no charge-pool producer/
// consumer exists; "At Will (no charge)"/"1 Charge:"/"2 Charges:" miss the
// N/Day pattern → chips ungated fire-by-design, At-Will precedent).
// N/Day grammar parse owned by spellcasting canonical extractor tests
// (spellcasting.test.jsx:333/:340; legendary-uses twin ma1883) — this file
// binds THIS row's bytes only. Spellcasting-row chip names owned by
// ma1958-orcus-spellcasting.test.jsx:202; generic counter badge / spend /
// refusal / At-Will null-store bytes owned by spellcasting.test.jsx
// :275/:281-302/:317/:522-548/:561; Spellcasting-row no-save-shell :192.
// Trimmed #750: 14 tests → 7. Full-description exact byte-pin absorbs the
// emphasis census, header/name forEach, <br> guard and prose regex; extractor
// binding + whole-DB fork census + spell-lane census stand; render tests fold
// (/Day-absence + sibling co-render inertness), save-route presses fold
// (Blight twice = ungated charge advisory, Circle = own-half non-leak).
// Mock hygiene (#739-#749): diceRoller/rangeValidation/mapsService/
// abilityLookup purged (bisect-green — no consumer in this lane; same modal
// tree as ma1958 purge justifications); useLoggedDiceRoll popup-capture and
// unconsumed roll exports purged. Kept: logService (assertion target),
// sanitize (body render), dataLoader §177 ruleset-branch, conditionEffects +
// damageUtils (getCombatContext fires), runtime store.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const orcus = monsters.find(m => m.index === 'orcus');
const wandRow = orcus.actions.find(a => a.name === 'Wand Spellcasting');
const spellcastingRow = orcus.actions.find(a => a.name === 'Spellcasting');
const multiattackRow = orcus.actions.find(a => a.name === 'Multiattack');
const wandAttackRow = orcus.actions.find(a => a.name === 'Wand of Orcus');

const CHIP_NAMES = ['Animate Dead', 'Blight', 'Speak with Dead', 'Circle of Death', 'Power Word Kill'];
const ADVISORY_CHIPS = ['Animate Dead', 'Speak with Dead', 'Power Word Kill'];
const USES_KEY = 'monsterSpellUses';

// Post-fix authored bytes pinned ONCE (house style: INLINE, no <br>) — this
// single exact pin absorbs the markup-only-diff proof against the pre-fix
// plain baseline (machine-read charge-tier suffixes exact-pinned #747/#748).
const DESCRIPTION = 'While holding the Wand of Orcus, Orcus casts one of the following spells (spell save DC 18). The wand has 7 charges: <strong>At Will (no charge):</strong> <em>Animate Dead</em>, <em>Blight</em>, <em>Speak with Dead</em>. <strong>1 Charge:</strong> <em>Circle of Death</em>. <strong>2 Charges:</strong> <em>Power Word Kill</em>. It regains 1d4 + 3 charges daily at dawn.';
const PRE_FIX_DESCRIPTION = 'While holding the Wand of Orcus, Orcus casts one of the following spells (spell save DC 18). The wand has 7 charges: At Will (no charge): Animate Dead, Blight, Speak with Dead. 1 Charge: Circle of Death. 2 Charges: Power Word Kill. It regains 1d4 + 3 charges daily at dawn.';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Orcus 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// §177: loadSpells mock MUST branch on the ruleset arg — findMonsterSpell is
// 5e-exact-first; all five names resolve in BOTH indexes (§158 trap INACTIVE).
const SPELLS_5E = CHIP_NAMES.map(n => spells5e.find(s => s.name === n));
const SPELLS_2024 = CHIP_NAMES.map(n => spells2024.find(s => s.name === n)).filter(Boolean);

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

// Only rollSavingThrow is asserted — popup-capture and the other roll
// entries are inert-shape-only (#739-#749 purge).
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollSavingThrow = vi.fn();
  return {
    default: vi.fn(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow,
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _rollSavingThrow: rollSavingThrow,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures } = {}, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    key: (characterKey, propertyName) => `${characterKey}.${propertyName}`,
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
    useRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function rowByLeadingName(prefix) {
  return Array.from(document.querySelectorAll('.mc-action')).find(r => {
    const s = r.querySelector('strong');
    return s && s.textContent.trim().startsWith(prefix);
  }) || null;
}

function wandRowEl() { return rowByLeadingName('Wand Spellcasting'); }
function wandChipByText(text) {
  return Array.from(wandRowEl().querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusalEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

async function pressChip(name) {
  await act(async () => { fireEvent.click(wandChipByText(name)); });
}

function renderOrcus() {
  const m = makeMonster({
    name: 'Orcus',
    type: 'fiend',
    subtype: 'Demon',
    actions: [multiattackRow, wandAttackRow, spellcastingRow, wandRow],
  });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 17, currentHp: 405, maxHp: 405, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: Orcus Wand Spellcasting row ─────────────────────────────────

describe('MA-1959 monsters.json data lock: Orcus Wand Spellcasting row', () => {
  it('row bytes locked once: description exact INLINE markup (charge-tier suffixes machine-read, no <br>, no hit/failure copy), stripped text byte-equals the pre-fix plain baseline (markup-only diff §619), dc_success "none" + save_dc 18 + save_type "Wisdom" fields pinned (damageless row — half-default copy is MV-20 misleading)', () => {
    expect(wandRow.description).toBe(DESCRIPTION);
    expect(stripTags(wandRow.description)).toBe(PRE_FIX_DESCRIPTION);
    expect(wandRow.dc_success).toBe('none');
    expect(wandRow.save_dc).toBe(18);
    expect(wandRow.save_type).toBe('Wisdom');
  });

  it('extractors bind THIS row: five names BY NAME in authored order (colon headers skipped); charge tiers miss the N/Day grammar → uses {} — chips ungated fire-by-design, charge economy stays §70 advisory text (grammar owned by canonical parser tests, cited)', () => {
    expect(extractSpellNamesFromSpellcasting(wandRow.description)).toEqual(CHIP_NAMES);
    expect(extractSpellcastingSpellUses(wandRow.description)).toEqual({});
  });

  it('census: the fork is byte-inert app-wide and the five spells split cleanly across lanes — Wand Spellcasting is the ONLY non-"Spellcasting" row with idiom + marked names + numeric save_dc in the whole DB; all five resolve in BOTH spell indexes (§158 trap INACTIVE); Blight/Circle of Death carry CON-half 8d8/8d6 (save-route), the other three carry no dc (advisory)', () => {
    const idiom = /one of the following spells/i;
    const lists = ['actions', 'bonus_actions', 'reactions', 'legendary_actions', 'lair_actions'];
    const hits = [];
    monsters.forEach(mo => {
      lists.forEach(key => {
        (Array.isArray(mo[key]) ? mo[key] : []).forEach(a => {
          if (!a || typeof a !== 'object') return;
          if (/^spellcasting$/i.test(a.name || '')) return;
          if (!(Number(a.save_dc) > 0)) return;
          if (!idiom.test(a.description || '')) return;
          if (extractSpellNamesFromSpellcasting(a.description).length === 0) return;
          hits.push(`${mo.name}/${a.name}`);
        });
      });
    });
    expect(hits).toEqual(['Orcus/Wand Spellcasting']);

    CHIP_NAMES.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    expect(spells5e.find(s => s.name === 'Blight').dc).toEqual({ dc_type: 'CON', dc_success: 'half' });
    expect(spells5e.find(s => s.name === 'Circle of Death').dc).toEqual({ dc_type: 'CON', dc_success: 'half' });
    ['Animate Dead', 'Speak with Dead', 'Power Word Kill'].forEach(n => {
      expect(spells5e.find(s => s.name === n).dc == null).toBe(true);
    });
  });
});

// ── Modal: chip+shell fork live on the full card ───────────────────────────

describe('MA-1959 MonsterCardModal Wand Spellcasting chip+shell fork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('fork renders: five spell chips in authored order WITHOUT any /Day counter (charge advisory) alongside the ONE untouched DC 18 Wisdom shell (was 0 chips + shell-only) — and sibling rows stay inert when co-rendered: Multiattack chipless, Wand of Orcus attack-chip-only (+19), Spellcasting row keeps its no-save-shell XOR (names owned by ma1958:202)', () => {
    renderOrcus();
    const row = wandRowEl();
    const wandSpellChips = Array.from(row.querySelectorAll('.mc-dice-link-spell'));
    expect(wandSpellChips.map(el => el.textContent.split('(')[0].trim())).toEqual(CHIP_NAMES);
    wandSpellChips.forEach(el => expect(el.textContent).not.toMatch(/\/Day/));
    const shells = Array.from(row.querySelectorAll('.mc-dice-link-save-clickable'));
    expect(shells.length).toBe(1);
    expect(shells[0].textContent.trim()).toBe('DC 18 Wisdom');

    expect(rowByLeadingName('Multiattack').querySelectorAll('.mc-dice-link').length).toBe(0);
    const wandAttack = rowByLeadingName('Wand of Orcus');
    expect(wandAttack.querySelectorAll('.mc-dice-link-spell').length).toBe(0);
    expect(wandAttack.querySelectorAll('.mc-dice-link').length).toBe(1);
    expect(wandAttack.querySelector('.mc-dice-link').textContent).toContain('+19');
    const sc = rowByLeadingName('Spellcasting');
    expect(sc.querySelectorAll('.mc-dice-link-spell').length).toBe(3);
    expect(sc.querySelectorAll('.mc-dice-link-save-clickable').length).toBe(0);
  });

  it('save-route chips adjudicate each spell\'s OWN save bytes at row DC 18 and fire UNGATED — Blight CON half 8d8 Necrotic (MA-1879 cast lane §204), second Blight press adjudicates again with zero monsterSpellUses stored and zero refusals (§70 charges advisory), Circle of Death keeps its OWN half 8d6 (row dc_success "none" never leaks onto save-route casts)', async () => {
    renderOrcus();
    await pressChip('Blight');
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(rollSavingThrow.mock.calls[0][2]).toMatchObject({
      spellName: 'Blight',
      actionName: 'Blight',
      saveDc: 18,
      saveType: 'CON',
      dcSuccess: 'half',
      autoDamageFormula: '8d8',
      autoDamageDamageType: 'Necrotic',
      isSpellDamage: true,
    });

    await pressChip('Blight');
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(2));

    await pressChip('Circle of Death');
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(3));
    expect(rollSavingThrow.mock.calls[2][2]).toMatchObject({
      spellName: 'Circle of Death',
      saveDc: 18,
      saveType: 'CON',
      dcSuccess: 'half',
      autoDamageFormula: '8d6',
      isSpellDamage: true,
    });

    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`] ?? null).toBeNull();
    expect(refusalEntries('Blight').length).toBe(0);
    expect(refusalEntries('Circle of Death').length).toBe(0);
  });

  it('no-dc chips cast as honest advisory records carrying the row DC 18, Wisdom — no save roll fires at all, no spend, no refusal (§680 lane, zero-roll canary)', async () => {
    renderOrcus();
    for (const n of ADVISORY_CHIPS) {
      await pressChip(n);
    }
    await waitFor(() => expect(ADVISORY_CHIPS.every(n => abilityUseEntries(n).length === 1)).toBe(true));
    expect(abilityUseEntries('Animate Dead')[0].description).toMatch(/Orcus 1 casts Animate Dead via Spellcasting \(spell save DC 18, Wisdom\)/);
    expect(abilityUseEntries('Animate Dead')[0].description).toMatch(/GM-enforced for monsters/);
    expect(abilityUseEntries('Speak with Dead')[0].description).toMatch(/spell save DC 18/);
    expect(abilityUseEntries('Power Word Kill')[0].description).toMatch(/spell save DC 18/);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.${USES_KEY}`] ?? null).toBeNull();
    expect(refusalEntries('Animate Dead').length).toBe(0);
  });

  it('shell press STILL adjudicates the generic DC 18 Wisdom save — dc_success "none" kills the half-copy leak, no damage arms (MV-20 honest-dc_success canary)', async () => {
    renderOrcus();
    await act(async () => { fireEvent.click(wandRowEl().querySelector('.mc-dice-link-save-clickable')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName == null).toBe(true);
    expect(context.actionName).toBe('Wand Spellcasting');
    expect(context.saveDc).toBe(18);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.isSpellDamage).toBe(false);
    expect(context.autoDamageFormula == null).toBe(true);
  });
});

// @maintained-by-ai
// MA-0238 regression: Ancient Red Dragon legendary header was display-only
// prose ("Legendary Action Uses: 3 (4 in Lair)" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch,
// and Fiery Rays clicked 4× same window produced zero fires zero refusals.
// Fix mirrors the MA-0227 (ancient green) + MA-0126/0125 (verified adult-red)
// DATA-only shape: header uses:3 with the "4 in Lair" advisory annotated into
// description; prose children authored in the SAME pass so no silent-burn
// chips remain (MA-0164): Commanding Presence gets the numeric save seam
// (Command lv2: DC 23 = 8 + CHA 8 + PB 7 from the dragon's own Spellcasting
// row — row bytes owned by MA-0237 spellcasting-ancient-red.test.jsx — WIS,
// dc_success none, charmed mechanical marker), Fiery Rays gets the numeric
// spell-attack seam (+15 = CHA 8 + PB 7, 120 ft., 2d6 Fire — never the
// MA-0065 prose-only "automation blocked" shape), Pounce gets
// delegates_to:"Rend" (MA-0220/0022 seam; the dragon's own weapon is Rend).
// Scope note: header/max/remaining + delegation resolution are owned by
// monsterLegendaryUses.test.js (:64/:171); counter render, exhausted +
// turn-latch + own-turn refusals and spend wording are owned generically by
// MonsterCardModal.legendary-uses.test.jsx (:1078/:1091/:1138/:1153) —
// this file locks only the ANCIENT RED distinct row bytes and the distinct
// gated clicks through them (save-full damage math: applyDamage owners).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { hasLegendaryCooldownClause } from '../../services/encounters/monsterLegendaryUses.js';

const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollSavingThrow: null,
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => {
    const rollAttack = vi.fn();
    const rollSavingThrow = vi.fn();
    ROLLERS.rollAttack = rollAttack;
    ROLLERS.rollSavingThrow = rollSavingThrow;
    return {
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack, rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
      rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
    };
  }),
}));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';

const CREATURES = [
  { name: 'Ancient Red Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 507, maxHp: 507, ac: 22, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Ancient Red Dragon 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Ancient Red Dragon 1.monsterLegendaryActionCooldowns';

const red = () => monstersData.find(m => m.name === 'Ancient Red Dragon');
const legendary = () => red().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const adultRed = () => monstersData.find(m => m.name === 'Adult Red Dragon');

// MA-0238 data locks — ancient-red distinct row bytes only.
describe('MA-0238 monsters.json data: ancient red dragon legendary rows', () => {
  it('header row has uses:3, description byte-identical to the verified adult-red header (4-in-Lair stays advisory)', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3 (4 in Lair)');
    expect(legendary()[0].uses).toBe(3);
    expect(legendary()[0].description).toMatch(/4 uses \(advisory/);
    expect(legendary()[0].description).toBe(adultRed().legendary_actions[0].description);
  });

  // Commanding Presence authors the numeric save seam (adult-red MA-0126
  // verified shape): DC 23 derives from the dragon's own Spellcasting row
  // (save_dc + ability math locked by MA-0237 spellcasting-ancient-red).
  it('Commanding Presence authors DC 23 WIS dc_success none, charmed marker, no damage (Command lv2)', () => {
    const cp = row('Commanding Presence');
    expect(cp.save_dc).toBe(23);
    expect(cp.save_type).toBe('Wisdom');
    expect(cp.dc_success).toBe('none');
    expect(cp.attack_bonus).toBeUndefined();
    expect(cp.damage_dice_primary).toBeUndefined();
    expect(cp.description).toMatch(/uses Spellcasting to cast <em>Command<\/em> \(level 2 version\)/);
    expect(cp.description).toMatch(/DC 23 Wisdom saving throw/);
    expect(cp.save_effect).toMatch(/charmed/);
    expect(cp.save_effect).not.toMatch(/half/i);
  });

  it('Fiery Rays authors +15/+15 120 ft. 2d6 Fire spell-attack seam, nothing on a miss (+15 = CHA 8 + PB 7)', () => {
    const fr = row('Fiery Rays');
    expect(fr.attack_bonus).toBe(15);
    expect(fr.spell_attack_bonus).toBe(15);
    expect(fr.range).toBe('120 ft.');
    expect(fr.damage_dice_primary).toBe('2d6');
    expect(fr.damage_type_primary).toBe('Fire');
    expect(fr.save_dc).toBeUndefined();
    expect(fr.description).toMatch(/Ranged Spell Attack: \+15 to hit/);
    expect(fr.description).toMatch(/2d6 Fire damage per ray, nothing on a miss/);
    expect(red().ability_score_modifiers.cha + red().proficiency_bonus).toBe(15);
  });

  it('Pounce delegates_to Rend with the sibling-prose byte, no own numeric mechanic', () => {
    const pounce = row('Pounce');
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(pounce.attack_bonus).toBeUndefined();
    expect(pounce.save_dc).toBeUndefined();
  });
});

// MA-0238 live seam: gated clicks spend through the counter and route each
// distinct row to its own mechanic (was: plain rows, zero fires zero
// refusals). Counter render, exhausted/turn-latch/own-turn refusals and
// spend wording: generic legendary-uses.test.jsx owners.
describe('MA-0238 MonsterCardModal ancient red dragon gated legendary clicks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderARed(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Ancient Red Dragon',
      actions: red().actions,
      legendary_actions: red().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Red Dragon 1', creatures: CREATURES })} />);
  }
  function redRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('Commanding Presence gated click spends 1, stamps the commanding_presence cooldown, rolls the DC 23 WIS save-leg (dc_success none, charmed, armed target)', async () => {
    renderARed({ max: 3, used: 0 });
    expect(hasLegendaryCooldownClause(row('Commanding Presence'))).toBe(true);
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ commanding_presence: { round: 1 } }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(23);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe(null);
    expect(context.saveConditions).toEqual(['charmed']);
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Commanding Presence/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Commanding Presence/);
  });

  it('Fiery Rays gated click spends 1, stamps the fiery_rays cooldown, rolls the +15 spell attack (2d6 Fire, armed target)', async () => {
    renderARed({ max: 3, used: 0 });
    fireEvent.click(redRow('Fiery Rays').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ fiery_rays: { round: 1 } }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Fiery Rays');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d6');
    expect(options.damageType).toBe('Fire');
    expect(options.targetName).toBe('TestPC');
  });

  it('Pounce gated click spends 1 and rolls the delegated +17 Rend attack (2d8 + 10 Slashing + 3d6 Fire), zero console dead-end', async () => {
    renderARed({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(redRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(17);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d8 + 10');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('3d6');
    expect(options.autoDamageSecondaryDamageType).toBe('Fire');
    expect(options.targetName).toBe('TestPC');
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});

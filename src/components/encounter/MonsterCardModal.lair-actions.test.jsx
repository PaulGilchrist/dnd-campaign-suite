// @maintained-by-ai
// MA-0024 modal lane ONLY. Data locks, clickable/affordance classification,
// per-monster lair parse/te/condition-extraction census, and resolveLairRow
// handler routing (incl. every young-*/adult-*/mummy-lord chip press cited
// here) are owned by src/services/encounters/monsterLairActions.test.js —
// see its MA-0024 :63-124, MA-0041 :126, MA-1207/:4643, MA-1208/:4720,
// MA-1209/:4812 (+ press :4852), MA-1747/:4976, MA-1753/:5180 (+ press
// :5218), MA-1760/:5370, MA-1761/:5462. This file pins ONLY the seams the
// service lane cannot reach: MonsterLairAction's chip-vs-static render
// branches (MonsterCardBody.jsx:384-419), the chip→handleLairRow click
// threading with modal-derived ctx identity (attackerName = creatureName,
// targetName = attacker.targetName, saveDc/saveType from the row), the
// advisory ability_use record at the modal seam, and the attackerCannotAct
// inert-gate on lair chips (MonsterCardBody.jsx:403) — previously unpinned
// in any test.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => ({ name: 'TestPC', type: 'player' })),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Thug 1', creatures: [] })),
}));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
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
  { name: 'Aboleth 1', type: 'npc', targetName: 'TestPC', currentHp: 185, maxHp: 185, ac: 17, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

// Structured aboleth-shaped rows (field shape canonical in monsters.json,
// values locked by owner monsterLairActions.test.js MA-0024).
const LAIR = [
  {
    name: 'Phantasmal Force',
    advisory: 'phantasmal_force',
    save_dc: 16,
    save_type: 'Intelligence',
    description: 'The aboleth casts phantasmal force (no components required) on any number of creatures it can see within 60 feet of it.',
  },
  {
    name: 'Grasping Tide',
    save_dc: 14,
    save_type: 'Strength',
    save_effect: 'Failure: The target is pulled up to 20 feet into the water and knocked prone. Success: unaffected.',
    description: 'Pools of water within 90 feet of the aboleth surge outward in a grasping tide.',
  },
  {
    name: 'Conduit for Rage',
    save_dc: 14,
    save_type: 'Wisdom',
    damage_dice_primary: '2d6',
    damage_type_primary: 'Psychic',
    save_effect: 'Failure: 7 (2d6) Psychic damage. Success: Half damage.',
    description: 'Water in the aboleth\'s lair magically becomes a conduit for the creature\'s rage.',
  },
];

function renderAboleth(overrides = {}) {
  const m = makeMonster({ name: 'Aboleth', lair_actions: LAIR });
  return render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES, ...overrides })} />);
}

function lairLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

function lairLinkWithName(name) {
  return lairLinks().find(el => el.textContent.includes(name)) || null;
}

describe('MA-0024 MonsterCardModal lair rows — modal seams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('structured rows render THREE chips: save labels + advisory name, role=button, initiative-20 title format', () => {
    renderAboleth();
    const links = lairLinks();
    expect(links).toHaveLength(3);
    expect(links.filter(el => el.textContent.includes('DC 14 Strength'))).toHaveLength(1);
    expect(links.filter(el => el.textContent.includes('DC 14 Wisdom'))).toHaveLength(1);
    expect(links.filter(el => el.textContent.includes('Phantasmal Force'))).toHaveLength(1);
    expect(links.every(el => el.getAttribute('role') === 'button')).toBe(true);
    expect(links.every(el => /^Lair action — .+\. Chosen on initiative 20, GM-enforced\.$/.test(el.getAttribute('title') || ''))).toBe(true);
  });

  // One press per save-row shape at the modal seam; DC/type provenance per
  // monster is owner-locked (monsterLairActions.test.js routing tests cited
  // in the header) — here only the modal-derived ctx identity + branch math.
  it.each([
    ['Grasping Tide (save, no damage, prone condition)', 'DC 14 Strength', 'STR', { saveDc: 14, saveType: 'Strength', autoDamageFormula: null, saveConditions: ['prone'] }],
    ['Conduit for Rage (save+damage, half-on-success)', 'DC 14 Wisdom', 'WIS', { saveDc: 14, saveType: 'Wisdom', autoDamageFormula: '2d6', dcSuccess: 'half', saveConditions: [] }],
  ])('%s chip press threads ctx through the block-save seam', async (_label, chipName, abbr, expected) => {
    renderAboleth();
    fireEvent.click(lairLinkWithName(chipName));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1));
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(call[0]).toBe(abbr);
    expect(call[2]).toMatchObject({ attackerName: 'Aboleth 1', targetName: 'TestPC', ...expected });
  });

  it('advisory row press logs ONE ability_use record with GM-enforced initiative-20 note, opens no save prompt', async () => {
    renderAboleth();
    fireEvent.click(lairLinkWithName('Phantasmal Force'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entries = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use');
    expect(entries).toHaveLength(1);
    expect(entries[0].abilityName).toBe('Phantasmal Force');
    expect(entries[0].description).toMatch(/phantasmal force/i);
    expect(entries[0].description).toMatch(/initiative 20/);
    expect(entries[0].description).toMatch(/GM-enforced/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('static branches (bare string, nameless dict, named-inert) render prose with zero affordance and no orphan leading "."', () => {
    const m = makeMonster({
      name: 'Static Monster',
      lair_actions: [
        'The lich animates a long-dead sprite.',
        { description: 'Pools of water surge outward.', save_dc: 15, save_type: 'Constitution' },
        { name: 'Keeping Row', description: 'prose only' },
      ],
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Static Monster 1', creatures: CREATURES })} />);
    expect(lairLinks()).toHaveLength(0);
    const rows = Array.from(document.querySelectorAll('.mc-section .mc-action'));
    const stringRow = rows.find(el => el.textContent.includes('animates a long-dead sprite'));
    expect(stringRow).toBeTruthy();
    expect(stringRow.querySelectorAll('span[role="button"]')).toHaveLength(0);
    const namelessRow = rows.find(el => el.textContent.includes('Pools of water surge outward.'));
    expect(namelessRow.querySelector('strong')).toBeNull();
    expect(namelessRow.textContent.trim().startsWith('.')).toBe(false);
    const namedRow = rows.find(el => el.textContent.includes('Keeping Row'));
    expect(namedRow.querySelector('strong').textContent).toBe('Keeping Row.');
    expect(namedRow.querySelectorAll('span[role="button"]')).toHaveLength(0);
  });

  it('attackerCannotAct renders lair chips inert: chips still show, clicks dispatch nothing', async () => {
    const creatures = [
      { ...CREATURES[0], conditions: [{ key: 'stunned', name: 'Stunned' }] },
      CREATURES[1],
    ];
    render(<MonsterCardModal {...makeProps(makeMonster({ name: 'Aboleth', lair_actions: LAIR }), { creatureName: 'Aboleth 1', creatures })} />);
    const links = lairLinks();
    expect(links).toHaveLength(3);
    expect(links.every(el => el.className.includes('mc-dice-link-spell-spent'))).toBe(true);
    expect(links.every(el => el.closest('.mc-action').className.includes('mc-action-disabled'))).toBe(true);
    fireEvent.click(links[1]);
    fireEvent.click(links[0]);
    await Promise.resolve();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});

// @maintained-by-ai: 2026-10-14
// SP-074 gateMageArmor — RAW "You touch a willing creature who isn't wearing
// armor": the picker offers only unarmored targets, decided by the CLA-225
// armor-category predicate (speedUtils.checkAnyArmor catalog lookup against the
// real equipment.json, not name heuristics). Combatants whose character JSON is
// not loaded (EB joins) pass leniently (§42). Refusals log `mage_armor_refused`
// with reason and zero spend (§41); when nobody is eligible an automation_info
// refusal face shows so the cast never falls through to the slot-spending
// generic path (gateRevivify/gateSpareTheDying precedent). AC calculation lives
// in the mageArmor feature-service lane — deliberately not asserted here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells5e from '../../../public/data/spells.json';
import spells2024 from '../../../public/data/2024/spells.json';
import equipment from '../../../public/data/equipment.json';

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(),
}));

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';
import { loadEquipment } from '../../services/ui/dataLoader.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'DivinationWizard';

// Data authority: real spells.json rows — both rulesets carry the identical
// gate-relevant row (lv1 Touch, automation.type mage_armor).
const MAGE_ARMOR_5E = spells5e.find(s => s.name === 'Mage Armor');
const MAGE_ARMOR_2024 = spells2024.find(s => s.name === 'Mage Armor');

const ALL_NAMES = ['DivinationWizard', 'HexWarlock', 'ElderPaladin'];

async function gate({ spell = MAGE_ARMOR_2024, cs = { creatures: ALL_NAMES.map(name => ({ name, type: 'player' })) }, characters = [] } = {}) {
  getCombatSummary.mockReturnValue(cs);
  const cfSetPending = vi.fn();
  const setPopupHtml = vi.fn();
  const handled = tryGateSpell('mage armor', CAMPAIGN, cfSetPending, {
    spell,
    metaCtx: {},
    playerStats: { name: CASTER },
    characters,
    isSorcerer: false,
    setPopupHtml,
  });
  // gate returns sync-true; the armor-catalog eligibility resolve is async
  // (loadEquipment → refusal logs → picker) — flush the microtask chain.
  await new Promise(resolve => setTimeout(resolve));
  return {
    handled,
    pending: cfSetPending.mock.calls[0]?.[1],
    setPopupHtml,
    refusals: addEntry.mock.calls.filter(c => c[1]?.automationType === 'mage_armor_refused'),
  };
}

function equippedList(name, equipped) {
  return equipped === undefined ? { name } : { name, inventory: { equipped } };
}

describe('SP-074 gateMageArmor — armor prerequisite gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadEquipment.mockResolvedValue(equipment);
  });

  it.each([
    ['5e', MAGE_ARMOR_5E],
    ['2024', MAGE_ARMOR_2024],
  ])('%s data row, everyone unarmored: picker opens over all combatants, no popup, no refusal', async (_label, spell) => {
    const characters = ALL_NAMES.map(name => equippedList(name, []));
    const { handled, pending, setPopupHtml, refusals } = await gate({ spell, characters });

    expect(handled).toBe(true);
    expect(pending.spellName).toBe('Mage Armor');
    expect(pending.spellLevel).toBe(1);
    expect(pending.range).toBe(spell.range || 'Touch');
    expect(pending.creatureTargets).toEqual(ALL_NAMES);
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(refusals).toHaveLength(0);
  });

  it.each([
    { label: 'Light armor (Leather)', equipped: ['Leather'], eligible: false },
    { label: 'Medium armor (Scale Mail)', equipped: ['Scale Mail'], eligible: false },
    { label: 'Shield only (CLA-225: Shields are not armor)', equipped: ['Shield'], eligible: true },
    { label: 'non-armor catalog item (Longsword)', equipped: ['Longsword'], eligible: true },
    { label: 'empty equipped list', equipped: [], eligible: true },
    { label: 'character JSON not loaded (EB join, §42 lenient)', equipped: undefined, eligible: true },
  ])('CLA-225 predicate: target in $label → eligible: $eligible', async ({ equipped, eligible }) => {
    const characters = [equippedList(CASTER, []), equippedList('HexWarlock', equipped)];
    const cs = { creatures: [{ name: CASTER, type: 'player' }, { name: 'HexWarlock', type: 'player' }] };
    const { pending, refusals } = await gate({ cs, characters });

    if (eligible) {
      expect(pending.creatureTargets).toEqual([CASTER, 'HexWarlock']);
      expect(refusals).toHaveLength(0);
    } else {
      expect(pending.creatureTargets).toEqual([CASTER]);
      expect(refusals).toHaveLength(1);
      expect(refusals[0][1].characterName).toBe('HexWarlock');
    }
  });

  it('mixed party: picker lists only the unarmored, mage_armor_refused logs per armored target with reason (§41)', async () => {
    const characters = [
      equippedList(CASTER, []),
      equippedList('HexWarlock', []),
      equippedList('ElderPaladin', ['Longsword', 'Scale Mail', 'Shield']),
    ];
    const { handled, pending, setPopupHtml, refusals } = await gate({ characters });

    expect(handled).toBe(true);
    expect(pending.creatureTargets).toEqual(['DivinationWizard', 'HexWarlock']);
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(refusals).toHaveLength(1);
    expect(refusals[0][1].characterName).toBe('ElderPaladin');
    expect(refusals[0][1].description).toContain('wearing armor');
  });

  it('everyone armored: no picker, automation_info refusal face, refused log per target — never falls through to the slot-spending generic path', async () => {
    const characters = [
      equippedList(CASTER, ['Leather']),
      equippedList('HexWarlock', ['Leather']),
      equippedList('ElderPaladin', ['Scale Mail']),
    ];
    const { handled, pending, setPopupHtml, refusals } = await gate({ characters });

    expect(handled).toBe(true);
    expect(pending).toBeUndefined();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      automationType: 'mageArmor',
      name: 'Mage Armor',
    }));
    expect(setPopupHtml.mock.calls[0][0].description).toContain('No unarmored creature is in range');
    expect(refusals).toHaveLength(3);
  });

  it('returns false when combat summary has no creatures (generic-path fallthrough)', async () => {
    const { handled, pending } = await gate({ cs: { creatures: [] } });

    expect(handled).toBe(false);
    expect(pending).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  loadEquipment: vi.fn(async () => []),
}));

import { tryGateSpell } from './spellGates.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';
import { loadEquipment } from '../../services/ui/dataLoader.js';

const CAMPAIGN = 'test-campaign';
const spell = { name: 'Mage Armor', level: 1, range: 'Touch', casting_time: 'Action', duration: '8 hours' };

function makeCs() {
  return {
    creatures: [
      { name: 'DivinationWizard', type: 'player' },
      { name: 'HexWarlock', type: 'player' },
      { name: 'ElderPaladin', type: 'player' },
    ],
  };
}

const EQUIPMENT = [
  { name: 'Scale Mail', equipment_category: 'Armor', armor_category: 'Medium' },
  { name: 'Leather', equipment_category: 'Armor', armor_category: 'Light' },
  { name: 'Shield', equipment_category: 'Armor', armor_category: 'Shield' },
  { name: 'Longsword', equipment_category: 'Weapon' },
];

async function gate(characters = [], setPopupHtml = vi.fn()) {
  const cfSetPending = vi.fn();
  const extra = { spell, metaCtx: {}, playerStats: { name: 'DivinationWizard' }, characters, isSorcerer: false, setPopupHtml };
  const handled = tryGateSpell('Mage Armor', CAMPAIGN, cfSetPending, extra);
  // gate returns sync-true; the armor-catalog eligibility resolve is async — flush it
  await new Promise(resolve => setTimeout(resolve));
  return { handled, cfSetPending, setPopupHtml };
}

describe('SP-074 gateMageArmor — armor prerequisite gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(makeCs());
    loadEquipment.mockResolvedValue(EQUIPMENT);
  });

  it('refuses armored targets: picker lists only unarmored, mage_armor_refused logs per armored target (§41)', async () => {
    const characters = [
      { name: 'DivinationWizard', inventory: { equipped: [] } },
      { name: 'HexWarlock', inventory: { equipped: [] } },
      { name: 'ElderPaladin', inventory: { equipped: ['Longsword', 'Scale Mail', 'Shield'] } },
    ];
    const { handled, cfSetPending } = await gate(characters);
    expect(handled).toBe(true);
    expect(cfSetPending).toHaveBeenCalledWith('mageArmor', expect.objectContaining({
      creatureTargets: ['DivinationWizard', 'HexWarlock'],
    }));
    expect(cfSetPending.mock.calls[0][1].creatureTargets).not.toContain('ElderPaladin');
    const refusal = addEntry.mock.calls.find(c => c[1]?.automationType === 'mage_armor_refused');
    expect(refusal).toBeDefined();
    expect(refusal[1].characterName).toBe('ElderPaladin');
    expect(refusal[1].description).toContain('armor');
    expect(addEntry.mock.calls.filter(c => c[1]?.automationType === 'mage_armor_refused').length).toBe(1);
  });

  it('refuses everyone with an automation_info popup, no picker, zero pending when all targets wear armor', async () => {
    const characters = [
      { name: 'DivinationWizard', inventory: { equipped: ['Leather'] } },
      { name: 'HexWarlock', inventory: { equipped: ['Leather'] } },
      { name: 'ElderPaladin', inventory: { equipped: ['Scale Mail'] } },
    ];
    const { handled, cfSetPending, setPopupHtml } = await gate(characters);
    expect(handled).toBe(true);
    expect(cfSetPending).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      automationType: 'mageArmor',
    }));
    expect(setPopupHtml.mock.calls[0][0].description).toContain('armor');
    expect(addEntry.mock.calls.filter(c => c[1]?.automationType === 'mage_armor_refused').length).toBe(3);
  });

  it('unarmored lane stays byte-compatible: picker payload unchanged when nobody wears armor', async () => {
    const characters = [
      { name: 'DivinationWizard', inventory: { equipped: [] } },
      { name: 'HexWarlock', inventory: { equipped: [] } },
      { name: 'ElderPaladin', inventory: { equipped: [] } },
    ];
    const { handled, cfSetPending, setPopupHtml } = await gate(characters);
    expect(handled).toBe(true);
    expect(cfSetPending).toHaveBeenCalledWith('mageArmor', expect.objectContaining({
      range: 'Touch',
      creatureTargets: ['DivinationWizard', 'HexWarlock', 'ElderPaladin'],
    }));
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('shield alone is not armor (CLA-225 predicate) — shield-only targets stay eligible', async () => {
    const characters = [
      { name: 'DivinationWizard', inventory: { equipped: [] } },
      { name: 'HexWarlock', inventory: { equipped: ['Shield'] } },
      { name: 'ElderPaladin', inventory: { equipped: ['Shield'] } },
    ];
    const { cfSetPending } = await gate(characters);
    expect(cfSetPending.mock.calls[0][1].creatureTargets).toEqual(['DivinationWizard', 'HexWarlock', 'ElderPaladin']);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('passes leniently for combatants whose character JSON is not loaded (EB joins)', async () => {
    const { handled, cfSetPending } = await gate([]);
    expect(handled).toBe(true);
    expect(cfSetPending.mock.calls[0][1].creatureTargets).toEqual(['DivinationWizard', 'HexWarlock', 'ElderPaladin']);
  });

  it('returns false (generic fallthrough) when combat summary has no creatures', async () => {
    getCombatSummary.mockReturnValue({ creatures: [] });
    const { handled, cfSetPending } = await gate([]);
    expect(handled).toBe(false);
    expect(cfSetPending).not.toHaveBeenCalled();
  });
});

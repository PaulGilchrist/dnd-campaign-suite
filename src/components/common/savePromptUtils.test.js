// @improved-by-ai
// Unit tests for the save-prompt selectors in savePromptUtils.js — the
// rules folded at the GM save-prompt seam.
//
// Mock boundaries (true seams only, mirroring concentrationPromptRoll.te-
// disadvantage.test.js):
// - Runtime store: one getRuntimeValue mock backed by state variables
//   (targetEffects, per-name activeConditions / selectedAllies /
//   holyNimbusActive). Tests mutate plain data, never re-stub branches.
// - Combat summary: getCombatSummary is a data-service seam for the
//   Holy Nimbus tests only.
// The REAL selectors abilitySaveDisadvantageActive, getAllyList and
// utils.getName run against realistic shapes — te matching, ability
// normalization and ally-scope logic are production behavior here.
//
// Covered elsewhere, not repeated here:
// - Modal roll/render contracts with these selectors wired in REAL:
//   SavePromptModal.evasion-effects.test.jsx, SavePromptModal.holy-aura.test.jsx,
//   ConcentrationPromptModal.holy-aura.test.jsx, ConcentrationPromptModal.test.jsx
// - Prompt production (savePrompt handlers): savePromptHandlers.*.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Runtime-store state (single mocked seam) ──────────────────────────
let targetEffects = [];
let activeConditions = {};   // creatureName -> [conditions]
let selectedAllies = {};     // grantorName -> [ally names]
let nimbusActive = new Set();// grantorNames with holyNimbusActive truthy
let storeCampaigns = [];     // campaignName of every read, for scoping checks

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key, campaignName) => {
    storeCampaigns.push(campaignName);
    if (key === 'targetEffects') return targetEffects;
    if (key === 'activeConditions') return activeConditions[name] || [];
    if (key === 'selectedAllies') return selectedAllies[name] || null;
    if (key === 'holyNimbusActive') return nimbusActive.has(name);
    return null;
  },
  setRuntimeValue: vi.fn(),
}));

// Data-service seam (Holy Nimbus reads the combat summary for attacker type).
let combatCreatures = [];
vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: () => ({ creatures: combatCreatures }),
}));

import { getSaveDisadvantage, getHolyAuraSaveAdvantage, getHolyNimbusSaveAdvantage } from './savePromptUtils.js';

const CAMPAIGN = 'test-campaign';
const ALL_SAVES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

beforeEach(() => {
  targetEffects = [];
  activeConditions = {};
  selectedAllies = {};
  nimbusActive = new Set();
  storeCampaigns = [];
  combatCreatures = [];
});

describe('getSaveDisadvantage — prompt-level flag', () => {
  it('is false without a current prompt', () => {
    expect(getSaveDisadvantage(null, CAMPAIGN)).toBe(false);
  });

  it('honors the prompt\'s own disadvantage flag with an otherwise empty store', () => {
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'WIS', disadvantage: true }, CAMPAIGN)).toBe(true);
  });

  it('treats a missing saveType as non-DEX: condition/te lanes stay silent, prompt flag still wins', () => {
    activeConditions['Thug 1'] = ['slow', 'charmed'];
    targetEffects = [{ target: 'Thug 1', effect: 'dex_save_disadvantage', source: 'Wizard' }];
    expect(getSaveDisadvantage({ targetName: 'Thug 1' }, CAMPAIGN)).toBe(false);
    expect(getSaveDisadvantage({ targetName: 'Thug 1', disadvantage: true }, CAMPAIGN)).toBe(true);
  });

  it('ignores targetEffects that are not save-disadvantage producers', () => {
    targetEffects = [
      { target: 'Thug 1', effect: 'holy_aura', source: 'Cleric' },
      { target: 'Thug 1', effect: 'speed_zero', source: 'Wizard' },
    ];
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, CAMPAIGN)).toBe(false);
  });
});

describe('getSaveDisadvantage — SP-109 slow / charmed / Otto\'s DEX-save rules', () => {
  it('applies the dex_save_disadvantage te on a slowed NPC even without the condition', () => {
    targetEffects = [{ target: 'Thug 1', effect: 'dex_save_disadvantage', source: 'DivinationWizard' }];
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, CAMPAIGN)).toBe(true);
  });

  it('applies the slow condition to DEX saves even without the te', () => {
    activeConditions['Thug 1'] = ['slow'];
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, CAMPAIGN)).toBe(true);
  });

  it('applies the charmed condition to DEX saves', () => {
    activeConditions['Thug 1'] = ['charmed'];
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, CAMPAIGN)).toBe(true);
  });

  it('matches conditions case-insensitively', () => {
    activeConditions['Thug 1'] = ['Slow', 'CHARMED'];
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'dex' }, CAMPAIGN)).toBe(true);
  });

  it('applies Otto\'s Irresistible Dance te to the target\'s DEX saves', () => {
    targetEffects = [{ target: 'Thug 1', effect: 'ottos_irresistible_dance', source: 'Dancer' }];
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, CAMPAIGN)).toBe(true);
  });

  it('never applies the DEX-only lanes to non-DEX saves', () => {
    activeConditions['Thug 1'] = ['slow', 'charmed'];
    targetEffects = [
      { target: 'Thug 1', effect: 'dex_save_disadvantage', source: 'DivinationWizard' },
      { target: 'Thug 1', effect: 'ottos_irresistible_dance', source: 'Dancer' },
    ];
    for (const saveType of ALL_SAVES.filter(s => s !== 'DEX')) {
      expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType }, CAMPAIGN)).toBe(false);
    }
  });

  it('never applies to another creature or an unaffected creature', () => {
    activeConditions['Thug 1'] = ['slow'];
    targetEffects = [
      { target: 'Thug 1', effect: 'dex_save_disadvantage', source: 'Wizard' },
      { target: 'Thug 1', effect: 'ottos_irresistible_dance', source: 'Dancer' },
    ];
    expect(getSaveDisadvantage({ targetName: 'Other 1', saveType: 'DEX' }, CAMPAIGN)).toBe(false);
    expect(getSaveDisadvantage({ targetName: 'Zombie 1', saveType: 'DEX' }, CAMPAIGN)).toBe(false);
  });
});

describe('getSaveDisadvantage — MA-1352 ability-scoped ability_save_disadvantage te', () => {
  beforeEach(() => {
    targetEffects = [{ target: 'Thug 1', effect: 'ability_save_disadvantage', ability: 'int', source: 'Psychic Gray Ooze 1', duration: 'until_start_of_next_turn' }];
  });

  it('applies on INT saves given as full word or abbreviation', () => {
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'Intelligence' }, CAMPAIGN)).toBe(true);
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'INT' }, CAMPAIGN)).toBe(true);
  });

  it('never fires on the other five save types', () => {
    for (const saveType of ALL_SAVES.filter(s => s !== 'INT')) {
      expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType }, CAMPAIGN)).toBe(false);
    }
  });

  it('never fires for a different target or without the te', () => {
    expect(getSaveDisadvantage({ targetName: 'Other 1', saveType: 'INT' }, CAMPAIGN)).toBe(false);
    targetEffects = [];
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'INT' }, CAMPAIGN)).toBe(false);
  });

  it('never fires when the te carries no ability clause', () => {
    targetEffects = [{ target: 'Thug 1', effect: 'ability_save_disadvantage', source: 'Psychic Gray Ooze 1' }];
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'INT' }, CAMPAIGN)).toBe(false);
  });
});

// CLA-107: Eldritch Hex — hex_save_disadvantage folds disadvantage on the
// GM save-prompt seam for the CHOSEN ability only.
describe('getSaveDisadvantage — CLA-107 hex_save_disadvantage chosen-ability fold', () => {
  beforeEach(() => {
    targetEffects = [{ target: 'Bandit 1', effect: 'hex_save_disadvantage', ability: 'DEX', source: 'HexWarlock', duration: 'hex_duration' }];
  });

  it('applies on DEX saves (uppercase chooser key, full-word saveType)', () => {
    expect(getSaveDisadvantage({ targetName: 'Bandit 1', saveType: 'DEX' }, CAMPAIGN)).toBe(true);
    expect(getSaveDisadvantage({ targetName: 'Bandit 1', saveType: 'Dexterity' }, CAMPAIGN)).toBe(true);
  });

  it('never fires on other save types or other targets', () => {
    for (const saveType of ALL_SAVES.filter(s => s !== 'DEX')) {
      expect(getSaveDisadvantage({ targetName: 'Bandit 1', saveType }, CAMPAIGN)).toBe(false);
    }
    expect(getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, CAMPAIGN)).toBe(false);
  });
});

describe('getHolyAuraSaveAdvantage', () => {
  it('protects the roller who carries the holy_aura te', () => {
    targetEffects = [{ target: 'testTarget', effect: 'holy_aura', source: 'Cleric' }];
    expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType: 'WIS' }, CAMPAIGN)).toBe(true);
  });

  it('covers every save ability while warded', () => {
    targetEffects = [{ target: 'testTarget', effect: 'holy_aura', source: 'Cleric' }];
    for (const saveType of ALL_SAVES) {
      expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType }, CAMPAIGN)).toBe(true);
    }
  });

  it('does not protect a roller when the holy_aura te belongs to another creature', () => {
    targetEffects = [{ target: 'OtherAlly', effect: 'holy_aura', source: 'Cleric' }];
    expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType: 'WIS' }, CAMPAIGN)).toBe(false);
  });

  it('is false with no targetEffects or without a prompt target', () => {
    expect(getHolyAuraSaveAdvantage({ targetName: 'testTarget', saveType: 'WIS' }, CAMPAIGN)).toBe(false);
    expect(getHolyAuraSaveAdvantage(null, CAMPAIGN)).toBe(false);
    expect(getHolyAuraSaveAdvantage({ saveType: 'WIS' }, CAMPAIGN)).toBe(false);
  });
});

describe('getHolyNimbusSaveAdvantage', () => {
  const TARGET = 'testTarget';
  const prompt = { targetName: TARGET, saveType: 'WIS' };
  const cleric = { name: 'Cleric 1' };

  function setAttacker(name, monsterType) {
    combatCreatures = [{ name, type: 'monster', monsterType }];
  }

  it('is false without an attacker on the prompt', () => {
    expect(getHolyNimbusSaveAdvantage(prompt, [cleric], CAMPAIGN)).toBe(false);
  });

  it('is false when the attacker is absent from the combat summary', () => {
    setAttacker('Someone Else', 'fiend');
    nimbusActive.add('Cleric 1');
    expect(getHolyNimbusSaveAdvantage({ ...prompt, attackerName: 'Balor 1' }, [cleric], CAMPAIGN)).toBe(false);
  });

  it('is false for non-fiend, non-undead attackers', () => {
    setAttacker('Giant Rat 1', 'beast');
    nimbusActive.add('Cleric 1');
    expect(getHolyNimbusSaveAdvantage({ ...prompt, attackerName: 'Giant Rat 1' }, [cleric], CAMPAIGN)).toBe(false);
  });

  it('is false when no character has Holy Nimbus active', () => {
    setAttacker('Balor 1', 'fiend');
    expect(getHolyNimbusSaveAdvantage({ ...prompt, attackerName: 'Balor 1' }, [cleric], CAMPAIGN)).toBe(false);
  });

  it('grants advantage against a fiend from a player whose active nimbus covers the target', () => {
    setAttacker('Balor 1', 'fiend');
    nimbusActive.add('Cleric 1');
    selectedAllies['Cleric 1'] = ['Cleric 1', TARGET];
    expect(getHolyNimbusSaveAdvantage({ ...prompt, attackerName: 'Balor 1' }, [cleric], CAMPAIGN)).toBe(true);
  });

  it('grants advantage against undead too (both restricted types)', () => {
    setAttacker('Wight 1', 'undead');
    nimbusActive.add('Cleric 1');
    selectedAllies['Cleric 1'] = [TARGET];
    expect(getHolyNimbusSaveAdvantage({ ...prompt, attackerName: 'Wight 1' }, [cleric], CAMPAIGN)).toBe(true);
  });

  it('does not cover a target excluded from an explicit multi-ally nimbus list', () => {
    setAttacker('Balor 1', 'fiend');
    nimbusActive.add('Cleric 1');
    selectedAllies['Cleric 1'] = ['Cleric 1', 'Ranger 2'];
    expect(getHolyNimbusSaveAdvantage({ ...prompt, attackerName: 'Balor 1' }, [cleric], CAMPAIGN)).toBe(false);
  });

  it('honors a default (unlisted) single-entry ally scope, covering any target', () => {
    // getAllyList defaults to [grantor] (length 1), which the house model
    // reads as "self-selected" — the nimbus covers whoever is saving.
    setAttacker('Balor 1', 'fiend');
    nimbusActive.add('Cleric 1');
    expect(getHolyNimbusSaveAdvantage({ ...prompt, attackerName: 'Balor 1' }, [cleric], CAMPAIGN)).toBe(true);
  });

  it('also honors Holy Nimbus carried by a non-player creature in the summary', () => {
    combatCreatures = [
      { name: 'Balor 1', type: 'monster', monsterType: 'fiend' },
      { name: 'Devoted Monk NPC', type: 'npc' },
    ];
    nimbusActive.add('Devoted Monk NPC');
    expect(getHolyNimbusSaveAdvantage({ ...prompt, attackerName: 'Balor 1' }, [], CAMPAIGN)).toBe(true);
  });
});

describe('campaign scoping', () => {
  it('reads the runtime store under the campaign it was handed', () => {
    targetEffects = [{ target: 'Thug 1', effect: 'dex_save_disadvantage', source: 'Wizard' }];
    activeConditions['Thug 1'] = ['slow'];
    getSaveDisadvantage({ targetName: 'Thug 1', saveType: 'DEX' }, CAMPAIGN);
    getHolyAuraSaveAdvantage({ targetName: 'Thug 1', saveType: 'DEX' }, CAMPAIGN);
    expect(storeCampaigns.length).toBeGreaterThan(0);
    expect(storeCampaigns.every(campaign => campaign === CAMPAIGN)).toBe(true);
  });
});

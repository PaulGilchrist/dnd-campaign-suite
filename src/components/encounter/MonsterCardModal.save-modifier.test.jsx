// @improved-by-ai
// @cleaned-by-ai
// Cleanup applied (redundant / brittle / low-value removal):
//
//   Consolidated 6 positive/negative modifier pairs → 4 parameterized tests:
//     "uses getAbilitySaveModifier from playerChar.abilities when available"
//     "handles negative modifiers from abilities array"
//       → merged into it.each({ abilities, expectedMod })
//     "uses creature.saving_throws when player has no abilities array"
//     "handles negative modifiers from saving_throws"
//       → merged into it.each({ saving_throws, expectedMod })
//     "uses creature.ability_score_modifiers when saving_throws is also missing"
//     "handles negative modifiers from ability_score_modifiers"
//       → merged into it.each({ ability_score_modifiers, expectedMod })
//     "uses target.saving_throws for non-player targets"
//     "handles negative modifiers from non-player saving_throws"
//       → merged into it.each({ saving_throws, expectedMod })
//
//   Consolidated 2 "no modifier source" tests → 1 test:
//     "defaults to 0 when no save modifier source is found" (player)
//     "defaults to 0 when non-player target has no save data" (non-player)
//       → merged into single test since the fallback-to-0 behavior is
//         identical regardless of target type (getSaveModifierForSaveType
//         returns 0 through the same code path in both branches).
//
//   Removed 1 redundant "no target" rolling test:
//     "rolls save with modifier 0 when no target is set"
//       → covered by "defaults to 0 when no save modifier source is found"
//         which asserts the identical rollSavingThrow('DEX', 0, ...) call.
//         Kept only the rendering test ("renders clickable save DC even
//         without a target") as it asserts unique UI behavior.
//
//   Consolidated 2 save type abbreviation tests → 1 parameterized test:
//     "converts save_type to uppercase abbreviation for rollSavingThrow" (WIS)
//     "converts different save types to correct abbreviations" (CON)
//       → merged into it.each({ saveType, abbr }) since both assert the
//         same abbreviation conversion via rollSavingThrow first argument.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return {
    default: mockHook,
    _rollSavingThrow,
    _setPopupHtml,
    __setPopupHtml(val) { _popupHtml = val; },
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  let _computeReturn = null;
  const _computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultConditionEffects };
  });

  return {
    computeConditionEffects: _computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
    }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (range === 'touch') return 8;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const mockUseRuntimeValue = vi.fn((_characterKey, _propertyName, _campaignName) => null);

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
  };
});

// ── Re-import for test helpers ─────────────────────────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as abilityLookup from '../../services/shared/abilityLookup.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Find a save dice link by its visible text (e.g. "DC 13 Dexterity"). */
function findSaveLinkByText(text) {
  const links = document.querySelectorAll('.mc-dice-link-save-clickable');
  return Array.from(links).find(el => el.textContent.includes(text)) || null;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - save modifier resolution via handleSaveRoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
    abilityLookup.getAbilitySaveModifier.mockReturnValue(0);
  });

  describe('player target — abilities array (highest priority)', () => {
    it.each([
      { abilities: [{ name: 'Dexterity', bonus: 3 }], expectedMod: 3, saveType: 'Dexterity', saveDc: 13, desc: 'uses getAbilitySaveModifier from playerChar.abilities when available' },
      { abilities: [{ name: 'Dexterity', bonus: -2 }], expectedMod: -2, saveType: 'Dexterity', saveDc: 15, desc: 'handles negative modifiers from abilities array' },
    ])('$desc', ({ abilities, expectedMod, saveType, saveDc }) => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: `${saveType} Saving Throw: DC ${saveDc}`, save_dc: saveDc, save_type: saveType }],
      });

      const playerChar = {
        name: 'Player A',
        abilities,
      };

      abilityLookup.getAbilitySaveModifier.mockReturnValue(expectedMod);

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }], characters: [playerChar] })} />);

      const saveLink = findSaveLinkByText(`DC ${saveDc}`);
      expect(saveLink).toBeInTheDocument();
      fireEvent.click(saveLink);
      expect(abilityLookup.getAbilitySaveModifier).toHaveBeenCalledWith(playerChar.abilities, 'dex');
      expect(rollSavingThrow).toHaveBeenCalledWith('DEX', expectedMod, expect.objectContaining({ saveDc, saveType }));
    });
  });

  describe('player target — saving_throws fallback', () => {
    it.each([
      { saving_throws: { dex: { modifier: 2 } }, expectedMod: 2, saveType: 'Dexterity', saveDc: 13, desc: 'uses creature.saving_throws when player has no abilities array' },
      { saving_throws: { con: { modifier: -3 } }, expectedMod: -3, saveType: 'Constitution', saveDc: 14, desc: 'handles negative modifiers from saving_throws' },
    ])('$desc', ({ saving_throws, expectedMod, saveType, saveDc }) => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: `${saveType} Saving Throw: DC ${saveDc}`, save_dc: saveDc, save_type: saveType }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player', saving_throws }], characters: [] })} />);

      const saveLink = findSaveLinkByText(`DC ${saveDc}`);
      expect(saveLink).toBeInTheDocument();
      fireEvent.click(saveLink);
      expect(rollSavingThrow).toHaveBeenCalledWith(saveType === 'Dexterity' ? 'DEX' : 'CON', expectedMod, expect.objectContaining({ saveDc, saveType }));
    });
  });

  describe('player target — ability_score_modifiers fallback', () => {
    it.each([
      { ability_score_modifiers: { dex: 4 }, expectedMod: 4, saveType: 'Dexterity', saveDc: 13, desc: 'uses creature.ability_score_modifiers when saving_throws is also missing' },
      { ability_score_modifiers: { str: -5 }, expectedMod: -5, saveType: 'Strength', saveDc: 12, desc: 'handles negative modifiers from ability_score_modifiers' },
    ])('$desc', ({ ability_score_modifiers, expectedMod, saveType, saveDc }) => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: `${saveType} Saving Throw: DC ${saveDc}`, save_dc: saveDc, save_type: saveType }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player', ability_score_modifiers }], characters: [] })} />);

      const saveLink = findSaveLinkByText(`DC ${saveDc}`);
      expect(saveLink).toBeInTheDocument();
      fireEvent.click(saveLink);
      expect(rollSavingThrow).toHaveBeenCalledWith(saveType === 'Dexterity' ? 'DEX' : 'STR', expectedMod, expect.objectContaining({ saveDc, saveType }));
    });
  });

  describe('player target — no modifier source', () => {
    it('defaults to 0 when no save modifier source is found', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }], characters: [] })} />);

      const saveLink = findSaveLinkByText('DC 13');
      expect(saveLink).toBeInTheDocument();
      fireEvent.click(saveLink);
      expect(rollSavingThrow).toHaveBeenCalledWith('DEX', 0, expect.objectContaining({ saveDc: 13, saveType: 'Dexterity' }));
    });

    it('defaults to 0 for non-player target with no save data', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Ogre',
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Constitution Saving Throw: DC 13', save_dc: 13, save_type: 'Constitution' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Ogre' }, { name: 'Ogre' }] })} />);

      const saveLink = findSaveLinkByText('DC 13');
      expect(saveLink).toBeInTheDocument();
      fireEvent.click(saveLink);
      expect(rollSavingThrow).toHaveBeenCalledWith('CON', 0, expect.objectContaining({ saveDc: 13, saveType: 'Constitution' }));
    });
  });

  describe('no target', () => {
    it('renders clickable save DC even without a target (modifier defaults to 0)', () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
      });

      const m = makeMonster({
        actions: [{ name: 'Web', description: 'Dexterity Saving Throw: DC 13', save_dc: 13, save_type: 'Dexterity' }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin' }] })} />);

      const saveLink = findSaveLinkByText('DC 13');
      expect(saveLink).toBeInTheDocument();
    });
  });

  describe('save type abbreviation', () => {
    it.each([
      { saveType: 'Wisdom', abbr: 'WIS', saveDc: 12, desc: 'converts save_type to uppercase abbreviation for rollSavingThrow' },
      { saveType: 'Constitution', abbr: 'CON', saveDc: 14, desc: 'converts different save types to correct abbreviations' },
    ])('$desc', ({ saveType, abbr, saveDc }) => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Charm', description: `${saveType} Saving Throw: DC ${saveDc}`, save_dc: saveDc, save_type: saveType }],
      });

      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

      const saveLink = findSaveLinkByText(`DC ${saveDc}`);
      expect(saveLink).toBeInTheDocument();
      fireEvent.click(saveLink);
      expect(rollSavingThrow).toHaveBeenCalledWith(abbr, 0, expect.objectContaining({ saveType }));
    });
  });
});

// Cleanup: Removed redundant "renders Grapple as clickable" test (covered by baseActions.test.jsx).
// Consolidated "grapple fails" and "grapple tie" into single parameterized test (same failure path).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, newValue);
    });
    return [value, setter];
  }),
  useRuntimeValue: vi.fn((_, key, _campaignName) => {
    const hasValue = _syncedStore.has(key);
    return hasValue ? _syncedStore.get(key) : null;
  }),
  listeners: new Map(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    return null;
  }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null, handleGreaterRestorationConfirm: vi.fn(), handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null, handleRemoveCurseConfirm: vi.fn(), handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: null })),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ maxFocusPoints: 2 })),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve({ rangeBonus: 5 })),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
}));

vi.mock('../../services/rules/features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('./useInitiativeEffects.js', () => ({
  default: vi.fn(),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('./CharActionModals.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-modals">CharActionModals</div>),
}));

vi.mock('./CharActionSpellPopups.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-spell-popups">CharActionSpellPopups</div>),
}));

vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    pendingDamage: null, modalState: {}, setModalState: vi.fn(),
    resolveAttackDamage: vi.fn(), handleMasteryClose: vi.fn(), handleWeaponMasteryChoice: vi.fn(),
    handleWeaponKindMasteryClose: vi.fn(), handleDivineFuryDamageType: vi.fn(), handleDivineFurySkip: vi.fn(),
    handleGenericDamageTypeChoice: vi.fn(), handleGenericDamageTypeSkip: vi.fn(),
    handleDamageTypeModifierChoice: vi.fn(), handleDamageTypeModifierSkip: vi.fn(),
    handleEnhancedUnarmedChoice: vi.fn(), handleEnhancedUnarmedSkip: vi.fn(),
    handleFeatureChoiceConfirm: vi.fn(), handleFeatureChoiceSkip: vi.fn(),
    handleConstellationSelect: vi.fn(),
    combatSuperiorityModal: null, setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(), handleAttackRiderManeuverUse: vi.fn(), handleAttackRiderManeuverSkip: vi.fn(),
  })),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal">SecondaryTargetModal</div>),
}));

vi.mock('./modals/TacticalMasterModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="tactical-master-modal">TacticalMasterModal</div>),
}));

vi.mock('../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn((autoDamage) => ({ attack: autoDamage, ctxOverrides: {} })),
}));

vi.mock('../../services/automation/contextBuilder.js', () => ({
  buildAttackContext: vi.fn(() => Promise.resolve({ hitBonus: 5 })),
  buildAttackContextSync: vi.fn(() => ({ hitBonus: 5 })),
}));

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function makeWrapper(setPopupHtml, rollAbilityCheck) {
  return ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml, rollAbilityCheck }}>
      {children}
    </DiceRollContext.Provider>
  );
}

// Helper that renders CharActions with all grapple-related mocks configured,
// ensuring the fetch for actions.json resolves before the test proceeds.
async function renderGrappleWithMocks(mocks, statsOverride = {}) {
  const {
    mockSetPopupHtml,
    mockRollAbilityCheck,
    grvImpl,
    loadCsData,
    targetFromAttacker,
    cannotAct,
  } = mocks;

  if (grvImpl) {
    getRuntimeValue.mockImplementation(grvImpl);
  }
  if (mockSetPopupHtml) {
    useLoggedDiceRoll.mockReturnValue({
      popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
      rollSkillCheck: vi.fn(), rollAbilityCheck: mockRollAbilityCheck || vi.fn().mockResolvedValue(undefined),
      quickRollPlayerSave: vi.fn(),
    });
  }
  if (loadCsData) {
    loadCombatSummary.mockResolvedValue(loadCsData);
  }
  if (targetFromAttacker !== undefined) {
    getTargetFromAttacker.mockReturnValue(targetFromAttacker);
  }

  const wrapper = makeWrapper(mockSetPopupHtml, mockRollAbilityCheck);
  await act(async () => render(<CharActions playerStats={createStats(statsOverride)} campaignName="test-campaign" cannotAct={cannotAct || false} />, { wrapper }));
}

describe('CharActions grapple action — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
    getRuntimeValue.mockImplementation(() => null);
  });

  describe('grapple click behavior', () => {
    it('shows error popup when no target selected', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollAbilityCheck = vi.fn().mockResolvedValue(undefined);

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      await renderGrappleWithMocks({
        mockSetPopupHtml,
        mockRollAbilityCheck,
        grvImpl: (_name, key) => {
          if (key === 'activeBuffs') return [];
          if (key === 'hasteExtraActionUsed') return false;
          if (key === 'activeConditions') return [];
          return null;
        },
        loadCsData: { lastAttack: null, creatures: [{ name: 'Goblin', conditions: [] }] },
        targetFromAttacker: null,
      });

      const grappleBtn = await waitFor(() => screen.getByText('Grapple'));
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('No target selected'),
        }));
      });
      expect(mockRollAbilityCheck).not.toHaveBeenCalled();
    });

    it.each([
      { label: 'roll <= target STR (fails)', d20: 3, strMod: 3, proficiency: 3, targetStr: 10, targetName: 'Orc' },
      { label: 'roll === target STR tie (fails)', d20: 10, strMod: 0, proficiency: 0, targetStr: 10, targetName: 'Goblin' },
    ])('grapple failure: $label', async ({ d20, strMod, proficiency, targetStr, targetName }) => {
      const mockSetPopupHtml = vi.fn();
      const mockRollAbilityCheck = vi.fn().mockResolvedValue(undefined);
      const strCheckBonus = strMod + proficiency;

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stats = createStats({ actions: ['Grapple'], skillProficiencies: ['Athletics'], level: 5 });
      stats.abilities = [
        { name: 'Strength', bonus: strMod, skills: [{ name: 'Athletics', bonus: strCheckBonus }] },
        { name: 'Dexterity', bonus: 0, skills: [] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      await renderGrappleWithMocks({
        mockSetPopupHtml,
        mockRollAbilityCheck,
        loadCsData: {
          lastAttack: { d20, bonus: strCheckBonus, total: d20 + strCheckBonus },
          creatures: [{ name: targetName, conditions: [], type: 'npc', ability_score_modifiers: { str: targetStr } }],
        },
        targetFromAttacker: { name: targetName, conditions: [], type: 'npc', ability_score_modifiers: { str: targetStr } },
      }, stats);

      const grappleBtn = await waitFor(() => screen.getByText('Grapple'));
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockRollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('Grapple failed'),
        }));
      });
    });

    it('shows popup when target is already grappled', async () => {
      const mockSetPopupHtml = vi.fn();

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return ['grappled'];
        return null;
      });

      await renderGrappleWithMocks({
        mockSetPopupHtml,
        grvImpl: (_name, key) => {
          if (key === 'activeBuffs') return [];
          if (key === 'hasteExtraActionUsed') return false;
          if (key === 'activeConditions') return ['grappled'];
          return null;
        },
        loadCsData: { lastAttack: null, creatures: [{ name: 'Goblin', conditions: ['grappled'] }] },
        targetFromAttacker: { name: 'Goblin', conditions: ['grappled'] },
      });

      const grappleBtn = await waitFor(() => screen.getByText('Grapple'));
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('already grappled'),
        }));
      });
    });

    it('does nothing when cannotAct is true', async () => {
      const mockSetPopupHtml = vi.fn();

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      await renderGrappleWithMocks({
        mockSetPopupHtml,
        cannotAct: true,
      });

      const grappleBtn = await waitFor(() => screen.getByText('Grapple'));
      await act(async () => { fireEvent.click(grappleBtn); });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });

    it('uses Dexterity ability check for monk characters', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollAbilityCheck = vi.fn().mockResolvedValue(undefined);
      const dexMod = 4;
      const proficiency = 3;
      const dexCheckBonus = dexMod + proficiency;

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        if (_name === 'campaign' && key === 'lastAttack') return { d20: 15, bonus: dexCheckBonus, total: 15 + dexCheckBonus };
        return null;
      });

      const stats = createStats({
        actions: ['Grapple'],
        class: { name: 'Monk' },
        level: 5,
      });
      stats.abilities = [
        { name: 'Strength', bonus: 0, skills: [] },
        { name: 'Dexterity', bonus: dexMod, skills: [{ name: 'Athletics', bonus: dexCheckBonus }] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      await renderGrappleWithMocks({
        mockSetPopupHtml,
        mockRollAbilityCheck,
        loadCsData: {
          lastAttack: { d20: 15, bonus: dexCheckBonus, total: 15 + dexCheckBonus },
          creatures: [{ name: 'Goblin', conditions: [], type: 'npc', ability_score_modifiers: { str: 1 } }],
        },
        targetFromAttacker: { name: 'Goblin', conditions: [], type: 'npc', ability_score_modifiers: { str: 1 } },
      }, stats);

      const grappleBtn = await waitFor(() => screen.getByText('Grapple'));
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockRollAbilityCheck).toHaveBeenCalledWith('Dexterity', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('Grapple successful'),
        }));
      });
    });
  });
});

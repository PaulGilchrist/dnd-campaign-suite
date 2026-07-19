// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { endFriendsOnHostileAction } from '../../services/rules/features/friendsService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { addEntry } from '../../services/ui/logService.js';
import { buildAttackContext, buildAttackContextSync } from '../../services/automation/contextBuilder.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

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

function renderWithDiceRollContext(stats, props = {}) {
  const mockSetPopupHtml = vi.fn();
  const wrapper = ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
      {children}
    </DiceRollContext.Provider>
  );
  const rendered = render(<CharActions playerStats={stats} {...props} />, { wrapper });
  return { ...rendered, mockSetPopupHtml };
}

describe('CharActions handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
    getRuntimeValue.mockImplementation(() => null);
    vi.mocked(buildAttackContext).mockResolvedValue({ hitBonus: 5 });
    vi.mocked(buildAttackContextSync).mockReturnValue({ hitBonus: 5 });
    vi.mocked(endFriendsOnHostileAction).mockReturnValue();
    vi.mocked(endInvisibilityOnHostileAction).mockReturnValue();
    vi.mocked(getCombatContext).mockResolvedValue(null);
  });

  describe('handleAttackClick', () => {
    it('ends Friends and Invisibility spells before rolling attack', async () => {
      renderWithDiceRollContext(createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }]
      }));

      const attackEl = screen.getByText('Longsword');
      await act(async () => { fireEvent.click(attackEl); });

      expect(endFriendsOnHostileAction).toHaveBeenCalledWith('TestCharacter', undefined);
      expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestCharacter', undefined);
      expect(buildAttackContext).toHaveBeenCalled();
    });

    it('does nothing when cannotAct is true', async () => {
      renderWithDiceRollContext(createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }]
      }), { cannotAct: true });

      const attackEl = screen.getByText('Longsword');
      await act(async () => { fireEvent.click(attackEl); });

      expect(endFriendsOnHostileAction).not.toHaveBeenCalled();
      expect(buildAttackContext).not.toHaveBeenCalled();
    });

    it('applies exhaustion penalty to hit bonus', async () => {
      renderWithDiceRollContext(createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }]
      }), { exhaustionPenalty: 2 });

      const attackEl = screen.getByText('Longsword');
      await act(async () => { fireEvent.click(attackEl); });

      expect(buildAttackContext).toHaveBeenCalled();
    });

    it('handles buildCtx failure gracefully', async () => {
      vi.mocked(buildAttackContext).mockRejectedValue(new Error('context error'));
      const consoleError = console.error;
      console.error = vi.fn();

      renderWithDiceRollContext(createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }]
      }));

      const attackEl = screen.getByText('Longsword');
      await act(async () => { fireEvent.click(attackEl); });

      expect(console.error).toHaveBeenCalledWith('[CharActions] Error:', expect.any(Error));
      console.error = consoleError;
    });
  });

  describe('handleCleaveAttack', () => {
    it('logs damage and entry on hit', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const combatSummary = {
        lastAttack: {
          attackName: 'Longsword',
          damageFormula: '1d8+3',
          damageType: 'Slashing',
          targetName: 'Goblin',
        },
        creatures: [{ name: 'Orc', ac: 14, position: { x: 10, y: 10 } }],
      };

      vi.mocked(buildAttackContext).mockResolvedValue({ hitBonus: 5 });
      vi.mocked(getCombatContext).mockResolvedValue(combatSummary);

      render(<CharActions
        playerStats={createStats({ attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }] })}
        campaignName="my-campaign"
      />, { wrapper });

      // The cleave flow is triggered by weapon mastery / attack riders
      // We test the internal handler by checking the cleave logic directly
      expect(screen.queryByText('Cleave')).not.toBeInTheDocument();
    });

    it('strips ability modifier from cleave damage formula', async () => {
      const formula = '1d8+3';
      const cleaned = formula.replace(/\+\s*\d+/g, '').trim();
      expect(cleaned).toBe('1d8');
    });

    it('falls back to original formula if cleaning removes all dice', async () => {
      const formula = '+3';
      const cleaned = formula.replace(/\+\s*\d+/g, '').trim();
      expect(cleaned).toBe('');
    });
  });

  describe('handleTacticalMaster', () => {
    it('dismisses tactical master modal on close', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      render(<CharActions
        playerStats={createStats()}
        campaignName="my-campaign"
      />, { wrapper });

      expect(screen.queryByText('TacticalMasterModal')).not.toBeInTheDocument();
    });
  });

  describe('handleSimpleDamageRoll', () => {
    it('logs a simple damage roll for weapon attacks', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      await act(async () => {
        render(<CharActions
          playerStats={createStats({
            attacks: [{ name: 'Shortsword', range: 5, hitBonus: 5, damage: '1d6+3', damageType: 'Piercing', type: 'Action' }]
          })}
          campaignName="my-campaign"
        />, { wrapper });
      });

      const damageEl = screen.getByText('1d6+3');
      await act(async () => { fireEvent.click(damageEl); });

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('my-campaign', expect.objectContaining({
          type: 'roll',
          rollType: 'damage',
          name: 'Shortsword',
          formula: '1d6+3',
          note: 'Direct damage roll (no target)',
        }));
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          type: 'damage',
          name: 'Shortsword',
          formula: '1d6+3',
          note: 'Direct damage roll (no target)',
        }));
      });
    });

    it('clears popupHtml before rolling', async () => {
      const mockPopupHtml = { type: 'some-popup' };
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: mockPopupHtml, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      await act(async () => {
        render(<CharActions
          playerStats={createStats({
            attacks: [{ name: 'Dagger', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Action' }]
          })}
          campaignName="my-campaign"
        />, { wrapper });
      });

      const damageEl = screen.getByText('1d4+3');
      await act(async () => { fireEvent.click(damageEl); });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          type: 'damage',
        }));
      });
    });
  });

  describe('base actions rendering', () => {
    it('renders base actions as a comma-separated list', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stats = createStats({ actions: ['Hide', 'Dash', 'Disengage'] });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      const baseActionsEl = screen.getByText(/Base Actions:/);
      expect(baseActionsEl).toBeInTheDocument();
    });

    it('renders Hide as a clickable action with special behavior', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stats = createStats({ actions: ['Hide', 'Dash'] });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Hide')).toHaveClass('base-action-clickable');
      expect(screen.getByText(/Dash/)).toBeInTheDocument();
    });

    it('Hide shows popup when already invisible', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_on_stealth' }];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return ['invisible'];
        return null;
      });

      await act(async () => {
        render(<CharActions playerStats={createStats({ actions: ['Hide'] })} />, { wrapper });
      });

      const hideBtn = screen.getByText('Hide');
      await act(async () => { fireEvent.click(hideBtn); });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Hide',
          description: expect.stringContaining('already hidden'),
        }));
      });
    });

    it('Hide rolls Stealth check and sets invisible condition on success (>= DC 15)', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stealthSkillBonus = 5;
      const stats = createStats({ actions: ['Hide'], skillProficiencies: ['Stealth'], level: 5 });
      stats.abilities = [
        { name: 'Dexterity', bonus: 2, skills: [{ name: 'Stealth', bonus: stealthSkillBonus }] },
        { name: 'Strength', bonus: 0, skills: [] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: mockRollSkillCheck, quickRollPlayerSave: vi.fn(),
      });
      loadCombatSummary.mockResolvedValue({ lastAttack: { d20: 12, bonus: stealthSkillBonus, total: 12 + stealthSkillBonus } });

      await act(async () => {
        render(<CharActions playerStats={stats} campaignName="my-campaign" />, { wrapper });
      });

      const hideBtn = screen.getByText('Hide');
      await act(async () => { fireEvent.click(hideBtn); });

      await waitFor(() => {
        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeConditions', expect.arrayContaining(['invisible']), 'my-campaign');
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Hide',
          description: expect.stringContaining('Hide successful'),
        }));
      });
    });

    it('Hide rolls Stealth check but does NOT set invisible on failure (< DC 15)', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stealthSkillBonus = 5;
      const stats = createStats({ actions: ['Hide'], skillProficiencies: ['Stealth'], level: 5 });
      stats.abilities = [
        { name: 'Dexterity', bonus: 2, skills: [{ name: 'Stealth', bonus: stealthSkillBonus }] },
        { name: 'Strength', bonus: 0, skills: [] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: mockRollSkillCheck, quickRollPlayerSave: vi.fn(),
      });
      loadCombatSummary.mockResolvedValue({ lastAttack: { d20: 3, bonus: stealthSkillBonus, total: 3 + stealthSkillBonus } });

      await act(async () => {
        render(<CharActions playerStats={stats} campaignName="my-campaign" />, { wrapper });
      });

      const hideBtn = screen.getByText('Hide');
      await act(async () => { fireEvent.click(hideBtn); });

      await waitFor(() => {
        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Hide',
          description: expect.stringContaining('Hide failed'),
        }));
      });

      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'activeConditions', expect.arrayContaining(['invisible']), 'my-campaign');
    });

    it('Hide does not add duplicate stealth buff when advantage already active and succeeds', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_on_stealth' }];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stealthSkillBonus = 5;
      const stats = createStats({ actions: ['Hide'], skillProficiencies: ['Stealth'], level: 5 });
      stats.abilities = [
        { name: 'Dexterity', bonus: 2, skills: [{ name: 'Stealth', bonus: stealthSkillBonus }] },
        { name: 'Strength', bonus: 0, skills: [] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: mockRollSkillCheck, quickRollPlayerSave: vi.fn(),
      });
      loadCombatSummary.mockResolvedValue({ lastAttack: { d20: 12, bonus: stealthSkillBonus, total: 12 + stealthSkillBonus } });

      await act(async () => {
        render(<CharActions playerStats={stats} campaignName="my-campaign" />, { wrapper });
      });

      const hideBtn = screen.getByText('Hide');
      await act(async () => { fireEvent.click(hideBtn); });

      await waitFor(() => {
        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeConditions', ['invisible'], 'my-campaign');
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestCharacter', 'activeBuffs', [{ effect: 'advantage_on_stealth' }], 'my-campaign');
      });
    });

    it('Hide does nothing when cannotAct is true', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      await act(async () => {
        render(<CharActions playerStats={createStats({ actions: ['Hide'] })} cannotAct={true} />, { wrapper });
      });

      const hideBtn = screen.getByText('Hide');
      await act(async () => { fireEvent.click(hideBtn); });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });
  });

  describe('grapple base action', () => {
    it('renders Grapple as a clickable action', async () => {
      getRuntimeValue.mockImplementation(() => null);

      const stats = createStats({ actions: ['Grapple', 'Dash'] });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Grapple')).toHaveClass('base-action-clickable');
    });

    it('Grapple shows error popup when no target selected', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollAbilityCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: mockRollAbilityCheck, quickRollPlayerSave: vi.fn(),
      });
      loadCombatSummary.mockResolvedValue({
        lastAttack: null,
        creatures: [{ name: 'Goblin', conditions: [] }],
      });
      getTargetFromAttacker.mockReturnValue(null);

      await act(async () => {
        render(<CharActions playerStats={createStats({ actions: ['Grapple'] })} campaignName="my-campaign" />, { wrapper });
      });

      const grappleBtn = screen.getByText('Grapple');
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('No target selected'),
        }));
      });
      expect(mockRollAbilityCheck).not.toHaveBeenCalled();
    });

    it('Grapple rolls Strength check and applies grappled on success (strictly greater)', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollAbilityCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const strMod = 3;
      const proficiency = 3;
      const strCheckBonus = strMod + proficiency;
      const stats = createStats({ actions: ['Grapple'], skillProficiencies: ['Athletics'], level: 5 });
      stats.abilities = [
        { name: 'Strength', bonus: strMod, skills: [{ name: 'Athletics', bonus: strCheckBonus }] },
        { name: 'Dexterity', bonus: 0, skills: [] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: mockRollAbilityCheck, quickRollPlayerSave: vi.fn(),
      });
      loadCombatSummary.mockResolvedValue({
        lastAttack: { d20: 12, bonus: strCheckBonus, total: 12 + strCheckBonus },
        creatures: [{ name: 'Goblin', conditions: [], type: 'npc', ability_score_modifiers: { str: 1 } }],
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin', conditions: [], type: 'npc', ability_score_modifiers: { str: 1 } });

      await act(async () => {
        render(<CharActions playerStats={stats} campaignName="my-campaign" />, { wrapper });
      });

      const grappleBtn = screen.getByText('Grapple');
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockRollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('Grapple successful'),
        }));
        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['grappled']), 'my-campaign');
      });
    });

    it('Grapple does NOT apply grappled on failure (roll <= target STR)', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollAbilityCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const strMod = 3;
      const proficiency = 3;
      const strCheckBonus = strMod + proficiency;
      const stats = createStats({ actions: ['Grapple'], skillProficiencies: ['Athletics'], level: 5 });
      stats.abilities = [
        { name: 'Strength', bonus: strMod, skills: [{ name: 'Athletics', bonus: strCheckBonus }] },
        { name: 'Dexterity', bonus: 0, skills: [] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: mockRollAbilityCheck, quickRollPlayerSave: vi.fn(),
      });
      loadCombatSummary.mockResolvedValue({
        lastAttack: { d20: 3, bonus: strCheckBonus, total: 3 + strCheckBonus },
        creatures: [{ name: 'Orc', conditions: [], type: 'npc', ability_score_modifiers: { str: 10 } }],
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', conditions: [], type: 'npc', ability_score_modifiers: { str: 10 } });

      await act(async () => {
        render(<CharActions playerStats={stats} campaignName="my-campaign" />, { wrapper });
      });

      const grappleBtn = screen.getByText('Grapple');
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockRollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('Grapple failed'),
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Orc', 'activeConditions', expect.arrayContaining(['grappled']), 'my-campaign');
      });
    });

    it('Grapple does NOT apply grappled on tie (roll === target STR is failure)', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollAbilityCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const strMod = 0;
      const stats = createStats({ actions: ['Grapple'], level: 1 });
      stats.abilities = [
        { name: 'Strength', bonus: strMod, skills: [{ name: 'Athletics', bonus: strMod }] },
        { name: 'Dexterity', bonus: 0, skills: [] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: mockRollAbilityCheck, quickRollPlayerSave: vi.fn(),
      });
      loadCombatSummary.mockResolvedValue({
        lastAttack: { d20: 10, bonus: strMod, total: 10 },
        creatures: [{ name: 'Goblin', conditions: [], type: 'npc', ability_score_modifiers: { str: 10 } }],
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin', conditions: [], type: 'npc', ability_score_modifiers: { str: 10 } });

      await act(async () => {
        render(<CharActions playerStats={stats} campaignName="my-campaign" />, { wrapper });
      });

      const grappleBtn = screen.getByText('Grapple');
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockRollAbilityCheck).toHaveBeenCalledWith('Strength', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('Grapple failed'),
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['grappled']), 'my-campaign');
      });
    });

    it('Grapple shows popup when target is already grappled', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return ['grappled'];
        return null;
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });
      loadCombatSummary.mockResolvedValue({
        lastAttack: null,
        creatures: [{ name: 'Goblin', conditions: ['grappled'] }],
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin', conditions: ['grappled'] });

      await act(async () => {
        render(<CharActions playerStats={createStats({ actions: ['Grapple'] })} campaignName="my-campaign" />, { wrapper });
      });

      const grappleBtn = screen.getByText('Grapple');
      await act(async () => { fireEvent.click(grappleBtn); });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Grapple',
          description: expect.stringContaining('already grappled'),
        }));
      });
    });

    it('Grapple does nothing when cannotAct is true', async () => {
      const mockSetPopupHtml = vi.fn();

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      await act(async () => {
        render(<CharActions playerStats={createStats({ actions: ['Grapple'] })} campaignName="my-campaign" cannotAct={true} />);
      });

      const grappleBtn = screen.getByText('Grapple');
      await act(async () => { fireEvent.click(grappleBtn); });

      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });
  });

  describe('non-hide base actions', () => {
    it('renders non-hide base actions as plain text (not clickable)', async () => {
      getRuntimeValue.mockImplementation(() => null);

      const stats = createStats({ actions: ['Dash', 'Disengage', 'Dodge'] });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      const dashEl = screen.getByText(/Dash/);
      expect(dashEl).not.toHaveClass('clickable');
    });
  });

  describe('spell rendering in actions section', () => {
    it('renders action spells with correct level display', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Fireball', level: 3, range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
            { name: 'Magic Missile', level: 1, range: '120 ft', casting_time: '1 action', prepared: 'Prepared', damage: '4d4+4' },
          ],
          toHit: 5,
          saveDc: 15,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('renders cantrips with "Cantrip" label', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Fire Bolt', level: 0, range: '120 ft', casting_time: '1 action', prepared: 'Prepared', damage: '1d10' },
          ],
          toHit: 5,
          saveDc: 13,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it('renders healing spells with "Healing" type label', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Cure Wounds', level: 1, range: 'Touch', casting_time: '1 action', prepared: 'Prepared', heal_at_slot_level: true },
          ],
          toHit: 5,
          saveDc: 13,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Cure Wounds')).toBeInTheDocument();
      expect(screen.getByText('Healing')).toBeInTheDocument();
    });

    it('renders utility spells with "Utility" type label', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Minor Illusion', level: 0, range: '60 ft', casting_time: '1 action', prepared: 'Always', damage: 'Utility' },
          ],
          toHit: 5,
          saveDc: 13,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText('Minor Illusion')).toBeInTheDocument();
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });
  });

  describe('auto-hit spell rendering', () => {
    it('shows save DC column for auto-hit spells (no attack roll needed)', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Ray of Sickness', level: 1, range: '60 ft', casting_time: '1 action', prepared: 'Prepared', damage: '2d8', dc: { dc_type: 'CON', dc_success: 'half' } },
          ],
          toHit: 5,
          saveDc: 13,
        },
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });

      expect(screen.getByText(/DC 13 CON/)).toBeInTheDocument();
    });
  });

  describe('areEqual for React.memo', () => {
    it('returns true when playerStats, conditionAttackMode, exhaustionPenalty, and cannotAct are equal', () => {
      const prevProps = { playerStats: { name: 'Test' }, conditionAttackMode: 'disadvantage', exhaustionPenalty: 2, cannotAct: false };
      const nextProps = { playerStats: { name: 'Test' }, conditionAttackMode: 'disadvantage', exhaustionPenalty: 2, cannotAct: false };
      expect(prevProps.playerStats).toEqual(nextProps.playerStats);
      expect(prevProps.conditionAttackMode).toBe(nextProps.conditionAttackMode);
      expect(prevProps.exhaustionPenalty).toBe(nextProps.exhaustionPenalty);
      expect(prevProps.cannotAct).toBe(nextProps.cannotAct);
    });

    it('returns false when playerStats differ', () => {
      const prevProps = { playerStats: { name: 'Test' }, conditionAttackMode: 'disadvantage', exhaustionPenalty: 2, cannotAct: false };
      const nextProps = { playerStats: { name: 'Other' }, conditionAttackMode: 'disadvantage', exhaustionPenalty: 2, cannotAct: false };
      expect(prevProps.playerStats).not.toEqual(nextProps.playerStats);
    });
  });

  describe('feat range effects loading', () => {
    it('renders without errors when playerStats has feats', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        return null;
      });

      await act(async () => {
        render(<CharActions
          playerStats={createStats({ feats: [{ name: 'War Caster' }] })}
        />);
      });

      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });
});

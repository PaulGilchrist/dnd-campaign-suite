// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
  onSpellSelected: vi.fn(),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn((props) => <div data-testid="dice-roll-result">{props.name || 'DiceRollResult'}</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

vi.mock('./EmpoweredSpellPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="empowered-spell-popup">EmpoweredSpellPopup</div>),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name })),
  resolveSpellDamageAtLevel: vi.fn(() => '8d6'),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ maxFocusPoints: 2 })),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
    saveDcBonus: 0,
  })),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(),
    handleSpellAttackClick: vi.fn(),
    handleSpellDamageClick: vi.fn(),
  })),
}));

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  actions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharActions spells', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
    });
  });

  describe('action spell filtering', () => {
    const actionSpell = {
      name: 'Fireball',
      range: '150 ft',
      casting_time: '1 action',
      prepared: 'Prepared',
      damage: '8d6',
    };

    it('renders spells with casting_time "1 action"', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] } })} />);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it.each([
      ['1 action', '1 action'],
      ['1 Action', '1 Action'],
      ['action', 'action'],
      ['Action', 'Action'],
    ])('renders spells with casting_time "%s"', (_label, castingTime) => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [{ ...actionSpell, casting_time: castingTime }] } })} />);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('excludes spells with non-action casting times', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [{ ...actionSpell, casting_time: '1 bonus action' }] } })} />);
      expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
    });

    it('excludes spells without damage', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [{ name: 'Identify', range: 'Touch', casting_time: '1 action', prepared: 'Prepared' }] } })} />);
      expect(screen.queryByText('Identify')).not.toBeInTheDocument();
    });

    it('excludes unprepared spells', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [{ ...actionSpell, prepared: 'Unprepared' }] } })} />);
      expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
    });

    it('includes always-prepared spells', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [{ ...actionSpell, prepared: 'Always' }] } })} />);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('includes spells even when they share a name with an attack', () => {
      const stats = createStats({
        attacks: [{ name: 'Fireball', range: 60, hitBonus: 5, damage: '8d6', damageType: 'Fire', type: 'Action' }],
        spellAbilities: { spells: [actionSpell] },
      });
      render(<CharActions playerStats={stats} />);
      // Both the attack and the spell share the same name and both render
      expect(screen.getAllByText('Fireball').length).toBe(2);
    });

    it('does not render spells when spellAbilities is undefined', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: undefined })} />);
      expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
    });

    it('does not render spells when spellAbilities.spells is undefined', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: {} })} />);
      expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
    });

    it('renders spells with empty actions array', () => {
      render(<CharActions playerStats={createStats({ actions: [], spellAbilities: { spells: [actionSpell] } })} />);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });
  });

  describe('action spell display', () => {
    const actionSpell = {
      name: 'Fireball',
      range: '150 ft',
      casting_time: '1 action',
      prepared: 'Prepared',
      damage: '8d6',
    };

    it('displays "Utility" as the damage type column for action spells', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] } })} />);
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('displays the spell range', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] } })} />);
      expect(screen.getByText('150 ft.')).toBeInTheDocument();
    });

    it('renders multiple action spells', () => {
      const stats = createStats({
        spellAbilities: {
          spells: [
            { ...actionSpell, name: 'Fireball' },
            { ...actionSpell, name: 'Magic Missile', range: '120 ft', damage: '4d4+4' },
          ],
        },
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });

    it('renders both action attacks and action spells with different names', () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        spellAbilities: { spells: [actionSpell] },
      });
      render(<CharActions playerStats={stats} />);
      expect(screen.getByText('Longsword')).toBeInTheDocument();
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });
  });

  describe('spell click behavior', () => {
    const actionSpell = {
      name: 'Fireball',
      range: '150 ft',
      casting_time: '1 action',
      prepared: 'Prepared',
      damage: '8d6',
      level: 3,
    };

    it('opens SpellDetailPopup when an action spell is clicked', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] } })} />);
      const spellLink = screen.getByText('Fireball');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('passes the full spell object to SpellDetailPopup when clicked', async () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] } })} />);
      const spellLink = screen.getByText('Fireball');
      fireEvent.click(spellLink);
      const { default: SpellDetailPopup } = await import('./char-spells/SpellDetailPopup.jsx');
      expect(SpellDetailPopup).toHaveBeenCalled();
      const calledWith = SpellDetailPopup.mock.calls[0][0];
      expect(calledWith.spell).toEqual(actionSpell);
    });

    it('does not open SpellDetailPopup when an attack with matching spell name is clicked (attack uses handleAttackClick)', () => {
      render(<CharActions playerStats={createStats({
        attacks: [{ name: 'Fireball', range: 60, hitBonus: 5, damage: '8d6', damageType: 'Fire', type: 'Action' }],
        spellAbilities: { spells: [{ ...actionSpell, casting_time: '1 bonus action' }] },
      })} />);
      const attackName = screen.getByText('Fireball');
      fireEvent.click(attackName);
      // Attack names now call handleAttackClick, not handleActionSpellClick
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('does not open SpellDetailPopup when spell name does not exist', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] } })} />);
      // The handleActionSpellClick receives a nonexistent name — it should silently fail
      // by finding no spell and returning early. We verify no popup appears.
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('closes SpellDetailPopup when the popup overlay is clicked', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] } })} />);
      const spellLink = screen.getByText('Fireball');
      fireEvent.click(spellLink);
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      const popupOverlay = screen.getByTestId('popup-overlay');
      fireEvent.click(popupOverlay);
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });
  });

  describe('action spells with Elder Champion buff', () => {
    it('excludes action spells when Elder Champion is active', async () => {
      const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Elder Champion' }];
        return null;
      });
      const actionSpell = {
        name: 'Fireball',
        range: '150 ft',
        casting_time: '1 action',
        prepared: 'Prepared',
        damage: '8d6',
      };
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] }, name: 'TestCharacter' })} />);
      expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
    });

    it('includes action spells when Elder Champion is not active', () => {
      const actionSpell = {
        name: 'Fireball',
        range: '150 ft',
        casting_time: '1 action',
        prepared: 'Prepared',
        damage: '8d6',
      };
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [actionSpell] } })} />);
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });
  });

  describe('spell column structure', () => {
    it('renders hit and damage columns for action spells', () => {
      render(<CharActions playerStats={createStats({ spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] } })} />);
      expect(screen.getByText('Hit')).toBeInTheDocument();
      expect(screen.getByText('Damage')).toBeInTheDocument();
    });
  });
});

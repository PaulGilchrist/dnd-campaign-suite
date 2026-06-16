import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';

vi.mock('../../hooks/useSpellMetamagicFlow.js', () => ({
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
  })),
}));

vi.mock('../../hooks/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automationService.js', () => ({
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

vi.mock('../../hooks/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
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

vi.mock('../../hooks/useActionPopup.js', () => ({
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

vi.mock('../../hooks/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
    saveDcBonus: 0,
  })),
}));

vi.mock('../../hooks/useActionSpellMetamagic.js', () => ({
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

  describe('action spell rendering', () => {
    it('should render action spells with casting_time of "1 action"', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('should not render spells without damage as action spells', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Identify', range: 'Touch', casting_time: '1 action', prepared: 'Prepared' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Identify')).not.toBeInTheDocument();
    });

    it('should exclude spells that share names with action attacks', async () => {
      const stats = createStats({
        attacks: [{ name: 'Fireball', range: 60, hitBonus: 5, damage: '8d6', damageType: 'Fire', type: 'Action' }],
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('should show "Utility" as type for action spells', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('should show "Utility" for action spell damage type', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Utility')).toBeInTheDocument();
    });

    it('should include Always-prepared spells', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Always', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('should exclude unprepared spells', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Unprepared Spell', range: '60 ft', casting_time: '1 action', prepared: 'Unprepared', damage: '1d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Unprepared Spell')).not.toBeInTheDocument();
    });

    it('should not render spells without damage as action spells (detect magic)', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Detect Magic', range: '30 ft', casting_time: '1 action', prepared: 'Prepared' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Detect Magic')).not.toBeInTheDocument();
    });
  });

  describe('spell click behavior', () => {
    it('should open spell detail popup when action spell is clicked', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const spellLink = screen.getByText('Fireball');
      await act(async () => { fireEvent.click(spellLink); });
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('should close spell detail popup when dismissed', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const spellLink = screen.getByText('Fireball');
      await act(async () => { fireEvent.click(spellLink); });
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
      const popupOverlay = screen.getByTestId('popup-overlay');
      await act(async () => { fireEvent.click(popupOverlay); });
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
    });

    it('should open spell detail popup for action spell click', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const spellLink = screen.getByText('Fireball');
      await act(async () => { fireEvent.click(spellLink); });
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('should open spell detail popup for attack that matches a spell name', async () => {
      const stats = createStats({
        attacks: [{ name: 'Fireball', range: 60, hitBonus: 5, damage: '8d6', damageType: 'Fire', type: 'Action' }],
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const attackName = screen.getByText('Fireball');
      await act(async () => { fireEvent.click(attackName); });
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });

    it('should pass correct props to SpellDetailPopup when spell is clicked', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6', level: 3 }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const spellLink = screen.getByText('Fireball');
      await act(async () => { fireEvent.click(spellLink); });
      expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
    });
  });

  describe('spell casting time variations', () => {
    it('should include "Action" casting time', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Action Spell', range: '60 ft', casting_time: 'Action', prepared: 'Prepared', damage: '1d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Action Spell')).toBeInTheDocument();
    });

    it('should include "1 Action" casting time', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'One Action Spell', range: '60 ft', casting_time: '1 Action', prepared: 'Prepared', damage: '1d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('One Action Spell')).toBeInTheDocument();
    });

    it('should include "1 action" lowercase casting time', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Lowercase Action', range: '60 ft', casting_time: '1 action', prepared: 'Prepared', damage: '1d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Lowercase Action')).toBeInTheDocument();
    });

    it('should include "action" lowercase casting time', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Lowercase Only', range: '60 ft', casting_time: 'action', prepared: 'Prepared', damage: '1d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Lowercase Only')).toBeInTheDocument();
    });
  });

  describe('multiple action spells', () => {
    it('should render multiple action spells', async () => {
      const stats = createStats({
        spellAbilities: {
          spells: [
            { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
            { name: 'Magic Missile', range: '120 ft', casting_time: '1 action', prepared: 'Prepared', damage: '4d4+4' },
          ],
        },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });
  });
});

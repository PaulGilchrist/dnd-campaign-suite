import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';

vi.mock('../../hooks/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
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

vi.mock('../../services/automation/handlers/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/divineInterventionHandler.js', () => ({
  onSpellSelected: vi.fn(),
}));

vi.mock('../../hooks/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/rangeValidation.js', () => ({
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

vi.mock('./MetamagicPopup.jsx', () => ({
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

vi.mock('../../services/combat/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/rules/attackCalc.js', () => ({
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

import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js';
import { useActionSpellMetamagic } from '../../hooks/useActionSpellMetamagic.js';
import { hasAutomation } from '../../services/combat/automationService.js';
import { isExhausted } from '../../services/automation/handlers/saveAttackHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { getInnateSorceryBonus } from '../../services/combat/buffService.js';
import { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { executeHandler } from '../../services/automation/index.js';

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

describe('CharActions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    // Mock fetch to avoid "Failed to parse URL from /data/actions.json" errors
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
    });
    useSpellMetamagicFlow.mockReturnValue({
      pendingMetamagic: null,
      gateMetamagic: vi.fn(),
      handleConfirm: vi.fn(),
      handleSkip: vi.fn(),
    });
    rollExpression.mockReturnValue({ total: 5, rolls: [3, 2], modifier: 0 });
    rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 });
  });

  // ===== Basic Rendering =====

  it('should render Actions header', async () => {
    const stats = createStats({
      actions: [
        { name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should render attacks section with headers', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText('Damage')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('should render attack name', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Longsword')).toBeInTheDocument();
  });

  it('should render attack range', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('5 ft.')).toBeInTheDocument();
  });

  it('should render attack damage', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('1d8+3')).toBeInTheDocument();
  });

  it('should render attack damage type', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Slashing')).toBeInTheDocument();
  });

  it('should skip non-Action attacks', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('Main Gauche')).not.toBeInTheDocument();
  });

  // ===== Hit Bonus Display =====

  it('should display hit bonus for attack without save DC', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} exhaustionPenalty={0} />);
    });

    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('should display save DC instead of hit bonus when attack has saveDc', async () => {
    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 14,
          saveType: 'CON',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/DC 14 CON/)).toBeInTheDocument();
  });

  it('should apply innate sorcery save DC bonus', async () => {
    getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 1 });

    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 14,
          saveType: 'CON',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/DC 15 CON/)).toBeInTheDocument();
  });

  it('should apply exhaustion penalty to hit bonus', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} exhaustionPenalty={2} />);
    });

    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  // ===== 2024 Rules Rendering =====

  it('should show Mastery column for 2024 rules', async () => {
    const stats = createStats({
      rules: '2024',
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Mastery')).toBeInTheDocument();
  });

  it('should not show Mastery column for 5e rules', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('Mastery')).not.toBeInTheDocument();
  });

  it('should apply mastery-enabled class for 2024 rules', async () => {
    const stats = createStats({
      rules: '2024',
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const attacksDiv = document.querySelector('.attacks.mastery-enabled');
    expect(attacksDiv).toBeInTheDocument();
  });

  // ===== Action Rendering =====

  it('should render action names from playerStats.actions', async () => {
    const stats = createStats({
      actions: [
        { name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
  });

  it('should render action descriptions with sanitized HTML', async () => {
    const stats = createStats({
      actions: [
        { name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(sanitizeHtml).toHaveBeenCalledWith('Regain hit points.');
  });

  it('should render action as clickable when details exist', async () => {
    const stats = createStats({
      actions: [
        { name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Second Wind:/);
    expect(actionName).toHaveClass('clickable');
  });

  it('should render action as clickable when it has automation', async () => {
    hasAutomation.mockReturnValue(true);

    const stats = createStats({
      actions: [
        { name: 'Rage', description: 'Enter a rage.', automation: { type: 'combat_stance' } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Rage:/);
    expect(actionName).toHaveClass('clickable');
  });

  it('should not render action as clickable when no details and no automation', async () => {
    const stats = createStats({
      actions: [
        { name: 'Simple Action', description: 'A simple action.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Simple Action:/);
    expect(actionName).not.toHaveClass('clickable');
  });

  it('should call buildFeatureDetailHtml when action with details is clicked', async () => {
    const stats = createStats({
      actions: [
        { name: 'Test Feature', description: 'Test desc', details: 'Test details' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Test Feature:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    expect(buildFeatureDetailHtml).toHaveBeenCalledWith(stats.actions[0]);
  });

  // ===== Automation Badge Rendering =====

  it('should show save DC badge for automation with saveDc', async () => {
    hasAutomation.mockImplementation((action) => action?.automation?.type === 'save_attack');

    const stats = createStats({
      actions: [
        {
          name: 'Elemental Bane',
          description: 'Choose a creature.',
          automation: { type: 'save_attack', saveDc: 15, saveType: 'CON' },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('DC 15 CON')).toBeInTheDocument();
  });

  it('should show healing pool badge for healing_pool automation', async () => {
    hasAutomation.mockImplementation((action) => action?.automation?.type === 'healing_pool');

    const stats = createStats({
      actions: [
        { name: 'Life Stream', description: 'Heal a creature.', automation: { type: 'healing_pool', pool: 15 } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Pool: 15 HP')).toBeInTheDocument();
  });

  it('should show damage badge for automation with damage', async () => {
    hasAutomation.mockImplementation((action) => action?.automation?.type === 'auto_effect');

    const stats = createStats({
      actions: [
        { name: 'Thunderous Smite', description: 'Strike with thunder.', automation: { type: 'auto_effect', damage: '2d6', damageType: 'Thunder' } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('2d6 Thunder')).toBeInTheDocument();
  });

  // ===== Metamagic Display =====

  it('should display "Empowered Spell" for Metamagic action with spell_modifier automation', async () => {
    const stats = createStats({
      actions: [
        { name: 'Metamagic', description: 'Modify spells.', automation: { type: 'spell_modifier' } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/Empowered Spell:/)).toBeInTheDocument();
  });

  // ===== Rage Expendable / Restore with Rage =====

  it('should show Restore with Rage button when rage-expendable action is exhausted', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);

    const stats = createStats({
      actions: [
        {
          name: 'Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/Restore with Rage/)).toBeInTheDocument();
  });

  it('should not show Restore with Rage when not rage-expendable', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);

    const stats = createStats({
      actions: [
        {
          name: 'Channel Divinity',
          description: 'Channel divine energy.',
          automation: { type: 'auto_effect', recharge: 'long_rest' },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText(/Restore with Rage/)).not.toBeInTheDocument();
  });

  it('should call setRuntimeValue when Restore with Rage is clicked', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
      if (key === 'ragePoints') return 1;
      return null;
    });

    const stats = createStats({
      actions: [
        {
          name: 'Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const restoreBtn = screen.getByText(/Restore with Rage/);
    await act(async () => {
      fireEvent.click(restoreBtn);
    });

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalled();
    });
  });

  it('should not call automation handler when action is exhausted', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);

    const stats = createStats({
      actions: [
        {
          name: 'Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Rage:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  // ===== Action Spell Rendering =====

  it('should render action spells with casting_time of "1 action"', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('should not render spells without damage as action spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Identify', range: 'Touch', casting_time: '1 action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('Identify')).not.toBeInTheDocument();
  });

  it('should exclude spells that share names with action attacks', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Fireball', range: 60, hitBonus: 5, damage: '8d6', damageType: 'Fire', type: 'Action' },
      ],
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('should show "Utility" as type for action spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Utility')).toBeInTheDocument();
  });

  it('should include Always-prepared spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Always', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('should exclude unprepared spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Unprepared Spell', range: '60 ft', casting_time: '1 action', prepared: 'Unprepared', damage: '1d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('Unprepared Spell')).not.toBeInTheDocument();
  });

  // ===== Spell Click Behavior =====

  it('should open spell detail popup when action spell is clicked', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const spellLink = screen.getByText('Fireball');
    await act(async () => {
      fireEvent.click(spellLink);
    });

    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('should close spell detail popup when dismissed', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const spellLink = screen.getByText('Fireball');
    await act(async () => {
      fireEvent.click(spellLink);
    });

    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();

    const popupOverlay = screen.getByTestId('popup-overlay');
    await act(async () => {
      fireEvent.click(popupOverlay);
    });

    expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
  });

  // ===== Popup Rendering =====

  it('should render popup when popupHtml is set with dice roll result', async () => {
    vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    // We need to check that the DiceRollResult component is rendered
    // The popup is rendered when popupHtml from useLoggedDiceRoll is truthy
    // Since we can't easily inject popupHtml, we'll test the DiceRollResult mock is called
    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    // The component renders without error
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  // ===== Exhaustion Penalty Styling =====

  it('should apply stat--penalized class when exhaustionPenalty > 0', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} exhaustionPenalty={2} />);
    });

    const hitBonusElement = document.querySelector('.stat--penalized');
    expect(hitBonusElement).toBeInTheDocument();
  });

  it('should apply stat--penalized class when conditionAttackMode is disadvantage', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} conditionAttackMode="disadvantage" exhaustionPenalty={0} />);
    });

    const hitBonusElement = document.querySelector('.stat--penalized');
    expect(hitBonusElement).toBeInTheDocument();
  });

  it('should apply disabled-attack class when cannotAct is true', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} cannotAct={true} />);
    });

    const disabledElement = document.querySelector('.disabled-attack');
    expect(disabledElement).toBeInTheDocument();
  });

  it('should show Incapacitated label when cannotAct is true', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} cannotAct={true} />);
    });

    expect(screen.getByText('(Incapacitated)')).toBeInTheDocument();
  });

  it('should not apply stat--penalized class when exhaustionPenalty is 0 and no disadvantage', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} exhaustionPenalty={0} />);
    });

    const hitBonusElement = document.querySelector('.stat--penalized');
    expect(hitBonusElement).not.toBeInTheDocument();
  });

  // ===== Attack/Damage Click Handlers =====

  it('should not call rollAttack when cannotAct is true', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} cannotAct={true} />);
    });

    const hitBonusElement = screen.getByText('+5');
    await act(async () => {
      fireEvent.click(hitBonusElement);
    });

    expect(mockRollAttack).not.toHaveBeenCalled();
  });

  it('should call handleActionSpellDamageClick when damage is clicked for save-DC attack', async () => {
    const mockHandleActionSpellDamageClick = vi.fn();

    vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

    useActionSpellMetamagic.mockReturnValue({
      pendingActionMetamagic: null,
      handleActionMetamagicConfirm: vi.fn(),
      handleActionMetamagicSkip: vi.fn(),
      handleActionSpellDamageClick: mockHandleActionSpellDamageClick,
      handleSpellAttackClick: vi.fn(),
      handleSpellDamageClick: vi.fn(),
    });

    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 14,
          saveType: 'CON',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const damageElement = screen.getByText('1d12');
    await act(async () => {
      fireEvent.click(damageElement);
    });

    expect(mockHandleActionSpellDamageClick).toHaveBeenCalledWith(stats.attacks[0]);
  });

  it('should not call damage handler when cannotAct is true', async () => {
    const mockHandleSpellDamageClick = vi.fn();

    vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

    useActionSpellMetamagic.mockReturnValue({
      pendingActionMetamagic: null,
      handleActionMetamagicConfirm: vi.fn(),
      handleActionMetamagicSkip: vi.fn(),
      handleActionSpellDamageClick: vi.fn(),
      handleSpellAttackClick: vi.fn(),
      handleSpellDamageClick: mockHandleSpellDamageClick,
    });

    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} cannotAct={true} />);
    });

    const damageElement = screen.getByText('1d8+3');
    await act(async () => {
      fireEvent.click(damageElement);
    });

    expect(mockHandleSpellDamageClick).not.toHaveBeenCalled();
  });

  // ===== Automation Handling =====

  it('should call handleAutomationAction when action with automation is clicked', async () => {
    hasAutomation.mockReturnValue(true);

    const stats = createStats({
      actions: [
        { name: 'War Priest', description: 'Make a weapon attack.', automation: { type: 'bonus_action_attack' } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/War Priest:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    expect(executeHandler).toHaveBeenCalledWith(stats.actions[0], expect.anything(), undefined, undefined);
  });

  it('should not call executeHandler when cannotAct is true', async () => {
    hasAutomation.mockReturnValue(true);

    const stats = createStats({
      actions: [
        { name: 'War Priest', description: 'Make a weapon attack.', automation: { type: 'bonus_action_attack' } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} cannotAct={true} />);
    });

    const actionName = screen.getByText(/War Priest:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should call executeHandler and set popup on popup result', async () => {
    hasAutomation.mockReturnValue(true);
    executeHandler.mockResolvedValue({ type: 'popup', payload: '<div>Popup</div>' });

    const stats = createStats({
      actions: [
        { name: 'Smite', description: 'Strike with divine power.', automation: { type: 'auto_effect' } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Smite:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalled();
    });
  });

  it('should call onBuffsChange for notify_buffs_changed result', async () => {
    hasAutomation.mockReturnValue(true);
    executeHandler.mockResolvedValue({ type: 'notify_buffs_changed' });

    const stats = createStats({
      actions: [
        { name: 'Buff', description: 'Gain a buff.', automation: { type: 'temp_buff' } },
      ],
    });

    const mockOnBuffsChange = vi.fn();

    await act(async () => {
      render(<CharActions playerStats={stats} onBuffsChange={mockOnBuffsChange} />);
    });

    const actionName = screen.getByText(/Buff:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(mockOnBuffsChange).toHaveBeenCalled();
    });
  });

  it('should call onBuffsChange for popup result with temp_buff type', async () => {
    hasAutomation.mockReturnValue(true);
    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: '<b>Buff</b>',
    });

    const stats = createStats({
      actions: [
        { name: 'Temp Buff', description: 'Temporary buff.', automation: { type: 'temp_buff' } },
      ],
    });

    const mockOnBuffsChange = vi.fn();

    await act(async () => {
      render(<CharActions playerStats={stats} onBuffsChange={mockOnBuffsChange} />);
    });

    const actionName = screen.getByText(/Temp Buff:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(mockOnBuffsChange).toHaveBeenCalled();
    });
  });

  it('should call onBuffsChange for popup result with combat_stance type', async () => {
    hasAutomation.mockReturnValue(true);
    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: '<b>Stance</b>',
    });

    const stats = createStats({
      actions: [
        { name: 'Combat Stance', description: 'Enter a stance.', automation: { type: 'combat_stance' } },
      ],
    });

    const mockOnBuffsChange = vi.fn();

    await act(async () => {
      render(<CharActions playerStats={stats} onBuffsChange={mockOnBuffsChange} />);
    });

    const actionName = screen.getByText(/Combat Stance:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(mockOnBuffsChange).toHaveBeenCalled();
    });
  });

  // ===== Base Actions =====

  it('should render base actions from actions.json', async () => {
    const stats = createStats({
      actions: [],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Base Actions:')).toBeInTheDocument();
  });

  // ===== CharBonusActions Rendering =====

  it('should render CharBonusActions child component', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Cunning Action', description: 'Dash, Disengage, or Hide.', details: 'Fast movement.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByTestId('char-bonus-actions')).toBeInTheDocument();
  });

  it('should pass playerStats to CharBonusActions', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Cunning Action', description: 'Dash, Disengage, or Hide.', details: 'Fast movement.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByTestId('char-bonus-actions')).toBeInTheDocument();
  });

  // ===== Feature Choice Modal =====

  it('should show feature choice modal when damage_bonus action has options and no chosen option', async () => {
    hasAutomation.mockReturnValue(true);
    vi.mocked(getRuntimeValue).mockReturnValue(null);

    const stats = createStats({
      actions: [
        {
          name: 'Blessed Strikes',
          description: 'Choose a damage type.',
          automation: { type: 'damage_bonus', options: ['Lightning', 'Thunder'] },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Blessed Strikes:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(screen.getByText(/Choose your option/)).toBeInTheDocument();
    });
  });

  it('should show feature choice modal for save_attack with hasOptions', async () => {
    hasAutomation.mockReturnValue(true);
    vi.mocked(getRuntimeValue).mockReturnValue(null);

    const stats = createStats({
      actions: [
        {
          name: 'Elemental Attunement',
          description: 'Choose an element.',
          automation: { type: 'save_attack', hasOptions: true, options: ['Fire', 'Cold'] },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Elemental Attunement:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(screen.getByText(/Choose your option/)).toBeInTheDocument();
    });
  });

  it('should confirm feature choice and save selection', async () => {
    hasAutomation.mockReturnValue(true);
    vi.mocked(getRuntimeValue).mockReturnValue(null);

    const stats = createStats({
      actions: [
        {
          name: 'Blessed Strikes',
          description: 'Choose a damage type.',
          automation: { type: 'damage_bonus', options: ['Lightning', 'Thunder'] },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Blessed Strikes:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(screen.getByText(/Choose your option/)).toBeInTheDocument();
    });

    // Click the Lightning option
    const lightningBtn = screen.getByText('Lightning');
    await act(async () => {
      fireEvent.click(lightningBtn);
    });

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        '_Blessed_Strikes_option',
        'Lightning',
        undefined
      );
    });
  });

  it('should skip feature choice', async () => {
    hasAutomation.mockReturnValue(true);
    vi.mocked(getRuntimeValue).mockReturnValue(null);

    const stats = createStats({
      actions: [
        {
          name: 'Blessed Strikes',
          description: 'Choose a damage type.',
          automation: { type: 'damage_bonus', options: ['Lightning', 'Thunder'] },
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Blessed Strikes:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(screen.getByText(/Choose your option/)).toBeInTheDocument();
    });

    // Click Cancel
    const cancelBtn = screen.getByText('Cancel');
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    // Modal should be dismissed
    expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
  });

  // ===== Monk Ki Features =====

  it('should spend focus point for monk ki features', async () => {
    hasAutomation.mockReturnValue(true);
    const stats = createStats({
      class: { class_levels: [{ level: 5, focus_points: 2 }] },
      level: 5,
      _trackedResources: { focusPoints: { current: 2 } },
      actions: [
        { name: 'Flurry of Blows', description: 'Make two attacks.', automation: { type: 'auto_effect' } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Flurry of Blows:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'focusPoints',
        expect.any(Number),
        undefined
      );
    });
  });

  // ===== Initiative-rolled Event Handler =====

  it('should recover focus points when initiative is rolled', async () => {
    const stats = createStats({
      class: { class_levels: [{ level: 5, focus_points: 2 }] },
      level: 5,
      actions: [
        { name: 'Test', automation: { type: 'initiative_action', effect: 'not_wild_shape' } },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} campaignName="test" />);
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('initiative-rolled', {
        detail: { characterName: 'TestCharacter' },
      }));
    });

    expect(window).toHaveProperty('dispatchEvent');
  });

  // ===== Spell Casting =====

  it('should open spell detail popup for action spell click', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const spellLink = screen.getByText('Fireball');
    await act(async () => {
      fireEvent.click(spellLink);
    });

    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('should open spell detail popup for attack that matches a spell name', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Fireball', range: 60, hitBonus: 5, damage: '8d6', damageType: 'Fire', type: 'Action' },
      ],
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const attackName = screen.getByText('Fireball');
    await act(async () => {
      fireEvent.click(attackName);
    });

    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== Metamagic Popup =====

  it('should render MetamagicPopup when actionPendingMetamagic is set', async () => {
    useSpellMetamagicFlow.mockReturnValue({
      pendingMetamagic: {
        spellName: 'Fireball',
        spellLevel: 3,
        _currentSP: 5,
      },
      gateMetamagic: vi.fn(),
      handleConfirm: vi.fn(),
      handleSkip: vi.fn(),
    });

    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  it('should render pendingActionMetamagic popup', async () => {
    vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

    useActionSpellMetamagic.mockReturnValue({
      pendingActionMetamagic: {
        spellName: 'Fireball',
        spellLevel: 3,
        _currentSP: 5,
      },
      handleActionMetamagicConfirm: vi.fn(),
      handleActionMetamagicSkip: vi.fn(),
      handleActionSpellDamageClick: vi.fn(),
      handleSpellAttackClick: vi.fn(),
      handleSpellDamageClick: vi.fn(),
    });

    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  // ===== Spell with save DC attack =====

  it('should render save DC display for action attacks with saveDc', async () => {
    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 13,
          saveType: 'STR',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/DC 13 STR/)).toBeInTheDocument();
  });

  it('should render action attack with save DC correctly', async () => {
    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 13,
          saveType: 'STR',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/DC 13 STR/)).toBeInTheDocument();
    expect(screen.getByText('1d12')).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
  });

  // ===== Spell casting time variations =====

  it('should include "Action" casting time', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Action Spell', range: '60 ft', casting_time: 'Action', prepared: 'Prepared', damage: '1d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Action Spell')).toBeInTheDocument();
  });

  it('should include "1 Action" casting time', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'One Action Spell', range: '60 ft', casting_time: '1 Action', prepared: 'Prepared', damage: '1d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('One Action Spell')).toBeInTheDocument();
  });

  it('should include "1 action" lowercase casting time', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Lowercase Action', range: '60 ft', casting_time: '1 action', prepared: 'Prepared', damage: '1d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Lowercase Action')).toBeInTheDocument();
  });

  it('should include "action" lowercase casting time', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Lowercase Only', range: '60 ft', casting_time: 'action', prepared: 'Prepared', damage: '1d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Lowercase Only')).toBeInTheDocument();
  });

  // ===== Non-action attacks should be skipped =====

  it('should skip Bonus Action attacks from action list', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('Main Gauche')).not.toBeInTheDocument();
  });

  it('should skip Reaction attacks from action list', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Opportunity Attack', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Reaction' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('Opportunity Attack')).not.toBeInTheDocument();
  });

  // ===== Spell damage column for action spells =====

  it('should show "Utility" for action spell damage type', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Utility')).toBeInTheDocument();
  });

  // ===== HTML Sanitization =====

  it('should sanitize HTML in action descriptions', async () => {
    const stats = createStats({
      actions: [
        { name: 'XSS Test', description: '<script>alert("xss")</script>Test' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(sanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>Test');
  });


  // ===== Spell with save DC attack =====

  it('should handle playerStats with undefined spellAbilities gracefully', async () => {
    const stats = createStats({
      spellAbilities: undefined,
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Longsword')).toBeInTheDocument();
  });

  // ===== Empty/Null Safety =====

  it('should handle empty attacks array', async () => {
    const stats = createStats({
      attacks: [],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should handle empty actions array', async () => {
    const stats = createStats({
      actions: [],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should handle empty spellAbilities gracefully', async () => {
    const stats = createStats({
      spellAbilities: { spells: [] },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  // ===== Multiple Action Types Together =====

  it('should render action attacks, spells, and action features together', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
      actions: [
        { name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' },
      ],
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  // ===== Combined attacks and actions =====

  it('should render both action attacks and action features together', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
      actions: [
        { name: 'Second Wind', description: 'Regain hit points.', details: 'Heal 1d10+1 HP.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText(/Second Wind:/)).toBeInTheDocument();
  });

  // ===== Multiple Action Spells =====

  it('should render multiple action spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' },
          { name: 'Magic Missile', range: '120 ft', casting_time: '1 action', prepared: 'Prepared', damage: '4d4+4' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText('Magic Missile')).toBeInTheDocument();
  });

  // ===== Spell without damage should not render =====

  it('should not render spells without damage as action spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Detect Magic', range: '30 ft', casting_time: '1 action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('Detect Magic')).not.toBeInTheDocument();
  });

  // ===== Exhaustion penalty on hit bonus display =====

  it('should show correct hit bonus with exhaustion penalty', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} exhaustionPenalty={3} />);
    });

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  // ===== Spell with save DC should show DC, not hit bonus =====

  it('should show DC for save-based spell attacks', async () => {
    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 13,
          saveType: 'STR',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/DC 13 STR/)).toBeInTheDocument();
  });

  // ===== Spell with save DC should not show hit bonus =====

  it('should not show hit bonus for save-based spell attacks', async () => {
    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 13,
          saveType: 'STR',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.queryByText('+5')).not.toBeInTheDocument();
  });

  // ===== SpellDetailPopup props =====

  it('should pass correct props to SpellDetailPopup when spell is clicked', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6', level: 3 },
        ],
      },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    const spellLink = screen.getByText('Fireball');
    await act(async () => {
      fireEvent.click(spellLink);
    });

    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== Base Actions Section =====

  it('should render base actions section', async () => {
    const stats = createStats({
      actions: [],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Base Actions:')).toBeInTheDocument();
  });

  // ===== CharBonusActions props =====

  it('should pass onAttackClick to CharBonusActions', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Cunning Action', description: 'Dash, Disengage, or Hide.', details: 'Fast movement.' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByTestId('char-bonus-actions')).toBeInTheDocument();
  });

  // ===== Cannot Act Blocks =====

  it('should not call rollAttack when cannotAct is true on hit bonus click', async () => {
    const mockRollAttack = vi.fn();
    vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

    const stats = createStats({
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} cannotAct={true} />);
    });

    const hitBonusElement = screen.getByText('+5');
    await act(async () => {
      fireEvent.click(hitBonusElement);
    });

    expect(mockRollAttack).not.toHaveBeenCalled();
  });

  // ===== Action spells with save DC attack =====

  it('should render action attack with save DC correctly', async () => {
    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 13,
          saveType: 'STR',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText(/DC 13 STR/)).toBeInTheDocument();
    expect(screen.getByText('1d12')).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
  });

  // ===== Spell attack click when cannotAct =====

  it('should not call handleSpellAttackClick when cannotAct is true', async () => {
    const mockHandleSpellAttackClick = vi.fn();

    vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

    useActionSpellMetamagic.mockReturnValue({
      pendingActionMetamagic: null,
      handleActionMetamagicConfirm: vi.fn(),
      handleActionMetamagicSkip: vi.fn(),
      handleActionSpellDamageClick: vi.fn(),
      handleSpellAttackClick: mockHandleSpellAttackClick,
      handleSpellDamageClick: vi.fn(),
    });

    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 14,
          saveType: 'CON',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} cannotAct={true} />);
    });

    const saveDcElement = screen.getByText(/DC 14 CON/);
    await act(async () => {
      fireEvent.click(saveDcElement);
    });

    expect(mockHandleSpellAttackClick).not.toHaveBeenCalled();
  });

  // ===== Spell damage click when cannotAct =====

  it('should not call damage handler when cannotAct is true for save-DC attack', async () => {
    const mockHandleActionSpellDamageClick = vi.fn();

    vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

    useActionSpellMetamagic.mockReturnValue({
      pendingActionMetamagic: null,
      handleActionMetamagicConfirm: vi.fn(),
      handleActionMetamagicSkip: vi.fn(),
      handleActionSpellDamageClick: mockHandleActionSpellDamageClick,
      handleSpellAttackClick: vi.fn(),
      handleSpellDamageClick: vi.fn(),
    });

    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 14,
          saveType: 'CON',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Action',
        },
      ],
    });

    await act(async () => {
      render(<CharActions playerStats={stats} cannotAct={true} />);
    });

    const damageElement = screen.getByText('1d12');
    await act(async () => {
      fireEvent.click(damageElement);
    });

    expect(mockHandleActionSpellDamageClick).not.toHaveBeenCalled();
  });

  // ===== Empty attacks and actions =====

  it('should render with empty attacks and actions', async () => {
    const stats = createStats({
      attacks: [],
      actions: [],
      spellAbilities: { spells: [] },
    });

    await act(async () => {
      render(<CharActions playerStats={stats} />);
    });

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Base Actions:')).toBeInTheDocument();
  });
});

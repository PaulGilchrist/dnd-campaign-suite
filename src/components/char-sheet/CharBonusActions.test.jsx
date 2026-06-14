import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

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
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/rules/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js';
import { hasAutomation } from '../../services/combat/automationService.js';
import { isExhausted } from '../../services/automation/handlers/saveAttackHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { getInnateSorceryBonus } from '../../services/combat/buffService.js';
import { showWeaponMasteryPopup } from '../../hooks/useActionPopup.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharBonusActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ===== Return null for no bonus content =====

  it('should return null when there is no bonus content', () => {
    const stats = createStats({
      bonusActions: [],
      attacks: [
        { name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' },
      ],
      spellAbilities: { spells: [] },
    });

    const { container } = render(<CharBonusActions playerStats={stats} />);
    expect(container.firstChild).toBeNull();
  });

  // ===== Rendering Bonus Actions Section =====

  it('should render Bonus Actions header when bonusActions exist', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Cunning Action', description: 'You can take a bonus action.', details: 'Dash, Hide, or Disengage.' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
  });

  it('should render Bonus Actions header when bonus action attacks exist', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
  });

  it('should render Bonus Actions header when bonus action spells exist', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Bonus Actions')).toBeInTheDocument();
  });

  // ===== Bonus Action Attacks Rendering =====

  it('should display bonus action attack name', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Main Gauche')).toBeInTheDocument();
  });

  it('should display bonus action attack range', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('5 ft.')).toBeInTheDocument();
  });

  it('should display bonus action attack damage', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('1d4+3')).toBeInTheDocument();
  });

  it('should display bonus action attack damage type', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Piercing')).toBeInTheDocument();
  });

  it('should display hit bonus for bonus action attack without save DC', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} exhaustionPenalty={0} />);
    });

    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('should show save DC instead of hit bonus for bonus action attacks with saveDc', async () => {
    const stats = createStats({
      attacks: [
        {
          name: 'Cone of Cold',
          range: 60,
          saveDc: 14,
          saveType: 'CON',
          damage: '8d8',
          damageType: 'Cold',
          type: 'Bonus Action',
        },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('DC 14 CON')).toBeInTheDocument();
    expect(screen.queryByText('+5')).not.toBeInTheDocument();
  });

  it('should apply innate sorcery save DC bonus to attack display', async () => {
    getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 1 });

    const stats = createStats({
      attacks: [
        {
          name: 'Cone of Cold',
          range: 60,
          saveDc: 14,
          saveType: 'CON',
          damage: '8d8',
          damageType: 'Cold',
          type: 'Bonus Action',
        },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('DC 15 CON')).toBeInTheDocument();
  });

  // ===== Bonus Action Spells Rendering =====

  it('should display bonus action spell name', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
  });

  it('should display bonus action spell range', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Touch')).toBeInTheDocument();
  });

  it('should show utility type for bonus action spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    // Utility appears in the Type column
    expect(screen.getByText('Utility')).toBeInTheDocument();
  });

  // ===== Spell Click Behavior =====

  it('should open spell detail popup when bonus action spell is clicked', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const spellLink = screen.getByText('Shocking Grasp');
    await act(async () => {
      fireEvent.click(spellLink);
    });

    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  it('should close spell detail popup when dismissed', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const spellLink = screen.getByText('Shocking Grasp');
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

  // ===== Bonus Action Descriptions Rendering =====

  it('should display bonus action description name', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Healing Word', description: 'A creature you can see within range regains hit points.', details: 'Restore 1d4+4 HP.' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText(/Healing Word:/)).toBeInTheDocument();
  });

  it('should display bonus action description text', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Healing Word', description: 'A creature you can see within range regains hit points.', details: 'Restore 1d4+4 HP.' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText(/A creature you can see within range regains hit points/)).toBeInTheDocument();
  });

  it('should render bonus action as clickable when it has details', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Cunning Action', description: 'You can take a bonus action.', details: 'Dash, Hide, or Disengage.' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Cunning Action:/);
    expect(actionName).toHaveClass('clickable');
  });

  it('should render bonus action as non-clickable when it has no details and no automation', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Simple Bonus', description: 'A simple bonus action without details.' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Simple Bonus:/);
    expect(actionName).not.toHaveClass('clickable');
  });

  // ===== Automation Handling =====

  it('should call onAutomationAction when bonus action has automation and is clicked', async () => {
    hasAutomation.mockReturnValue(true);

    const stats = createStats({
      bonusActions: [
        {
          name: 'War Priest',
          description: 'You can make one weapon attack as a bonus action.',
          automation: { type: 'bonus_action_attack', trigger: 'after_action' },
        },
      ],
    });

    const onAutomationAction = vi.fn();

    await act(async () => {
      render(<CharBonusActions playerStats={stats} onAutomationAction={onAutomationAction} />);
    });

    const actionName = screen.getByText(/War Priest:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    expect(onAutomationAction).toHaveBeenCalledWith(stats.bonusActions[0]);
  });

  it('should not call onAutomationAction when bonus action is exhausted', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);

    const stats = createStats({
      bonusActions: [
        {
          name: 'Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
        },
      ],
    });

    const onAutomationAction = vi.fn();

    await act(async () => {
      render(<CharBonusActions playerStats={stats} onAutomationAction={onAutomationAction} />);
    });

    const actionName = screen.getByText(/Rage:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    expect(onAutomationAction).not.toHaveBeenCalled();
  });

  // ===== Rage Expendable / Restore with Rage =====

  it('should show Restore with Rage button when rage-expendable bonus action is exhausted', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);

    const stats = createStats({
      bonusActions: [
        {
          name: 'Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage', resourceKey: 'ragePoints' },
        },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText(/Restore with Rage/)).toBeInTheDocument();
  });

  it('should not show Restore with Rage button when not rage-expendable', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);

    const stats = createStats({
      bonusActions: [
        {
          name: 'Channel Divinity',
          description: 'You channel divine energy.',
          automation: { type: 'auto_effect', recharge: 'long_rest' },
        },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.queryByText(/Restore with Rage/)).not.toBeInTheDocument();
  });

  it('should restore rage and show popup when Restore with Rage is clicked', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);
    vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
      if (key === 'ragePoints') return 1;
      return null;
    });

    const stats = createStats({
      bonusActions: [
        {
          name: 'Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage', resourceKey: 'ragePoints' },
        },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const restoreBtn = screen.getByText(/Restore with Rage/);
    await act(async () => {
      fireEvent.click(restoreBtn);
    });

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalled();
    });
  });

  it('should show error popup when no rage remaining to restore', async () => {
    hasAutomation.mockReturnValue(true);
    isExhausted.mockReturnValue(true);
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
      if (key === 'ragePoints') return 0;
      return null;
    });

    const stats = createStats({
      bonusActions: [
        {
          name: 'Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage', resourceKey: 'ragePoints' },
        },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const restoreBtn = screen.getByText(/Restore with Rage/);
    await act(async () => {
      fireEvent.click(restoreBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/No Rage remaining/)).toBeInTheDocument();
    });
  });

  // ===== Automation Badges =====

  it('should show healing_pool badge', async () => {
    hasAutomation.mockImplementation((feature) => {
      return feature?.automation?.type === 'healing_pool';
    });

    const stats = createStats({
      bonusActions: [
        { name: 'Life Stream', description: 'Heal a creature.', automation: { type: 'healing_pool', pool: 15 } },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText(/Pool: 15 HP/)).toBeInTheDocument();
  });

  it('should show damage badge for automation with damage', async () => {
    hasAutomation.mockImplementation((feature) => {
      return feature?.automation?.type === 'auto_effect';
    });

    const stats = createStats({
      bonusActions: [
        { name: 'Thunderous Smite', description: 'Strike with thunderous force.', automation: { type: 'auto_effect', damage: '2d6', damageType: 'Thunder' } },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText(/2d6 Thunder/)).toBeInTheDocument();
  });

  // ===== 2024 Rules Rendering =====

  it('should show Mastery column for 2024 bonus action attacks', async () => {
    const stats = createStats({
      rules: '2024',
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
    });

    // Check for Mastery in the header row
    const masteryHeaders = document.querySelectorAll('div b');
    const hasMasteryHeader = Array.from(masteryHeaders).some(el => el.textContent === 'Mastery');
    expect(hasMasteryHeader).toBe(true);
  });

  it('should show mastery-enabled class for 2024 rules', async () => {
    const stats = createStats({
      rules: '2024',
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
    });

    const attacksDiv = document.querySelector('.attacks.mastery-enabled');
    expect(attacksDiv).toBeInTheDocument();
  });

  it('should not show mastery column for 5e bonus action attacks', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const masteryHeaders = screen.queryAllByText('Mastery');
    expect(masteryHeaders).toHaveLength(0);
  });

  it('should not show mastery column for 2024 bonus action spells without attacks', async () => {
    const stats = createStats({
      rules: '2024',
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} getWeaponMastery={() => null} />);
    });

    // useFullGrid is false when there are no bonus action attacks,
    // so the Mastery column header is not rendered
    const masteryHeaders = document.querySelectorAll('div b');
    const hasMasteryHeader = Array.from(masteryHeaders).some(el => el.textContent === 'Mastery');
    expect(hasMasteryHeader).toBe(false);
  });

  // ===== Weapon Mastery Popup =====

  it('should open weapon mastery popup when mastery is clickable for 2024', async () => {
    const stats = createStats({
      rules: '2024',
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    const mockGetWeaponMastery = vi.fn(() => 'Piercing');

    await act(async () => {
      render(<CharBonusActions playerStats={stats} getWeaponMastery={mockGetWeaponMastery} />);
    });

    // Get the mastery cell in the last column (clickable one)
    const masteryCells = document.querySelectorAll('div.clickable');
    const lastMasteryCell = masteryCells[masteryCells.length - 1];
    await act(async () => {
      fireEvent.click(lastMasteryCell);
    });

    expect(showWeaponMasteryPopup).toHaveBeenCalledWith('Piercing', expect.any(Function));
  });

  // ===== Exhaustion Penalty Styling =====

  it('should apply stat--penalized class when exhaustionPenalty > 0', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} exhaustionPenalty={2} />);
    });

    const hitBonusElement = document.querySelector('.stat--penalized');
    expect(hitBonusElement).toBeInTheDocument();
  });

  it('should apply stat--penalized class when conditionAttackMode is disadvantage', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} conditionAttackMode="disadvantage" exhaustionPenalty={0} />);
    });

    const hitBonusElement = document.querySelector('.stat--penalized');
    expect(hitBonusElement).toBeInTheDocument();
  });

  it('should apply disabled-attack class when cannotAct is true', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} cannotAct />);
    });

    const hitBonusElement = document.querySelector('.disabled-attack');
    expect(hitBonusElement).toBeInTheDocument();
  });

  it('should not call onDamageClick when cannotAct is true', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    const mockOnDamageClick = vi.fn();

    await act(async () => {
      render(<CharBonusActions playerStats={stats} cannotAct onDamageClick={mockOnDamageClick} />);
    });

    const damageElement = screen.getByText('1d4+3');
    await act(async () => {
      fireEvent.click(damageElement);
    });

    expect(mockOnDamageClick).not.toHaveBeenCalled();
  });

  // ===== Attack/Damage Click Handlers =====

  it('should call onAttackClick when hit bonus is clicked', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    const mockOnAttackClick = vi.fn();

    await act(async () => {
      render(<CharBonusActions playerStats={stats} onAttackClick={mockOnAttackClick} exhaustionPenalty={0} />);
    });

    const hitBonusElement = screen.getByText('+5');
    await act(async () => {
      fireEvent.click(hitBonusElement);
    });

    expect(mockOnAttackClick).toHaveBeenCalledWith(stats.attacks[0]);
  });

  it('should call onDamageClick when damage is clicked', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    const mockOnDamageClick = vi.fn();

    await act(async () => {
      render(<CharBonusActions playerStats={stats} onDamageClick={mockOnDamageClick} />);
    });

    const damageElement = screen.getByText('1d4+3');
    await act(async () => {
      fireEvent.click(damageElement);
    });

    expect(mockOnDamageClick).toHaveBeenCalledWith(stats.attacks[0]);
  });

  // ===== Popup Rendering =====

  it('should render popup when popupHtml is set via bonus action click', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Test Feature', description: 'Test description', details: 'Test details' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Test Feature:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });
  });

  // ===== Metamagic Popup Rendering =====

  it('should render MetamagicPopup when pendingMetamagic is set', async () => {
    useSpellMetamagicFlow.mockReturnValue({
      pendingMetamagic: {
        spellName: 'Fireball',
        spellLevel: 3,
        _currentSP: 5,
      },
      gateMetamagic: vi.fn(),
      handleConfirm: vi.fn(),
      handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    });

    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
  });

  // ===== Bonus Action Spell Casting Flow =====

  it('should pass spell name to handleBonusSpellClick and open SpellDetailPopup', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const spellLink = screen.getByText('Shocking Grasp');
    await act(async () => {
      fireEvent.click(spellLink);
    });

    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== HTML Sanitization =====

  it('should sanitize bonus action descriptions', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'XSS Test', description: '<script>alert("xss")</script>Test' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(sanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>Test');
  });

  // ===== Section Header and Divider =====

  it('should render a horizontal rule before Bonus Actions section', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Test', description: 'Test desc', details: 'Test details' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const hr = document.querySelector('hr');
    expect(hr).toBeInTheDocument();
  });

  it('should render sectionHeader div with Bonus Actions text', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Test', description: 'Test desc', details: 'Test details' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Bonus Actions')).toHaveClass('sectionHeader');
  });

  // ===== Multiple Bonus Action Types =====

  it('should render both bonus action attacks and bonus action spells', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Main Gauche')).toBeInTheDocument();
    expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
  });

  // ===== Unprepared Spells Exclusion =====

  it('should exclude unprepared spells from bonus action spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Unprepared Spell', range: '60 ft', casting_time: '1 bonus action', prepared: 'Unprepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.queryByText('Unprepared Spell')).not.toBeInTheDocument();
  });

  it('should include Always-prepared spells in bonus action spells', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Always Prepared', range: '60 ft', casting_time: '1 bonus action', prepared: 'Always' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Always Prepared')).toBeInTheDocument();
  });

  // ===== Attack Name Deduplication =====

  it('should exclude spells that share names with attacks from bonus action spells', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Shocking Grasp', range: 'Touch', hitBonus: 5, damage: '1d8+3', damageType: 'Lightning', type: 'Bonus Action' },
      ],
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Always' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
  });

  // ===== Casting Time Filtering =====

  it('should only include spells with bonus action casting times', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Action Spell', range: '60 ft', casting_time: '1 action', prepared: 'Always' },
          { name: 'Reaction Spell', range: '60 ft', casting_time: '1 reaction', prepared: 'Always' },
          { name: 'Bonus Action Spell', range: '60 ft', casting_time: '1 bonus action', prepared: 'Always' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Bonus Action Spell')).toBeInTheDocument();
    expect(screen.queryByText('Action Spell')).not.toBeInTheDocument();
    expect(screen.queryByText('Reaction Spell')).not.toBeInTheDocument();
  });

  it('should include Bonus Action capitalized casting time', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Capitalized Bonus', range: '60 ft', casting_time: '1 Bonus Action', prepared: 'Always' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Capitalized Bonus')).toBeInTheDocument();
  });

  it('should include bonus action lowercase casting time', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Lowercase Bonus', range: '60 ft', casting_time: 'bonus action', prepared: 'Always' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Lowercase Bonus')).toBeInTheDocument();
  });

  // ===== Exhaustion Penalty Application =====

  it('should apply exhaustion penalty to hit bonus calculation', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} exhaustionPenalty={3} />);
    });

    // hitBonus (5) - exhaustionPenalty (3) = +2
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  // ===== Combined bonus actions and attacks =====

  it('should render both bonus action attacks and bonus action descriptions together', async () => {
    const stats = createStats({
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
      bonusActions: [
        { name: 'Cunning Action', description: 'You can take a bonus action.', details: 'Dash, Hide, or Disengage.' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Main Gauche')).toBeInTheDocument();
    expect(screen.getByText(/Cunning Action:/)).toBeInTheDocument();
  });

  // ===== Bonus action attacks with save DC =====

  it('should render save DC display for bonus action attacks with saveDc', async () => {
    getInnateSorceryBonus.mockReturnValue({ saveDcBonus: 0 });

    const stats = createStats({
      attacks: [
        {
          name: 'Witch Bolt',
          range: 60,
          saveDc: 13,
          saveType: 'STR',
          damage: '1d12',
          damageType: 'Lightning',
          type: 'Bonus Action',
        },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('DC 13 STR')).toBeInTheDocument();
  });

  // ===== SpellDetailPopup props =====

  it('should pass correct props to SpellDetailPopup', async () => {
    const stats = createStats({
      spellAbilities: {
        spells: [
          { name: 'Shocking Grasp', range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' },
        ],
      },
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const spellLink = screen.getByText('Shocking Grasp');
    await act(async () => {
      fireEvent.click(spellLink);
    });

    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });

  // ===== popupHtml dismissal =====

  it('should dismiss popup when popup overlay is clicked', async () => {
    const stats = createStats({
      bonusActions: [
        { name: 'Dismiss Test', description: 'Test', details: 'Details' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    const actionName = screen.getByText(/Dismiss Test:/);
    await act(async () => {
      fireEvent.click(actionName);
    });

    await waitFor(() => {
      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });

    const popupOverlay = screen.getByTestId('popup-overlay');
    await act(async () => {
      fireEvent.click(popupOverlay);
    });

    expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
  });

  // ===== Empty spellAbilities =====

  it('should handle playerStats with no spellAbilities gracefully', async () => {
    const stats = createStats({
      spellAbilities: undefined,
      attacks: [
        { name: 'Main Gauche', range: 5, hitBonus: 5, damage: '1d4+3', damageType: 'Piercing', type: 'Bonus Action' },
      ],
    });

    await act(async () => {
      render(<CharBonusActions playerStats={stats} />);
    });

    expect(screen.getByText('Main Gauche')).toBeInTheDocument();
  });
});

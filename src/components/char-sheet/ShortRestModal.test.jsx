import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ShortRestModal from './ShortRestModal.jsx';

// ── Mocked modules ──

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, sides) => {
    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    return { total: rolls.reduce((sum, r) => sum + r, 0), rolls };
  }),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(() => 8),
  computeHitDieRecovery: vi.fn((roll, conBonus) => Math.max(1, roll + conBonus)),
  SHORT_REST_RESOURCES: [
    'channelDivinityCharges',
    'wildShapeUses',
    'psionicEnergy',
    'focusPoints',
    'superiorityDice',
    'kiPoints',
    'actionsurgeUses',
    'luckyPoints',
  ],
  getShortRestResourceLabels: vi.fn(() => []),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 0),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => null),
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../services/dice/diceRoller.js';
import * as restRules from '../../services/rules/effects/restRules.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as classFeatures from '../../services/character/classFeatures.js';
import * as automationService from '../../services/combat/automation/automationService.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as applyHealingService from '../../services/rules/combat/applyHealing.js';

// ── Test fixtures ──

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 40,
  class: { name: 'Fighter', hit_point_die: 10 },
  abilities: [
    { name: 'Strength', bonus: 3 },
    { name: 'Dexterity', bonus: 2 },
    { name: 'Constitution', bonus: 1 },
    { name: 'Intelligence', bonus: 0 },
    { name: 'Wisdom', bonus: 1 },
    { name: 'Charisma', bonus: 0 },
  ],
  proficiency: 3,
  automation: { passives: [] },
};

const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    playerStats: basePlayerStats,
    campaignName: mockCampaignName,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('ShortRestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    diceRoller.rollDice.mockReturnValue({ total: 5, rolls: [5] });
    restRules.computeHitDieRecovery.mockImplementation((roll, con) => Math.max(1, roll + con));
    damageUtils.getCombatContext.mockResolvedValue(null);
    applyHealingService.applyHealingToTarget.mockReturnValue(null);
    classFeatures.getClassFeatures.mockReturnValue(null);
    restRules.getShortRestResourceLabels.mockReturnValue([]);
    automationService.evaluateAutoExpression.mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──

  it('renders the modal overlay and heading', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByText('Short Rest')).toBeInTheDocument();
    expect(document.querySelector('.short-rest-overlay')).toBeInTheDocument();
    expect(document.querySelector('.short-rest-modal')).toBeInTheDocument();
  });

  it('renders the bed icon in the heading', () => {
    render(<ShortRestModal {...makeProps()} />);
    const header = document.querySelector('h3');
    const icon = header.querySelector('i');
    expect(icon).toHaveClass('fa-solid');
    expect(icon).toHaveClass('fa-bed');
  });

  it('renders hit dice section with correct die type', () => {
    render(<ShortRestModal {...makeProps()} />);
    // getHitDieSize mock returns 8 by default
    expect(screen.getByText(/d8/)).toBeInTheDocument();
  });

  it('displays correct die type when mocked', () => {
    restRules.getHitDieSize.mockReturnValue(10);
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByText(/d10/)).toBeInTheDocument();
  });

  it('displays remaining hit dice count', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByText(/5 of 5 remaining/)).toBeInTheDocument();
  });

  it('renders "Roll One" button', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Roll One/i })).toBeInTheDocument();
  });

  it('renders "Roll All" button with remaining count', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Roll All \(5\)/i })).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders complete short rest button', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Complete Short Rest/i })).toBeInTheDocument();
  });

  // ── Roll one hit die ──

  it('rolls one hit die and adds to recovered HP', () => {
    diceRoller.rollDice.mockReturnValue({ total: 7, rolls: [7] });
    restRules.computeHitDieRecovery.mockReturnValue(8);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
    expect(screen.getByText('HP Recovered')).toBeInTheDocument();
  });

  it('decrements remaining hit dice after rolling one', () => {
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
    expect(screen.getByText(/4 of 5 remaining/)).toBeInTheDocument();
  });

  it('disables roll buttons when no hit dice remain', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'shortRestHitDice') return 0;
      return null;
    });
    render(<ShortRestModal {...makeProps()} />);
    const rollOneBtn = screen.getByRole('button', { name: /Roll One/i });
    const rollAllBtn = screen.getByRole('button', { name: /Roll All/i });
    expect(rollOneBtn).toBeDisabled();
    expect(rollAllBtn).toBeDisabled();
  });

  it('rolls all hit dice at once', () => {
    diceRoller.rollDice.mockImplementation((count) => {
      const rolls = [];
      for (let i = 0; i < count; i++) rolls.push(5);
      return { total: count * 5, rolls };
    });
    restRules.computeHitDieRecovery.mockReturnValue(6);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll All/i }));
    expect(screen.getByText(/Total HP Recovered:/)).toBeInTheDocument();
    expect(screen.getByText(/0 of 5 remaining/)).toBeInTheDocument();
  });

  it('shows roll log with individual entries after rolling', () => {
    diceRoller.rollDice.mockReturnValue({ total: 6, rolls: [6] });
    restRules.computeHitDieRecovery.mockReturnValue(7);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
    const table = document.querySelector('.short-rest-roll-log table');
    expect(table).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  // ── Song of Rest ──

  it('does not show Song of Rest section when player has no Song of Rest feature', () => {
    classFeatures.getClassFeatures.mockReturnValue(null);
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.queryByText(/Song of Rest/)).not.toBeInTheDocument();
  });

  it('shows Song of Rest section when player has the feature', () => {
    classFeatures.getClassFeatures.mockReturnValue({ songOfRestDie: 6 });
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Apply Song of Rest \(d6\)/i })).toBeInTheDocument();
  });

  it('applies Song of Rest healing when clicked', async () => {
    classFeatures.getClassFeatures.mockReturnValue({ songOfRestDie: 6 });
    restRules.computeHitDieRecovery.mockReturnValue(5);
    diceRoller.rollDice.mockReturnValue({ total: 4, rolls: [4] });
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Song of Rest/i }));
    await waitFor(() => {
      expect(screen.getByText(/Song of Rest/)).toBeInTheDocument();
    });
  });

  it('marks Song of Rest as applied after use', async () => {
    classFeatures.getClassFeatures.mockReturnValue({ songOfRestDie: 6 });
    render(<ShortRestModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: /Apply Song of Rest/i });
    expect(applyBtn).toBeInTheDocument();
    fireEvent.click(applyBtn);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Apply Song of Rest/i })).not.toBeInTheDocument();
    });
  });

  it('does not show Song of Rest button after it has been applied', async () => {
    classFeatures.getClassFeatures.mockReturnValue({ songOfRestDie: 6 });
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Song of Rest/i }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Apply Song of Rest/i })).not.toBeInTheDocument();
    });
  });

  it('adds Song of Rest entry to roll log with indicator', async () => {
    classFeatures.getClassFeatures.mockReturnValue({ songOfRestDie: 6 });
    diceRoller.rollDice.mockReturnValue({ total: 3, rolls: [3] });
    damageUtils.getCombatContext.mockResolvedValue(null);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Song of Rest/i }));
    await waitFor(() => {
      expect(document.querySelector('.short-rest-song-row')).toBeInTheDocument();
    });
  });

  it('Song of Rest uses CON bonus from player stats', async () => {
    classFeatures.getClassFeatures.mockReturnValue({ songOfRestDie: 6 });
    diceRoller.rollDice.mockReturnValue({ total: 4, rolls: [4] });
    damageUtils.getCombatContext.mockResolvedValue(null);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Song of Rest/i }));
    await waitFor(() => {
      expect(screen.getByText(/Song of Rest/)).toBeInTheDocument();
    });
  });

  // ── Sorcerous Restoration ──

  it('does not show Sorcerous Restoration for non-sorcerers', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.queryByText(/Sorcerous Restoration/)).not.toBeInTheDocument();
  });

  it('does not show Sorcerous Restoration when sorcerer lacks the passive', () => {
    render(<ShortRestModal {...makeProps({
      playerStats: {
        ...basePlayerStats,
        class: { name: 'Sorcerer' },
        automation: { passives: [] },
      },
    })} />);
    expect(screen.queryByText(/Sorcerous Restoration/)).not.toBeInTheDocument();
  });

  it('shows Sorcerous Restoration for sorcerer with resource_restoration passive', () => {
    const sorcStats = {
      ...basePlayerStats,
      class: { name: 'Sorcerer' },
      automation: {
        passives: [
          { type: 'resource_restoration', restore_expression: '2d4' },
        ],
      },
    };
    render(<ShortRestModal {...makeProps({ playerStats: sorcStats })} />);
    expect(screen.getByText(/Sorcerous Restoration/)).toBeInTheDocument();
  });

  it('shows restoration requested state after clicking', () => {
    const sorcStats = {
      ...basePlayerStats,
      class: { name: 'Sorcerer' },
      automation: {
        passives: [
          { type: 'resource_restoration', restore_expression: '2d4' },
        ],
      },
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'sorcerousRestorationUses') return 1;
      return null;
    });
    automationService.evaluateAutoExpression.mockReturnValue(4);
    render(<ShortRestModal {...makeProps({ playerStats: sorcStats })} />);
    fireEvent.click(screen.getByRole('button', { name: /Regain.*Sorcery Points/i }));
    expect(screen.getByText(/Restoration requested/)).toBeInTheDocument();
  });

  it('does not show sorcerous restoration section when uses are zero', () => {
    const sorcStats = {
      ...basePlayerStats,
      class: { name: 'Sorcerer' },
      automation: {
        passives: [
          { type: 'resource_restoration', restore_expression: '2d4' },
        ],
      },
    };
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'sorcerousRestorationUses') return 0;
      return null;
    });
    render(<ShortRestModal {...makeProps({ playerStats: sorcStats })} />);
    expect(screen.queryByText(/Sorcerous Restoration/)).not.toBeInTheDocument();
  });

  // ── Font of Inspiration ──

  it('does not show Font of Inspiration for non-bards', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.queryByText(/Font of Inspiration/)).not.toBeInTheDocument();
  });

  it('does not show Font of Inspiration when bard lacks the passive', () => {
    render(<ShortRestModal {...makeProps({
      playerStats: {
        ...basePlayerStats,
        class: { name: 'Bard' },
        automation: { passives: [] },
      },
    })} />);
    expect(screen.queryByText(/Font of Inspiration/)).not.toBeInTheDocument();
  });

  it('shows Font of Inspiration for bard with font_of_inspiration passive', () => {
    render(<ShortRestModal {...makeProps({
      playerStats: {
        ...basePlayerStats,
        class: { name: 'Bard' },
        abilities: basePlayerStats.abilities.map(a =>
          a.name === 'Charisma' ? { ...a, bonus: 3 } : a
        ),
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      },
    })} />);
    expect(screen.getByText(/Font of Inspiration/)).toBeInTheDocument();
  });

  it('shows font of inspiration applied state after clicking', () => {
    render(<ShortRestModal {...makeProps({
      playerStats: {
        ...basePlayerStats,
        class: { name: 'Bard' },
        abilities: basePlayerStats.abilities.map(a =>
          a.name === 'Charisma' ? { ...a, bonus: 3 } : a
        ),
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      },
    })} />);
    fireEvent.click(screen.getByRole('button', { name: /Regain.*Bardic Inspiration Uses/i }));
    expect(screen.getByText(/Font of Inspiration applied/)).toBeInTheDocument();
  });

  it('does not show font of inspiration section when max uses already available', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'bardicInspirationUses') return 3;
      return null;
    });
    render(<ShortRestModal {...makeProps({
      playerStats: {
        ...basePlayerStats,
        class: { name: 'Bard' },
        abilities: basePlayerStats.abilities.map(a =>
          a.name === 'Charisma' ? { ...a, bonus: 3 } : a
        ),
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      },
    })} />);
    expect(screen.queryByText(/Font of Inspiration/)).not.toBeInTheDocument();
  });

  it('uses charisma bonus for bardic inspiration max', () => {
    const charismaBonus = 3;
    render(<ShortRestModal {...makeProps({
      playerStats: {
        ...basePlayerStats,
        class: { name: 'Bard' },
        abilities: basePlayerStats.abilities.map(a =>
          a.name === 'Charisma' ? { ...a, bonus: charismaBonus } : a
        ),
        automation: { passives: [{ type: 'font_of_inspiration' }] },
      },
    })} />);
    expect(screen.getByText(/Regain 3 expended Bardic Inspiration uses/)).toBeInTheDocument();
  });

  // ── Short rest resource labels ──

  it('shows resources restored section when labels exist', () => {
    restRules.getShortRestResourceLabels.mockReturnValue(['Second Wind', 'Action Surge']);
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByText(/Resources Restored/)).toBeInTheDocument();
    expect(screen.getByText(/Second Wind/)).toBeInTheDocument();
    expect(screen.getByText(/Action Surge/)).toBeInTheDocument();
  });

  it('does not show resources restored section when no labels', () => {
    restRules.getShortRestResourceLabels.mockReturnValue([]);
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.queryByText(/Resources Restored/)).not.toBeInTheDocument();
  });

  // ── Complete short rest ──

  it('calls onComplete when complete button is clicked', () => {
    const onComplete = vi.fn();
    render(<ShortRestModal {...makeProps({ onComplete })} />);
    fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('sets shortRestHitDice runtime value on complete', () => {
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'shortRestHitDice',
      5,
      mockCampaignName,
    );
  });

  it('sets current hit points on complete with recovered HP', () => {
    diceRoller.rollDice.mockReturnValue({ total: 5, rolls: [5] });
    restRules.computeHitDieRecovery.mockReturnValue(6);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
    fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      expect.any(Number),
      mockCampaignName,
    );
  });

  it('caps current hit points at max hit points', () => {
    diceRoller.rollDice.mockReturnValue({ total: 10, rolls: [10] });
    restRules.computeHitDieRecovery.mockReturnValue(11);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll All/i }));
    fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      40,
      mockCampaignName,
    );
  });

  it('clears short rest resources on complete', () => {
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    const shortRestKeys = restRules.SHORT_REST_RESOURCES;
    for (const key of shortRestKeys) {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        key,
        null,
        mockCampaignName,
      );
    }
  });

  it('clears expiration effects on complete', () => {
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    expect(expirations.clearAllExpirationEffects).toHaveBeenCalledWith(
      'TestCharacter',
      mockCampaignName,
    );
  });

  it('does not call onComplete when it is not provided', () => {
    render(
      <ShortRestModal
        playerStats={basePlayerStats}
        campaignName={mockCampaignName}
      />,
    );
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    }).not.toThrow();
  });

  // ── Cancel / close ──

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ShortRestModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<ShortRestModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.short-rest-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<ShortRestModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.short-rest-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<ShortRestModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Runtime state persistence ──

  it('loads hit dice from runtime state when available', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'shortRestHitDice') return 3;
      return null;
    });
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByText(/3 of 5 remaining/)).toBeInTheDocument();
  });

  it('stores remaining hit dice on complete', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'shortRestHitDice') return 3;
      return null;
    });
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'shortRestHitDice',
      3,
      mockCampaignName,
    );
  });

  it('uses playerStats.hitPoints when currentHitPoints runtime value is null', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Complete Short Rest/i }));
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestCharacter',
      'currentHitPoints',
      40,
      mockCampaignName,
    );
  });

  // ── HitDie size ──

  it('displays correct hit die size from class', () => {
    restRules.getHitDieSize.mockReturnValue(12);
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.getByText(/d12/)).toBeInTheDocument();
  });

  // ── Roll log formatting ──

  it('shows roll log only after at least one roll', () => {
    render(<ShortRestModal {...makeProps()} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('displays roll and HP recovered columns', () => {
    diceRoller.rollDice.mockReturnValue({ total: 6, rolls: [6] });
    restRules.computeHitDieRecovery.mockReturnValue(7);
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Roll One/i }));
    expect(screen.getByText('Roll')).toBeInTheDocument();
    expect(screen.getByText('HP Recovered')).toBeInTheDocument();
  });

  // ── Sorcerer restoration with combat context ──

  it('shows restore amount from evaluateAutoExpression', () => {
    const sorcStats = {
      ...basePlayerStats,
      class: { name: 'Sorcerer' },
      automation: {
        passives: [
          { type: 'resource_restoration', restore_expression: '2d4' },
        ],
      },
    };
    automationService.evaluateAutoExpression.mockReturnValue(5);
    render(<ShortRestModal {...makeProps({ playerStats: sorcStats })} />);
    expect(screen.getByText(/Regain 5 expended sorcery points/)).toBeInTheDocument();
  });

  // ── Song of Rest with combat context ──

  it('uses combat context for Song of Rest healing when available', async () => {
    classFeatures.getClassFeatures.mockReturnValue({ songOfRestDie: 6 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'TestCharacter', type: 'player' },
      ],
    });
    applyHealingService.applyHealingToTarget.mockReturnValue({ actualHeal: 5 });
    diceRoller.rollDice.mockReturnValue({ total: 4, rolls: [4] });
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Song of Rest/i }));
    await waitFor(() => {
      expect(applyHealingService.applyHealingToTarget).toHaveBeenCalled();
    });
  });

  it('falls back to bonus calculation when no combat context', async () => {
    classFeatures.getClassFeatures.mockReturnValue({ songOfRestDie: 6 });
    damageUtils.getCombatContext.mockResolvedValue(null);
    diceRoller.rollDice.mockReturnValue({ total: 4, rolls: [4] });
    render(<ShortRestModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Song of Rest/i }));
    await waitFor(() => {
      expect(screen.getByText(/Song of Rest/)).toBeInTheDocument();
    });
  });
});

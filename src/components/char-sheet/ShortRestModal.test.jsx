// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  useRuntimeValue: vi.fn(() => null),
  listeners: new Map(),
  getRuntimeValue: vi.fn((...args) => getRuntimeValueMock(...args)),
  setRuntimeValue: vi.fn((...args) => setRuntimeValueMock(...args)),
  setRuntimeBatch: vi.fn((...args) => setRuntimeBatchMock(...args)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  getHitDieSize: vi.fn(() => 8),
  computeHitDieRecovery: vi.fn((roll, conBonus) => roll + conBonus),
  SHORT_REST_RESOURCES: ['spell_slots_level_1', 'spell_slots_level_2'],
  getShortRestResourceLabels: vi.fn(() => ['Spell Slots (1st+)', 'Hit Dice']),
  clearHuntersMarkConcentration: vi.fn(),
  applyShortRest: vi.fn(async () => {}),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
  clearAllExpirationEffects: vi.fn((...args) => clearAllExpirationEffectsMock(...args)),
}));

const clearAllExpirationEffectsMock = vi.fn();

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ songOfRestDie: 6 })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 2),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => null),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpellData: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

const mockCampaignName = 'test-campaign';

function createPlayerStats(overrides = {}) {
  return {
    name: 'Thorin',
    level: 5,
    hitPoints: 45,
    proficiency: 3,
    abilities: [
      { name: 'Constitution', bonus: 2 },
      { name: 'Charisma', bonus: 3 },
      { name: 'Wisdom', bonus: 2 },
    ],
    class: { name: 'Cleric', major: { name: 'Cleric' } },
    automation: { passives: [], actions: [] },
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spells: [{ name: 'Healing Word', prepared: 'Prepared' }],
    },
    inventory: { equipped: [] },
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  const playerStats = createPlayerStats(overrides);
  const onClose = vi.fn();
  const onComplete = vi.fn();
  const rendered = render(
    <ShortRestModal
      playerStats={playerStats}
      campaignName={mockCampaignName}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
  return { ...rendered, onClose, onComplete, playerStats };
}

function setupGetRuntimeValue(returns) {
  getRuntimeValueMock.mockImplementation((_name, key) => {
    if (key in returns) return returns[key];
    return null;
  });
}

describe('ShortRestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
  });

  describe('rendering', () => {
    it('renders the modal title, action buttons, hit dice info, and Song of Rest section', () => {
      renderModal();
      expect(screen.getByText('Short Rest')).toBeInTheDocument();
      expect(screen.getByText('Complete Short Rest')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText(/of 5 remaining/)).toBeInTheDocument();
      expect(screen.getByText('Roll One')).toBeInTheDocument();
      expect(screen.getByText(/Roll All/)).toBeInTheDocument();
      expect(screen.getByText('Song of Rest')).toBeInTheDocument();
      expect(screen.getByText('Resources Restored')).toBeInTheDocument();
    });

    it('does not render Song of Rest section when songOfRestDie is null', async () => {
      const { getClassFeatures } = await import('../../services/character/classFeatures.js');
      vi.mocked(getClassFeatures).mockReturnValueOnce({ songOfRestDie: null });
      renderModal();
      expect(screen.queryByText('Song of Rest')).not.toBeInTheDocument();
    });

    it('does not render Resources Restored section when no resources are available', async () => {
      const { getShortRestResourceLabels } = await import('../../services/rules/effects/restRules.js');
      vi.mocked(getShortRestResourceLabels).mockReturnValueOnce([]);
      renderModal();
      expect(screen.queryByText('Resources Restored')).not.toBeInTheDocument();
    });
  });

  describe('hit dice rolling', () => {
    it('shows roll log and recovered HP after rolling one die', () => {
      renderModal();
      fireEvent.click(screen.getByText('Roll One'));
      expect(screen.getByText('Roll')).toBeInTheDocument();
      expect(screen.getByText('HP Recovered')).toBeInTheDocument();
      expect(screen.getByText('Total HP Recovered:')).toBeInTheDocument();
    });

    it('rolls all remaining hit dice when Roll All is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByText(/Roll All/));
      expect(screen.getByText('Total HP Recovered:')).toBeInTheDocument();
    });

    it('disables dice buttons when no hit dice remain', () => {
      setupGetRuntimeValue({ shortRestHitDice: 0 });
      renderModal();
      expect(screen.getByText('Roll One')).toBeDisabled();
      expect(screen.getByText(/Roll All/)).toBeDisabled();
    });

    it('records correct HP value for a single die roll', () => {
      // rollDice(1, 8) returns 4, conBonus=2, so hp = 4 + 2 = 6
      renderModal();
      fireEvent.click(screen.getByText('Roll One'));
      const rows = document.querySelectorAll('.short-rest-roll-log tbody tr');
      expect(rows.length).toBe(1);
      expect(rows[0].querySelector('td:nth-child(2)').textContent).toBe('6');
    });

    it('accumulates recovered HP from multiple roll log entries', () => {
      renderModal();
      fireEvent.click(screen.getByText('Roll One'));
      fireEvent.click(screen.getByText('Roll One'));
      const totalText = screen.getByText(/Total HP Recovered:/).parentElement.textContent;
      expect(totalText).toContain('12');
    });

    it('shows correct remaining count after rolling dice', () => {
      renderModal();
      fireEvent.click(screen.getByText('Roll One'));
      const hitDiceP = document.querySelector('.short-rest-section p');
      expect(hitDiceP.textContent).toContain('4');
      expect(hitDiceP.textContent).toContain('remaining');
      fireEvent.click(screen.getByText(/Roll All/));
      expect(hitDiceP.textContent).toContain('0');
      expect(hitDiceP.textContent).toContain('remaining');
    });
  });

  describe('Song of Rest', () => {
    it('applies Song of Rest and hides the button and section', async () => {
      renderModal();
      fireEvent.click(screen.getByText(/Apply Song of Rest/));
      await act(async () => {});
      expect(screen.queryByText(/Apply Song of Rest/)).not.toBeInTheDocument();
      expect(screen.queryByText('Song of Rest')).not.toBeInTheDocument();
    });

    it('adds Song of Rest bonus to recovered HP total', async () => {
      renderModal();
      fireEvent.click(screen.getByText('Roll One'));
      await act(async () => {});
      const hpBefore = screen.getByText(/Total HP Recovered:/).parentElement.textContent;
      fireEvent.click(screen.getByText(/Apply Song of Rest/));
      await act(async () => {});
      const hpAfter = screen.getByText(/Total HP Recovered:/).parentElement.textContent;
      const beforeVal = parseInt(hpBefore.match(/\d+/)?.[0] || '0', 10);
      const afterVal = parseInt(hpAfter.match(/\d+/)?.[0] || '0', 10);
      expect(afterVal).toBeGreaterThan(beforeVal);
    });

    it('marks Song of Rest entries with the special class in the roll log', async () => {
      renderModal();
      fireEvent.click(screen.getByText(/Apply Song of Rest/));
      await act(async () => {});
      const songRows = document.querySelectorAll('.short-rest-song-row');
      expect(songRows.length).toBe(1);
    });
  });

  describe('class-specific features', () => {
    describe('Sorcerous Restoration', () => {
      it('renders for Sorcerer with resource_restoration passive', () => {
        renderModal({
          class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
          automation: { passives: [{ type: 'resource_restoration' }] },
        });
        expect(screen.getByText('Sorcerous Restoration')).toBeInTheDocument();
      });

      it('shows applied state after requesting restoration when uses are available', () => {
        setupGetRuntimeValue({ sorcerousRestorationUses: 1 });
        renderModal({
          class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
          automation: { passives: [{ type: 'resource_restoration' }] },
        });
        fireEvent.click(screen.getByText(/Regain.*Sorcery Points/));
        expect(screen.getByText('Restoration requested')).toBeInTheDocument();
      });

      it('does not show button when restoration uses are exhausted', () => {
        setupGetRuntimeValue({ sorcerousRestorationUses: 0 });
        renderModal({
          class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
          automation: { passives: [{ type: 'resource_restoration' }] },
        });
        expect(screen.queryByText(/Regain.*Sorcery Points/)).not.toBeInTheDocument();
      });
    });

    describe('Font of Inspiration', () => {
      it('renders for Bard with font_of_inspiration passive', () => {
        renderModal({
          class: { name: 'Bard', major: { name: 'Bard' } },
          automation: { passives: [{ type: 'font_of_inspiration' }] },
        });
        expect(screen.getByText('Font of Inspiration')).toBeInTheDocument();
      });

      it('shows Font of Inspiration applied when uses are below max', () => {
        setupGetRuntimeValue({ bardicInspirationUses: 0 });
        renderModal({
          class: { name: 'Bard', major: { name: 'Bard' } },
          automation: { passives: [{ type: 'font_of_inspiration' }] },
          abilities: [{ name: 'Charisma', bonus: 3 }],
        });
        expect(screen.getByText(/Font of Inspiration applied on short rest/)).toBeInTheDocument();
      });

      it('does not show Font of Inspiration when uses are at max', () => {
        setupGetRuntimeValue({ bardicInspirationUses: 3 });
        renderModal({
          class: { name: 'Bard', major: { name: 'Bard' } },
          automation: { passives: [{ type: 'font_of_inspiration' }] },
          abilities: [{ name: 'Charisma', bonus: 3 }],
        });
        expect(screen.queryByText(/Font of Inspiration applied/)).not.toBeInTheDocument();
      });
    });

    describe('Arcane Recovery', () => {
      it('renders for Wizard with arcane recovery passive when available', () => {
        setupGetRuntimeValue({ arcaneRecoveryLevels: 2 });
        renderModal({
          class: { name: 'Wizard', major: { name: 'Wizard' } },
          automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
        });
        expect(screen.getByText('Arcane Recovery')).toBeInTheDocument();
      });

      it('does not render when arcane recovery is at zero', () => {
        setupGetRuntimeValue({ arcaneRecoveryLevels: 0 });
        renderModal({
          class: { name: 'Wizard', major: { name: 'Wizard' } },
          automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
        });
        expect(screen.queryByText('Arcane Recovery')).not.toBeInTheDocument();
      });
    });

    describe('Memorize Spell', () => {
      // CLA-226: automationRouter routes memorize_spell into automation.specialActions
      // (automationRouter.js:589 via core-handlers.js memorize_spell builder).
      // Fixtures must mirror real router output — hand-crafted `passives` masked the bug.
      const memorizeRouterOutput = {
        type: 'memorize_spell',
        name: 'Memorize Spell',
        casting_time: 'passive',
        hasAutomation: true,
      };

      it('renders for Wizard when router emits memorize_spell in specialActions', () => {
        renderModal({
          class: { name: 'Wizard', major: { name: 'Wizard' } },
          automation: { specialActions: [memorizeRouterOutput] },
        });
        expect(screen.getByText('Memorize Spell')).toBeInTheDocument();
      });

      it('shows swap button when memorize spell is available', () => {
        renderModal({
          class: { name: 'Wizard', major: { name: 'Wizard' } },
          automation: { specialActions: [memorizeRouterOutput] },
        });
        expect(screen.getByText(/Swap Prepared Spell/)).toBeInTheDocument();
      });

      it('does NOT render from a passives-bucket entry (regression guard for CLA-226 gate bucket)', () => {
        renderModal({
          class: { name: 'Wizard', major: { name: 'Wizard' } },
          automation: { passives: [memorizeRouterOutput] },
        });
        expect(screen.queryByText('Memorize Spell')).not.toBeInTheDocument();
      });
    });

    describe('Bolstering Treats', () => {
      it('renders when temp_hp_buff passive with correct name exists', () => {
        renderModal({
          automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
        });
        expect(screen.getByText('Bolstering Treats')).toBeInTheDocument();
      });

      it('shows applied state after crafting treats', () => {
        renderModal({
          automation: { passives: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
        });
        fireEvent.click(screen.getByText(/Craft Bolstering Treats/));
        expect(screen.getByText('Treats crafted')).toBeInTheDocument();
      });

      it('does not render when the passive is absent', () => {
        renderModal({
          automation: { passives: [] },
        });
        expect(screen.queryByText('Bolstering Treats')).not.toBeInTheDocument();
      });
    });
  });

  describe('Replenishing Meal', () => {
    it('renders Replenishing Meal section when meal count is positive', async () => {
      setupGetRuntimeValue({ replenishingMeals: 2 });
      const { useRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
      vi.mocked(useRuntimeValue).mockReturnValueOnce(2);
      renderModal({
        automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
      });
      expect(screen.getByText('Replenishing Meal')).toBeInTheDocument();
    });

    it('shows consumed state after meal is consumed on roll', async () => {
      setupGetRuntimeValue({ replenishingMeals: 2 });
      const { useRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
      vi.mocked(useRuntimeValue).mockReturnValueOnce(2);
      renderModal({
        automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
      });
      fireEvent.click(screen.getByText('Roll One'));
      await act(async () => {});
      expect(screen.getByText(/Replenishing Meal consumed/)).toBeInTheDocument();
    });
  });

  describe('completion', () => {
    it('calls onComplete when Complete Short Rest is clicked', async () => {
      const { onComplete } = renderModal();
      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('restores sorcery points when Sorcerous Restoration was used', async () => {
      setupGetRuntimeValue({ sorceryPoints: 3, sorcerousRestorationUses: 1 });
      const playerStats = createPlayerStats({
        class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
        automation: { passives: [{ type: 'resource_restoration' }] },
      });
      render(
        <ShortRestModal
          playerStats={playerStats}
          campaignName={mockCampaignName}
          onClose={vi.fn()}
          onComplete={vi.fn()}
        />
      );
      fireEvent.click(screen.getByText(/Regain.*Sorcery Points/));
      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});
      const spCalls = setRuntimeValueMock.mock.calls.filter(
        (call) => call[1] === 'sorceryPoints'
      );
      expect(spCalls.length).toBeGreaterThan(0);
    });

    it('recovers spell slots on short rest completion when Arcane Recovery was used', async () => {
      setupGetRuntimeValue({ arcaneRecoveryLevels: 2, spell_slots_level_1: 2 });
      const playerStats = createPlayerStats({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        automation: { passives: [{ type: 'resource_restoration', resourceKey: 'arcaneRecoveryLevels' }] },
        spellAbilities: {
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spells: [],
        },
      });
      render(
        <ShortRestModal
          playerStats={playerStats}
          campaignName={mockCampaignName}
          onClose={vi.fn()}
          onComplete={vi.fn()}
        />
      );
      fireEvent.click(screen.getByText(/Recover Spell Slots/));
      fireEvent.click(screen.getByText('Complete Short Rest'));
      await act(async () => {});
      const slotCalls = setRuntimeValueMock.mock.calls.filter(
        (call) => typeof call[1] === 'string' && call[1].startsWith('spell_slots_level_')
      );
      expect(slotCalls.length).toBeGreaterThan(0);
    });
  });

  describe('closing', () => {
    it('calls onClose when Cancel is clicked or Escape key is pressed', () => {
      const { onClose } = renderModal();
      // Cancel button
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalledTimes(1);

      // Escape key
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('does not close when the overlay is clicked', () => {
      const { onClose } = renderModal();
      const overlay = document.querySelector('.short-rest-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: /Short Rest/ })).toBeInTheDocument();
    });

    it('does not close when clicking inside the modal content', () => {
      const { onClose } = renderModal();
      const modal = document.querySelector('.short-rest-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('hit dice initialization', () => {
    it('initializes remaining hit dice from runtime state when stored, or defaults to player level', () => {
      setupGetRuntimeValue({ shortRestHitDice: 3 });
      renderModal();
      expect(screen.getByText(/3 of 5 remaining/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders hit die size from player stats when specified', () => {
      renderModal({
        class: { name: 'Fighter', hit_point_die: 'd10', major: { name: 'Fighter' } },
      });
      const hitDiceParagraph = document.querySelector('.short-rest-section p');
      expect(hitDiceParagraph).toBeTruthy();
      expect(hitDiceParagraph.textContent).toContain('remaining');
    });

    it('handles zero constitution bonus correctly', () => {
      const playerStats = createPlayerStats({
        abilities: [{ name: 'Constitution', bonus: 0 }],
      });
      render(
        <ShortRestModal
          playerStats={playerStats}
          campaignName={mockCampaignName}
          onClose={vi.fn()}
          onComplete={vi.fn()}
        />
      );
      fireEvent.click(screen.getByText('Roll One'));
      const rows = document.querySelectorAll('.short-rest-roll-log tbody tr');
      // rollDice(1,8) returns 4, conBonus=0, so hp = 4
      expect(rows[0].querySelector('td:nth-child(2)').textContent).toBe('4');
    });
  });
});

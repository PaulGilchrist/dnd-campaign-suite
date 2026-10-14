import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';

// Mock executeHandler
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

// Mock automation service
vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!(action?.automation)),
  isInteractiveAutomation: vi.fn((action) => {
    if (!action?.automation) return false;
    const auto = Array.isArray(action.automation) ? action.automation[0] : action.automation;
    const interactiveTypes = ['teleport', 'signature_spells', 'spell_mastery', 'combat_superiority', 'weapon_kind_mastery', 'weapon_mastery_choice', 'defensive_tactics', 'hunter_prey'];
    if (auto.type === 'passive_rule') {
      const interactiveEffects = ['abjuration_savant', 'divination_savant', 'evocation_savant', 'illusion_savant'];
      return interactiveEffects.includes(auto.effect);
    }
    return interactiveTypes.includes(auto.type);
  }),
}));

// Mock TeleportModal
vi.mock('./modals/TeleportModal.jsx', () => ({
  default: ({ action, onClose }) => (
    <div data-testid="teleport-modal">
      <span>{action?.name || 'Teleport'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SignatureSpellsModal
vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({
  default: ({ payload: _payload, onConfirm, onClose }) => (
    <div data-testid="signature-spells-modal" role="presentation" onClick={onClose}>
      <h3>Signature Spells</h3>
      <button onClick={() => onConfirm('Fireball', 'Haste')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SpellMasteryModal
vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({
  default: ({ payload: _payload, onConfirm, onClose }) => (
    <div data-testid="spell-mastery-modal" role="presentation" onClick={onClose}>
      <h3>Spell Mastery</h3>
      <button onClick={() => onConfirm('Mage Armor', 'Shield')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SavantModal
vi.mock('./modals/arcane/SavantModal.jsx', () => ({
  default: ({ payload, onConfirm, onClose }) => (
    <div data-testid={`${payload?.school?.toLowerCase() || 'savant'}-savant-modal`} role="presentation" onClick={onClose}>
      <span>{payload?.school || 'Savant'} Savant</span>
      <button onClick={() => onConfirm(payload?.spellOptions?.[0] || 'Shield', payload?.spellOptions?.[1] || 'Mage Armor')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock WeaponKindMasteryModal
vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({
  default: ({ action, onClose }) => (
    <div data-testid="weapon-kind-mastery-modal">
      <span>{action?.name || 'Weapon Kind Mastery'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock WeaponMasteryChoiceModal
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({
  default: ({ action: _action, onClose, onConfirm }) => (
    <div data-testid="weapon-mastery-choice-modal">
      <span>Weapon Mastery Choice</span>
      <button onClick={onClose}>Close</button>
      <button onClick={() => onConfirm && onConfirm('Finesse')}>Confirm</button>
    </div>
  ),
}));

// Mock CombatSuperiorityModal
vi.mock('./modals/CombatSuperiorityModal.jsx', () => ({
  default: ({ _payload, onConfirm, _onReopenSelection, _onClose }) => (
    <div data-testid="combat-superiority-modal">
      <span>Combat Superiority</span>
      <button onClick={() => onConfirm([], null)}>Close</button>
    </div>
  ),
}));

// Mock renderMarkdownInline
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

// Mock fighting styles
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([
    { name: 'Great Weapon Fighting', description: 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.' },
    { name: 'Protection', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.' },
  ])),
}));

// Mock the handler functions called by modal confirm callbacks
vi.mock('../../services/automation/handlers/class-wizard/signatureSpellsHandler.js', () => ({
  onSignatureSpellsSelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-wizard/spellMasteryHandler.js', () => ({
  onSpellMasterySelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-wizard/SavantHandler.js', () => ({
  onSavantSelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-ranger/defensiveTacticsHandler.js', () => ({
  applyChoice: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-ranger/hunterPreyHandler.js', () => ({
  applyChoice: vi.fn(),
}));

// Mock runtime state - use mock implementations that can be configured per-test
const mockRuntimeStore = {
  _Defensive_Tactics_choice: null,
  _Hunter_Prey_choice: null,
  aspectOfTheWildsUsedThisRest: false,
};

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, runtimeKey) => {
    return mockRuntimeStore[runtimeKey] ?? null;
  }),
  setRuntimeValue: vi.fn((key, runtimeKey, value, _campaign) => {
    mockRuntimeStore[runtimeKey] = value;
    return Promise.resolve();
  }),
  useRuntimeValue: vi.fn((_key, runtimeKey) => {
    return mockRuntimeStore[runtimeKey] ?? null;
  }),
}));

// Mock DiceRollContext
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

// Mock useCombatSuperiorityModal
vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
}));

// Mock useLoggedDiceRoll
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

// Mock log service
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Mock normalizeAutoDamage / resolveAttackDamageStandalone
vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: {}, ctx: {} })),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

// Mock destructiveStrideHandler
vi.mock('../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
  applyTargetChoice: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Destructive Stride', description: 'Struck target.' } })),
}));

// Mock tempHpService
vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(() => Promise.resolve()),
}));

// Mock tempTeleportHandler
vi.mock('../../services/automation/handlers/class-warlock/tempTeleportHandler.js', () => ({
  confirmTeleport: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Moonlight Step', description: 'Teleported.' } })),
}));

// Mock tempHpBuffHandler
vi.mock('../../services/automation/handlers/buffs/tempHpBuffHandler.js', () => ({
  confirmBolsteringPerformance: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Bolstering Performance', description: 'Allies inspired.' } })),
}));

// Mock encouragingSongHandler
vi.mock('../../services/automation/handlers/buffs/encouragingSongHandler.js', () => ({
  confirmEncouragingSong: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Encouraging Song', description: 'Allies inspired.' } })),
  skipEncouragingSong: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Encouraging Song', description: 'Skipped.' } })),
}));

// Mock boonOfEnergyResistanceHandler
vi.mock('../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js', () => ({
  applyTypeChoice: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Boon of Energy', description: 'Resistances chosen.' } })),
}));

// Mock Porter handler
vi.mock('../../services/automation/handlers/class-wizard/portentHandler.js', () => ({
  applyPortentChoice: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Portent', description: 'Die applied.' } })),
}));

// Mock getCombatContext
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

// Import mocked modules for use with vi.mocked()
import { applyChoice } from '../../services/automation/handlers/class-ranger/defensiveTacticsHandler.js';
import { applyChoice as applyHunterPreyChoice } from '../../services/automation/handlers/class-ranger/hunterPreyHandler.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const basePlayerStats = {
  name: 'TestCharacter',
  specialActions: [],
  class: {
    fightingStyles: [],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 2,
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharSpecialActions - Feature Choice Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeStore._Defensive_Tactics_choice = null;
    mockRuntimeStore._Hunter_Prey_choice = null;
    mockRuntimeStore.aspectOfTheWildsUsedThisRest = false;
  });

  describe('defensive_tactics automation type', () => {
    it('opens feature choice modal with correct options when no choice has been made', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Defensive Tactics', description: 'Choose a defensive option.', automation: { type: 'defensive_tactics' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Defensive Tactics/));

      await waitFor(() => {
        expect(screen.getByText(/Choose your option/)).toBeInTheDocument();
        expect(screen.getByText('Escape the Horde')).toBeInTheDocument();
        expect(screen.getByText('Multiattack Defense')).toBeInTheDocument();
      });
    });

    it('does not open feature choice modal when defensive tactics choice already exists', async () => {
      mockRuntimeStore._Defensive_Tactics_choice = 'Escape the Horde';

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Defensive Tactics', description: 'Choose a defensive option.', automation: { type: 'defensive_tactics' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Defensive Tactics/));

      await waitFor(() => {
        expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
      });
    });

    it('shows popup result from handler on confirm', async () => {
      let capturedPopup = null;
      const mockSetPopupHtml = (html) => { capturedPopup = html; };
      vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      vi.mocked(applyChoice).mockResolvedValue({ type: 'popup', payload: '<b>Defensive Tactics</b><br/>Escape the Horde chosen.' });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Defensive Tactics', description: 'Choose a defensive option.', automation: { type: 'defensive_tactics' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Defensive Tactics/));

      await waitFor(() => {
        expect(screen.getByText('Escape the Horde')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Escape the Horde'));

      await waitFor(() => {
        expect(capturedPopup).toBe('<b>Defensive Tactics</b><br/>Escape the Horde chosen.');
      });
    });

    it('closes modal when cannotAct is true', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Defensive Tactics', description: 'Choose a defensive option.', automation: { type: 'defensive_tactics' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={true} />);

      fireEvent.click(screen.getByText(/Defensive Tactics/));

      await waitFor(() => {
        expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
      });
    });
  });

  describe('hunter_prey automation type', () => {
    it('opens feature choice modal with correct options', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Hunter Prey', description: 'Choose your prey tactic.', automation: { type: 'hunter_prey' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Hunter Prey/));

      await waitFor(() => {
        expect(screen.getByText('Colossus Slayer')).toBeInTheDocument();
        expect(screen.getByText('Horde Breaker')).toBeInTheDocument();
      });
    });

    it('does not open feature choice modal when hunter prey choice already exists', async () => {
      mockRuntimeStore._Hunter_Prey_choice = 'Colossus Slayer';

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Hunter Prey', description: 'Choose your prey tactic.', automation: { type: 'hunter_prey' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Hunter Prey/));

      await waitFor(() => {
        expect(screen.queryByText(/Choose your option/)).not.toBeInTheDocument();
      });
    });

    it('shows popup result from handler on confirm', async () => {
      let capturedPopup = null;
      const mockSetPopupHtml = (html) => { capturedPopup = html; };
      vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      vi.mocked(applyHunterPreyChoice).mockResolvedValue({ type: 'popup', payload: '<b>Hunter Prey</b><br/>Colossus Slayer chosen.' });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Hunter Prey', description: 'Choose your prey tactic.', automation: { type: 'hunter_prey' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Hunter Prey/));

      await waitFor(() => {
        expect(screen.getByText('Colossus Slayer')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Colossus Slayer'));

      await waitFor(() => {
        expect(capturedPopup).toBe('<b>Hunter Prey</b><br/>Colossus Slayer chosen.');
      });
    });
  });

  describe('damage_bonus with string options', () => {
    it('opens feature choice modal with automation options', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Damage Boost', description: 'Choose a damage bonus.', automation: { type: 'damage_bonus', options: ['Strength', 'Dexterity'] } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Damage Boost/));

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
        expect(screen.getByText('Dexterity')).toBeInTheDocument();
      });
    });

    it('stores choice in runtime on confirm', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Damage Boost', description: 'Choose a damage bonus.', automation: { type: 'damage_bonus', options: ['Strength', 'Dexterity'] } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Damage Boost/));

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Strength'));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestCharacter',
          '_Damage_Boost_option',
          'Strength',
          'test'
        );
      });
    });

    it('logs the damage_bonus choice via addEntry', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Damage Boost', description: 'Choose a damage bonus.', automation: { type: 'damage_bonus', options: ['Strength', 'Dexterity'] } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Damage Boost/));

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Strength'));

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCharacter',
          abilityName: 'Damage Boost',
          description: expect.stringContaining('Chose option: Strength'),
        }));
      });
    });

    it('shows popup with generic change message for damage_bonus', async () => {
      let capturedPopup = null;
      const mockSetPopupHtml = (html) => { capturedPopup = html; };
      vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml: mockSetPopupHtml });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Damage Boost', description: 'Choose a damage bonus.', automation: { type: 'damage_bonus', options: ['Strength', 'Dexterity'] } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Damage Boost/));

      await waitFor(() => {
        expect(screen.getByText('Strength')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Strength'));

      await waitFor(() => {
        expect(capturedPopup).toContain('Strength');
        expect(capturedPopup).toContain('This choice can be changed by clicking the feature again.');
        expect(capturedPopup).not.toContain('Short Rest');
      });
    });

  });

  describe('CLA-116 Elemental Fury regression', () => {
    const elementalFuryAction = {
      name: 'Elemental Fury',
      description: 'The might of the elements flows through you.',
      automation: {
        type: 'damage_bonus',
        trigger: 'weapon_or_beast_form_attack_hit',
        damageExpression: '1d8',
        damageType: 'Cold Fire Lightning or Thunder',
        oncePerTurn: true,
        options: ['Potent Spellcasting', 'Primal Strike'],
        casting_time: 'passive',
      },
    };

    it('opens feature choice modal with Potent Spellcasting and Primal Strike options', async () => {
      const playerStats = createPlayerStats({
        specialActions: [elementalFuryAction],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Elemental Fury/));

      await waitFor(() => {
        expect(screen.getByText('Potent Spellcasting')).toBeInTheDocument();
        expect(screen.getByText('Primal Strike')).toBeInTheDocument();
      });
    });

    it('stores choice under _Elemental_Fury_option runtime key', async () => {
      const playerStats = createPlayerStats({
        specialActions: [elementalFuryAction],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Elemental Fury/));

      await waitFor(() => {
        expect(screen.getByText('Primal Strike')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Primal Strike'));

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestCharacter',
          '_Elemental_Fury_option',
          'Primal Strike',
          'test'
        );
      });
    });

    it('logs the Elemental Fury choice to the campaign log', async () => {
      const playerStats = createPlayerStats({
        specialActions: [elementalFuryAction],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Elemental Fury/));

      await waitFor(() => {
        expect(screen.getByText('Potent Spellcasting')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Potent Spellcasting'));

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCharacter',
          abilityName: 'Elemental Fury',
          description: expect.stringContaining('Chose option: Potent Spellcasting'),
        }));
      });
    });
  });

});

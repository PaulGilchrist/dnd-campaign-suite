// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';

// Mock executeHandler
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
  applyWeaponKindMastery: vi.fn(),
  applyWeaponMasteryChoice: vi.fn(),
}));

// Mock automation service
vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!(action?.automation)),
  isInteractiveAutomation: vi.fn((action) => {
    if (!action?.automation) return false;
    const auto = Array.isArray(action.automation) ? action.automation[0] : action.automation;
    const interactiveTypes = ['teleport', 'signature_spells', 'spell_mastery', 'combat_superiority', 'weapon_kind_mastery', 'weapon_mastery_choice'];
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
  default: ({ action, _playerStats, _campaignName, meleeOnly, onClose, existing }) => (
    <div data-testid="weapon-kind-mastery-modal">
      <span>{action?.name || 'Weapon Kind Mastery'}</span>
      <span>meleeOnly: {String(meleeOnly)}</span>
      <span>existing: {JSON.stringify(existing)}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock WeaponMasteryChoiceModal
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({
  default: ({ action: _action, _playerStats, _campaignName, masteryProperties, onClose, onConfirm }) => (
    <div data-testid="weapon-mastery-choice-modal">
      <span>Weapon Mastery Choice</span>
      <span>masteryProperties: {masteryProperties?.join(', ')}</span>
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
vi.mock('../../services/character/fightingStyles.js', () => ({
  getFightingStyle: vi.fn((name) => {
    if (name === 'Great Weapon Fighting') {
      return { name: 'Great Weapon Fighting', description: 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.' };
    }
    if (name === 'Protection') {
      return { name: 'Protection', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.' };
    }
    return null;
  }),
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

import { executeHandler } from '../../services/automation/index.js';
import { onSavantSelected } from '../../services/automation/handlers/class-wizard/SavantHandler.js';

const basePlayerStats = {
  specialActions: [],
  class: {
    fightingStyles: [],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharSpecialActions - Weapon Mastery Modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('weaponKindMastery modal', () => {
    it('renders WeaponKindMasteryModal when automation returns it', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'weaponKindMastery',
        payload: {
          action: { name: 'Weapon Mastery', automation: { type: 'weapon_kind_mastery' } },
          meleeOnly: true,
          existing: ['Longsword'],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Weapon Mastery', description: 'Choose weapon kinds.', automation: { type: 'weapon_kind_mastery' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });
      fireEvent.click(screen.getByText(/Weapon Mastery/));

      await waitFor(() => {
        expect(screen.getByTestId('weapon-kind-mastery-modal')).toBeInTheDocument();
      });
    });

    it('closes WeaponKindMasteryModal when close button is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'weaponKindMastery',
        payload: {
          action: { name: 'Weapon Mastery' },
          meleeOnly: false,
          existing: [],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Weapon Mastery', description: 'Choose weapon kinds.', automation: { type: 'weapon_kind_mastery' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });
      fireEvent.click(screen.getByText(/Weapon Mastery/));

      await waitFor(() => {
        expect(screen.getByTestId('weapon-kind-mastery-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('weapon-kind-mastery-modal')).not.toBeInTheDocument();
      });
    });

    it('passes correct props to WeaponKindMasteryModal', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'weaponKindMastery',
        payload: {
          action: { name: 'Weapon Mastery', automation: { type: 'weapon_kind_mastery', maxKinds: 3 } },
          meleeOnly: true,
          existing: ['Greatsword'],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Weapon Mastery', description: 'Choose weapon kinds.', automation: { type: 'weapon_kind_mastery' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });
      fireEvent.click(screen.getByText(/Weapon Mastery/));

      await waitFor(() => {
        expect(screen.getByTestId('weapon-kind-mastery-modal')).toBeInTheDocument();
      });

      expect(screen.getByText('meleeOnly: true')).toBeInTheDocument();
      expect(screen.getByText('existing: ["Greatsword"]')).toBeInTheDocument();
    });
  });

  describe('weaponMasteryChoice modal', () => {
    it('renders WeaponMasteryChoiceModal when automation returns it', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'weaponMasteryChoice',
        payload: {
          action: { name: 'Weapon Master', automation: { type: 'weapon_mastery_choice' } },
          masteryProperties: ['Finesse', 'Heavy', 'Reach'],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Weapon Master', description: 'Choose mastery.', automation: { type: 'weapon_mastery_choice' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });
      fireEvent.click(screen.getByText(/Weapon Master/));

      await waitFor(() => {
        expect(screen.getByTestId('weapon-mastery-choice-modal')).toBeInTheDocument();
      });
    });

    it('closes WeaponMasteryChoiceModal when close button is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'weaponMasteryChoice',
        payload: {
          action: { name: 'Weapon Master' },
          masteryProperties: ['Finesse', 'Heavy'],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Weapon Master', description: 'Choose mastery.', automation: { type: 'weapon_mastery_choice' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });
      fireEvent.click(screen.getByText(/Weapon Master/));

      await waitFor(() => {
        expect(screen.getByTestId('weapon-mastery-choice-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('weapon-mastery-choice-modal')).not.toBeInTheDocument();
      });
    });

    it('passes masteryProperties to WeaponMasteryChoiceModal', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'weaponMasteryChoice',
        payload: {
          action: { name: 'Weapon Master' },
          masteryProperties: ['Finesse', 'Heavy', 'Reach', 'Thrown'],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Weapon Master', description: 'Choose mastery.', automation: { type: 'weapon_mastery_choice' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });
      fireEvent.click(screen.getByText(/Weapon Master/));

      await waitFor(() => {
        expect(screen.getByTestId('weapon-mastery-choice-modal')).toBeInTheDocument();
      });

      expect(screen.getByText('masteryProperties: Finesse, Heavy, Reach, Thrown')).toBeInTheDocument();
    });

    it('closes WeaponMasteryChoiceModal when confirm button is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'weaponMasteryChoice',
        payload: {
          action: { name: 'Weapon Master' },
          masteryProperties: ['Finesse', 'Heavy'],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Weapon Master', description: 'Choose mastery.', automation: { type: 'weapon_mastery_choice' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, {
        wrapper: ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: vi.fn() }}>
            {children}
          </DiceRollContext.Provider>
        ),
      });
      fireEvent.click(screen.getByText(/Weapon Master/));

      await waitFor(() => {
        expect(screen.getByTestId('weapon-mastery-choice-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.queryByTestId('weapon-mastery-choice-modal')).not.toBeInTheDocument();
      });
    });
  });
});

describe('CharSpecialActions - Savant Confirm Popup Path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Savant confirm handler popup result', () => {
    it('displays popup when onSavantSelected returns a popup result', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'evocationSavant',
        payload: {
          action: { name: 'Evocation Savant', automation: { type: 'passive_rule', effect: 'evocation_savant' } },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Evocation',
          spellOptions: ['Fireball', 'Scorching Burst'],
        },
      });

      onSavantSelected.mockResolvedValue({
        type: 'popup',
        payload: { name: 'Evocation Savant', description: 'Added two spells to your spellbook.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Evocation Savant', description: 'Choose two evocation spells.', automation: { type: 'passive_rule', effect: 'evocation_savant' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, { wrapper });

      fireEvent.click(screen.getByText(/Evocation Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('evocation-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Evocation Savant');
      expect(popupCall).toContain('Added two spells to your spellbook.');
    });

    it('uses school name as fallback when popup payload has no name', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'abjurationSavant',
        payload: {
          action: { name: 'Abjuration Savant' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Abjuration',
          spellOptions: ['Shield', 'Mage Armor'],
        },
      });

      onSavantSelected.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Spells added to spellbook.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Abjuration Savant', description: 'Choose two abjuration spells.', automation: { type: 'passive_rule', effect: 'abjuration_savant' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, { wrapper });

      fireEvent.click(screen.getByText(/Abjuration Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('abjuration-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Abjuration Savant');
      expect(popupCall).toContain('Spells added to spellbook.');
    });

    it('handles string payload in savant confirm popup', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'divinationSavant',
        payload: {
          action: { name: 'Divination Savant' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Divination',
          spellOptions: ['Detect Magic', 'Identify'],
        },
      });

      onSavantSelected.mockResolvedValue({
        type: 'popup',
        payload: '<b>Custom HTML popup</b>',
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Divination Savant', description: 'Choose two divination spells.', automation: { type: 'passive_rule', effect: 'divination_savant' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, { wrapper });

      fireEvent.click(screen.getByText(/Divination Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('divination-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith('<b>Custom HTML popup</b>');
      });
    });

    it('uses savantModal.school as fallback when popup payload has no name', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'illusionSavant',
        payload: {
          action: { name: 'Illusion Savant' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Illusion',
          spellOptions: ['Minor Illusion', 'Disguise Self'],
        },
      });

      onSavantSelected.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Illusion spells added.' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Illusion Savant', description: 'Choose two illusion spells.', automation: { type: 'passive_rule', effect: 'illusion_savant' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, { wrapper });

      fireEvent.click(screen.getByText(/Illusion Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('illusion-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupCall = mockSetPopupHtml.mock.calls[0][0];
      expect(popupCall).toContain('Illusion Savant');
      expect(popupCall).toContain('Illusion spells added.');
    });

    it('clears savant modal state after confirm regardless of result type', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'evocationSavant',
        payload: {
          action: { name: 'Evocation Savant' },
          playerStats: basePlayerStats,
          campaignName: 'test',
          school: 'Evocation',
          spellOptions: ['Fireball', 'Scorching Burst'],
        },
      });

      onSavantSelected.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Evocation Savant', description: 'Choose two evocation spells.', automation: { type: 'passive_rule', effect: 'evocation_savant' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />, { wrapper });

      fireEvent.click(screen.getByText(/Evocation Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('evocation-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(screen.queryByTestId('evocation-savant-modal')).not.toBeInTheDocument();
      });
    });
  });
});

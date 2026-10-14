import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';

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

describe('CharSpecialActions - Arcane modal onClose handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe('SignatureSpellsModal', () => {
    it('calls onSignatureSpellsSelected when onConfirm is triggered then closes', async () => {
      const { onSignatureSpellsSelected } = await import('../../services/automation/handlers/class-wizard/signatureSpellsHandler.js');

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { action: { name: 'Signature Spells' }, playerStats: basePlayerStats, campaignName: 'test' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Signature Spells', description: 'Choose spells.', automation: { type: 'signature_spells' } },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Signature Spells/));

      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSignatureSpellsSelected).toHaveBeenCalledOnce();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('SpellMasteryModal', () => {
    it('calls onSpellMasterySelected when onConfirm is triggered then closes', async () => {
      const { onSpellMasterySelected } = await import('../../services/automation/handlers/class-wizard/spellMasteryHandler.js');

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { action: { name: 'Spell Mastery' }, playerStats: basePlayerStats, campaignName: 'test' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Spell Mastery', description: 'Choose spells.', automation: { type: 'spell_mastery' } },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Spell Mastery/));

      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSpellMasterySelected).toHaveBeenCalledOnce();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('SavantModal (Evocation Savant)', () => {
    it('calls onSavantSelected when onConfirm is triggered then closes', async () => {
      const { onSavantSelected } = await import('../../services/automation/handlers/class-wizard/SavantHandler.js');

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'EvocationSavant',
        payload: { action: { name: 'Evocation Savant' }, playerStats: basePlayerStats, campaignName: 'test', school: 'Evocation' },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Evocation Savant', description: 'Choose spells.', automation: { type: 'passive_rule', effect: 'evocation_savant' } },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Evocation Savant/));

      await waitFor(() => {
        expect(screen.getByTestId('evocation-savant-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onSavantSelected).toHaveBeenCalledOnce();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('evocation-savant-modal')).not.toBeInTheDocument();
      });
    });
  });
});

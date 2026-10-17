// @maintained-by-ai
// modalOnClose quartet seam map (#76-79):
//   arcane (this file)  — Signature Spells / Spell Mastery / Savant: Close-dismiss (no selection)
//                         and confirm -> selection handler -> close, for the two wizard spell-choice
//                         modals whose confirm paths live nowhere else.
//   combat              — CharSpecialActions.modalOnClose.combat.test.jsx (quivering palm, fey taunt,
//                         hurl through hell, clairvoyant combatant close rows + cannotAct guard)
//   elemental           — CharSpecialActions.modalOnClose.elemental.test.jsx (affinity, wild magic,
//                         stride, destructive stride close rows + reopen-after-close ordering)
//   weapons             — CharSpecialActions.modalOnClose.weapons.test.jsx (mastery reopen rows)
// Not duplicated here:
//   Signature Spells confirm path (handler args + popup HTML + close) lives in
//   CharSpecialActions.signatureSpellsPopup.test.jsx — the strongest version of that test.
//   Modal open/render routing for all three lives in CharSpecialActions.modals.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';
import { onSpellMasterySelected } from '../../services/automation/handlers/class-wizard/spellMasteryHandler.js';
import { onSavantSelected } from '../../services/automation/handlers/class-wizard/SavantHandler.js';

const arcaneModalTests = [
  {
    name: 'Signature Spells',
    modalName: 'signatureSpells',
    automation: { type: 'signature_spells' },
    testId: 'signature-spells-modal',
    handler: onSignatureSpellsSelected,
    // confirm path (handler args + popup) covered by signatureSpellsPopup.test.jsx
  },
  {
    name: 'Spell Mastery',
    modalName: 'spellMastery',
    automation: { type: 'spell_mastery' },
    testId: 'spell-mastery-modal',
    handler: onSpellMasterySelected,
    // mock modal's Confirm emits onConfirm('Mage Armor', 'Shield')
    confirmArgs: [
      expect.objectContaining({ name: 'Spell Mastery' }),
      expect.any(Object),
      'test',
      'Mage Armor',
      'Shield',
    ],
  },
  {
    name: 'Evocation Savant',
    modalName: 'EvocationSavant',
    automation: { type: 'passive_rule', effect: 'evocation_savant' },
    testId: 'evocation-savant-modal',
    handler: onSavantSelected,
    extraPayload: { school: 'Evocation', spellOptions: ['Shocking Burst', 'Flaming Burst'] },
    // savant handler takes a single object, unlike the positional mastery handler
    confirmArgs: [
      expect.objectContaining({
        action: expect.objectContaining({ name: 'Evocation Savant' }),
        campaignName: 'test',
        school: 'Evocation',
        spell1: 'Shocking Burst',
        spell2: 'Flaming Burst',
      }),
    ],
  },
];

function renderWithArcaneModal({ name, automation, modalName, extraPayload }) {
  executeHandler.mockResolvedValue({
    type: 'modal',
    modalName,
    payload: {
      action: { name },
      playerStats: { name: 'TestCharacter', specialActions: [] },
      campaignName: 'test',
      ...extraPayload,
    },
  });

  const playerStats = {
    name: 'TestCharacter',
    specialActions: [{ name, description: 'Choose spells.', automation }],
    class: { fightingStyles: [] },
    actions: [],
    bonusActions: [],
    reactions: [],
    characterAdvancement: [],
    proficiency: 2,
  };

  render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
  fireEvent.click(screen.getAllByText(new RegExp(name))[0]);
}

describe('CharSpecialActions - Arcane modal onClose handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe.each(arcaneModalTests)('$name modal onClose', ({ name, automation, modalName, testId, handler, extraPayload }) => {
    it('closes the modal without invoking the selection handler when Close is clicked', async () => {
      renderWithArcaneModal({ name, automation, modalName, extraPayload });

      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe.each(arcaneModalTests.filter(t => t.confirmArgs))('$name modal confirm', ({ name, automation, modalName, testId, handler, confirmArgs, extraPayload }) => {
    it('calls the selection handler with the chosen spells and closes the modal', async () => {
      renderWithArcaneModal({ name, automation, modalName, extraPayload });

      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
      expect(handler).toHaveBeenCalledWith(...confirmArgs);

      await waitFor(() => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });
    });
  });
});

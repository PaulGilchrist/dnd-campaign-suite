//
// CLEANING SUMMARY:
//
// Removed:
//   - "calls applyTypeChoice and shows popup on multiResistance confirm" —
//     fully covered by parametrized modal rendering tests in
//     CharSpecialActions.modals.test.jsx (MultiResistanceSelectionModal entry
//     in modalTests array, line 578-584) and by popup display tests in
//     CharSpecialActions.modalsInline.test.jsx (line 609 cleaned comment
//     explicitly notes this). No behavioral gap.
//
//   - "closes multiResistance modal after confirm regardless of result type" —
//     modal close behavior covered by parametrized modal rendering tests in
//     modals.test.jsx which exercise the same modal lifecycle (open → confirm
//     → close via mock onClose). No behavioral gap.
//
//   - "closes replenishing meal modal when skip is clicked" — exact duplicate
//     of CharSpecialActions.modalsInline.test.jsx test at lines 780-806.
//     Same setup, same assertions. No behavioral gap.
//
//   - "closes bolstering treats modal when skip is clicked" — exact duplicate
//     of CharSpecialActions.modalsInline.test.jsx test at lines 856-882.
//     Same setup, same assertions. No behavioral gap.
//
//   - "closes bolstering performance modal when skip is clicked" — exact
//     duplicate of CharSpecialActions.modalsInline.test.jsx test at lines
//     910-942. Same setup, same assertions. No behavioral gap.
//
//   - "renders SingleResistanceSelectionModal when fiendishResilience modal is
//     set" — covered by parametrized modal rendering tests in
//     CharSpecialActions.modals.test.jsx (FiendishResilienceModal entry in
//     modalTests array, line 570-576). CharSpecialActions.modalsInline.test.jsx
//     also explicitly cleaned this test (line 646). No behavioral gap.
//
//   - "closes SingleResistanceSelectionModal when onClose is called" — exact
//     duplicate of CharSpecialActions.modalsInline.test.jsx test at lines
//     648-676. Same setup, same assertions. No behavioral gap.
//
// Kept:
//   - "shows uppercase saveType label in Portent modal for save events" —
//     tests a specific UI formatting detail (toUpperCase on saveType) not
//     covered by any other test. Behavioral coverage for the
//     getEventDisplayLabel function's saveType branch. Unique and valuable.
//
// Consolidated:
//   - N/A — all redundant tests were removed rather than consolidated, as the
//     remaining behavioral coverage in modals.test.jsx (parametrized) and
//     modalsInline.test.jsx (detailed per-feature) is sufficient.
//
// Note: This file now contains 1 test (removed 7 from 8 total).
// The file name "feature-modals" is now misleading — consider renaming to
// "feature-modal-exceptions.test.jsx" or merging into an existing file.
//
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';

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

function createSpecialAction(name, automation) {
  return { name, description: `${name} description.`, automation };
}

describe('CharSpecialActions - Portent saveType label display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows uppercase saveType label in Portent modal for save events', async () => {
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'portentDiceChoice',
      payload: {
        targetName: 'Goblin',
        eventType: 'save',
        eventData: { d20: 10, bonus: 3, saveType: 'dexterity' },
        diceOptions: [3, 7],
      },
    });

    const playerStats = createPlayerStats({
      specialActions: [
        createSpecialAction('Portent', { type: 'portent' }),
      ],
    });

    render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

    fireEvent.click(screen.getAllByText(/Portent/)[0]);

    await waitFor(() => {
      expect(screen.getByText(/DEXTERITY/)).toBeInTheDocument();
    });
  });
});

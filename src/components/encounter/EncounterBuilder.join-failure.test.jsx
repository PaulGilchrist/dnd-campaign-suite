// @maintained-by-ai
// Regression: bug-eb-join-empty-combatsummary-silent-fail — handleJoinEncounter
// pre-wrote the `encounter/joined` campaign-log row BEFORE awaiting
// addMonstersToInitiative and had no try/catch, so a rejected join died as an
// unhandled promise rejection with zero GM feedback while the durable log
// claimed a join the board never received. Fix: await the join FIRST; on
// failure log nothing, show the error toast, keep the draft; only on success
// write the `joined` row and navigate. Mock setup mirrors sibling
// EncounterBuilder.additional-interactions.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import { addMonstersToInitiative } from '../../services/encounters/encounterToInitiative.js';
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', async () => {
  const React = await import('react');
  return {
    default: vi.fn(() => {
      const [modalOpen, setModalOpen] = React.useState(false);
      const [modalMode, setModalMode] = React.useState('save');
      return {
        modalOpen,
        modalMode,
        encounters: [],
        loading: false,
        openSaveModal: () => { setModalMode('save'); setModalOpen(true); },
        openLoadModal: vi.fn(),
        closeModal: () => setModalOpen(false),
        saveEncounter: vi.fn(async () => {}),
        updateEncounter: vi.fn(async () => {}),
        loadEncounterData: vi.fn(async () => null),
        deleteEncounterAction: vi.fn(async () => {}),
        renameEncounterAction: vi.fn(async () => {}),
      };
    }),
  };
});

vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn(async () => {}),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _runtimeKey, initial) => React.useState(initial),
  };
});

vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

const joinMonsters = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
];

function mountBuilder() {
  useMonstersData.mockReturnValue({
    monsters: joinMonsters.map(m => ({ ...m, environments: [...(m.environments || [])] })),
    loading: false,
  });
  const onJoinEncounter = vi.fn();
  const utils = render(
    <EncounterBuilder campaignName={CAMPAIGN} characters={[{ name: 'Thorin', level: 5 }]} onJoinEncounter={onJoinEncounter} />
  );
  return { ...utils, onJoinEncounter };
}

let consoleErrorSpy;

beforeEach(() => {
  addMonstersToInitiative.mockReset().mockResolvedValue(undefined);
  addEntry.mockReset().mockResolvedValue(undefined);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

async function checkGoblinAndJoin() {
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
  fireEvent.click(screen.getByRole('button', { name: 'Join Encounter' }));
}

describe('EncounterBuilder — Join Encounter failure honesty', () => {
  it('rejected join shows an error toast, logs NO joined row, and never navigates', async () => {
    // The exact live failure shape: store poisoned to `{}` → the service
    // rejected before the fix (TypeError …reading 'some').
    addMonstersToInitiative.mockRejectedValue(
      new TypeError("Cannot read properties of undefined (reading 'some')"));
    const { onJoinEncounter } = mountBuilder();

    await checkGoblinAndJoin();

    // Honest feedback: visible error toast + one console line (was a fully
    // silent unhandled rejection).
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Failed to join encounter');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to join encounter:',
      expect.objectContaining({ message: expect.stringContaining("reading 'some'") })
    );

    // NO phantom join: the campaign log never hears about it…
    expect(addEntry).not.toHaveBeenCalled();
    // …the app is not told to navigate, and the draft survives for a retry.
    expect(onJoinEncounter).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Select Goblin' })).toBeChecked();
  });

  it('successful join writes the joined row only AFTER the board accepts, then navigates', async () => {
    const { onJoinEncounter } = mountBuilder();

    await checkGoblinAndJoin();

    // Row lands (post-join ordering is owned in full by
    // additional-interactions.test.jsx; here pin the no-regression pair).
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
        type: 'encounter',
        action: 'joined',
        monsters: ['1x Goblin'],
      }));
    });
    expect(onJoinEncounter).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// @maintained-by-ai
/* Lane: starter-checklist "Join <wave>" deep link (backlog 2026-11-11 KW) —
 * a fired encounter-load signal auto-opens the EXISTING Load modal
 * (saved-wave list) without a manual Load click, single-shot: requests made
 * while the builder is UNMOUNTED are honored on its next mount, requests made
 * while mounted open via the subscription, and a consumed request never
 * re-opens on a later mount/close/remount. Row-click load dispatch belongs to
 * the unchanged Load lane (EncounterBuilder.load-encounter.test.jsx) — here we
 * only prove wave rows render in the auto-opened modal. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import useEncounterManagement from '../../hooks/management/useEncounterManagement.js';
import { requestEncounterLoad, consumePendingEncounterLoad } from '../../services/ui/encounterLoadSignal.js';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(() => ({ monsters: [], loading: false })),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(),
}));

vi.mock('./EncounterFilterPanel.jsx', () => ({
  default: () => <div data-testid="encounter-filter-panel" />,
}));

vi.mock('./EncounterSummaryPanel.jsx', () => ({
  default: () => <div data-testid="encounter-summary-panel" />,
}));

vi.mock('./EncounterMonsterTable.jsx', () => ({
  default: () => <div data-testid="encounter-monster-table" />,
}));

vi.mock('./EncounterSelectedMonsters.jsx', () => ({
  default: () => null,
}));

vi.mock('./EncounterModal.jsx', () => ({
  default: (props) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="encounter-modal">
        <button data-testid="modal-close" onClick={props.onClose}>Close</button>
        {props.mode === 'load' && props.encounters?.map((enc) => (
          <button
            key={enc.name}
            data-testid={`load-encounter-${enc.name}`}
            onClick={() => props.onLoad(enc.name)}
          >
            Load {enc.name}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: (props) => (
    <textarea data-testid="description-textarea" value={props.value || ''} onChange={() => props.onChange('')} />
  ),
}));

vi.mock('../../services/encounters/encountersService.js', () => ({
  formatEncounterName: vi.fn((name) => `Encounter: ${name}`),
}));

vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  calculateXPThreshold: vi.fn(() => 100),
  calculateDifficultyMultiplier: vi.fn(() => 1),
}));

vi.mock('../../config/encounterConfig.js', () => ({
  ENCOUNTER_CONFIG: { defaultDifficulty: 1 },
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => 0),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const WAVES = [{ name: 'Dungeon Wave 1' }, { name: 'Dungeon Wave 2' }, { name: 'Dungeon Wave 3' }];

// Stateful management mock: openLoadModal/closeModal drive REAL renders so the
// test observes modal presence, not just spy calls (mirrors the hook's
// open-then-load shape without touching the network lane).
function mockStatefulManagement() {
  useEncounterManagement.mockImplementation(() => {
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState(null);
    return {
      modalOpen,
      modalMode,
      encounters: WAVES,
      loading: false,
      openSaveModal: vi.fn(),
      openLoadModal: () => {
        setModalMode('load');
        setModalOpen(true);
      },
      closeModal: () => {
        setModalOpen(false);
        setModalMode(null);
      },
      saveEncounter: vi.fn(),
      updateEncounter: vi.fn(),
      loadEncounterData: vi.fn(async () => null),
      deleteEncounterAction: vi.fn(),
      renameEncounterAction: vi.fn(),
    };
  });
}

function renderBuilder() {
  useMonstersData.mockReturnValue({ monsters: [], loading: false });
  return render(<EncounterBuilder campaignName="qa-starter" characters={[]} onJoinEncounter={vi.fn()} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStatefulManagement();
  // Drain any request left pending by a sibling test (single-shot bus).
  consumePendingEncounterLoad();
});

describe('EncounterBuilder - starter-checklist auto-open Load modal', () => {
  it('a request fired while mounted auto-opens the Load modal with wave rows (no manual Load click)', () => {
    const { unmount } = renderBuilder();
    expect(screen.queryByTestId('encounter-modal')).not.toBeInTheDocument();

    act(() => requestEncounterLoad());

    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    expect(screen.getByTestId('load-encounter-Dungeon Wave 1')).toBeInTheDocument();
    expect(screen.getByTestId('load-encounter-Dungeon Wave 3')).toBeInTheDocument();
    unmount();
  });

  it('single-shot: closing the auto-opened modal stays closed across re-render and remount', () => {
    const { unmount } = renderBuilder();
    act(() => requestEncounterLoad());
    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('encounter-modal')).not.toBeInTheDocument();
    unmount();

    // Sidebar-style remount (campaign-switch face): the consumed request must
    // NOT resurrect the wave list.
    const again = renderBuilder();
    expect(screen.queryByTestId('encounter-modal')).not.toBeInTheDocument();
    again.unmount();
  });

  it('a request fired while unmounted is honored on the next mount, exactly once', () => {
    requestEncounterLoad();
    // Builder mounts AFTER the navigation (checklist lands the user here):
    // the pending request opens the wave list automatically.
    const { unmount } = renderBuilder();
    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    expect(screen.getByTestId('load-encounter-Dungeon Wave 2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-close'));
    unmount();

    // …and it is consumed: a further remount without a new request is clean.
    const again = renderBuilder();
    expect(screen.queryByTestId('encounter-modal')).not.toBeInTheDocument();
    again.unmount();
  });

  it('repeated requests re-arm: a second checklist click re-opens the wave list', () => {
    const { unmount } = renderBuilder();
    act(() => requestEncounterLoad());
    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('encounter-modal')).not.toBeInTheDocument();

    // Navigate-away-and-back face: a fresh request re-opens (no one-shot latch).
    act(() => requestEncounterLoad());
    expect(screen.getByTestId('encounter-modal')).toBeInTheDocument();
    // Row click still routes through the unchanged Load lane's onLoad.
    fireEvent.click(screen.getByTestId('load-encounter-Dungeon Wave 1'));
    unmount();
  });
});

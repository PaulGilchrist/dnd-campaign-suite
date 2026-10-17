// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SoulstitchSpellsModal from './SoulstitchSpellsModal.jsx';

// CLA-321 write contract owned by this modal (it is the single writer for the
// soulstitch stamp):
//   Apply → applySoulstitchSelection(action, playerStats, campaignName, selected)
//     resolves → confirmSoulstitchSelection(selected) — stamp strictly before the
//     cast is released — then the result view shows, and Done closes WITHOUT
//     re-resolving the confirmation.
//   Cancel → confirmSoulstitchSelection([]) exactly once (decline, no deadlock),
//     even when targets were already chosen; applySoulstitchSelection never runs.
//   Overlay/modal-surface clicks are inert — .sp-overlay carries no handler.
// Dropped from the old file: the "No creatures chosen" echo case only asserted the
// mock's own resolved payload back at itself (vacuous), and the per-fragment
// description/header/Done cases are consolidated into the result-view test below.

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-wizard/soulstitchSpellsHandler.js', () => ({
  applySoulstitchSelection: vi.fn(),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  confirmSoulstitchSelection: vi.fn(),
}));

// Re-import mocked modules after mocking
import { applySoulstitchSelection } from '../../../../services/automation/handlers/class-wizard/soulstitchSpellsHandler.js';
import { confirmSoulstitchSelection } from '../../../../services/rules/spells/postCastRiderService.js';

// ── Fixtures ──

// Fresh per call: pristine callbacks and per-test payload objects for exact-arg
// assertions, with overrides spread over the defaults (never `??`-backfilled, so
// explicit undefineds reach the component's own default-parameter path verbatim).
function makeProps(overrides = {}) {
  return {
    action: { name: 'Soulstitch Spells', automation: { type: 'soulstitch_spells' } },
    playerStats: { name: 'Wizard1', level: 5 },
    campaignName: 'test-campaign',
    maxSelections: 2,
    eligibleTargets: ['Orc Warrior', 'Goblin Acolyte', 'Bugbear'],
    spellName: 'Fireball',
    featureName: 'Soulstitch Spells',
    onClose: vi.fn(),
    ...overrides,
  };
}

function stampResult(description) {
  return {
    type: 'popup',
    payload: { type: 'automation_info', name: 'Soulstitch Spells', description },
  };
}

// ── Tests ──

describe('SoulstitchSpellsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applySoulstitchSelection.mockResolvedValue(stampResult('Goblin Acolyte takes no damage.'));
  });

  afterEach(() => {
    // clearAllMocks keeps mockResolvedValue implementations — reset the stamp so
    // per-test overrides (null, missing description) never leak forward.
    applySoulstitchSelection.mockReset();
  });

  // ── Initial render ──

  it('renders the selection view: header, spell description, enabled checkboxes, disabled-but-inert Apply, Cancel, and no result controls', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByText('Soulstitch Spells')).toBeInTheDocument();
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText(/automatically succeed on saving throws and take no damage\./)).toBeInTheDocument();
    expect(screen.getByText('Selected: 0 / 2')).toBeInTheDocument();

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    ['Orc Warrior', 'Goblin Acolyte', 'Bugbear'].forEach((name) => {
      const box = screen.getByRole('checkbox', { name });
      expect(box).not.toBeChecked();
      expect(box).toBeEnabled();
    });

    const applyBtn = screen.getByRole('button', { name: 'Apply Soulstitch (0 chosen)' });
    expect(applyBtn).toBeDisabled();
    fireEvent.click(applyBtn);
    expect(applySoulstitchSelection).not.toHaveBeenCalled();
    expect(confirmSoulstitchSelection).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('renders component defaults when maxSelections, eligibleTargets, spellName, and featureName are omitted', () => {
    // built by hand (not stripped from makeProps) so the four defaulted props
    // are genuinely absent, not passed as explicit undefined
    render(
      <SoulstitchSpellsModal
        action={{ name: 'Soulstitch Spells', automation: { type: 'soulstitch_spells' } }}
        playerStats={{ name: 'Wizard1', level: 5 }}
        campaignName="test-campaign"
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Soulstitch Spells')).toBeInTheDocument();
    expect(screen.getByText('Selected: 0 / 1')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  // ── Target selection ──

  it('toggles targets via their checkboxes and keeps the counter and Apply label in step', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    const goblin = screen.getByRole('checkbox', { name: 'Goblin Acolyte' });

    fireEvent.click(goblin);
    expect(goblin).toBeChecked();
    expect(screen.getByText('Selected: 1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Soulstitch (1 chosen)' })).toBeEnabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bugbear' }));
    expect(screen.getByRole('button', { name: 'Apply Soulstitch (2 chosen)' })).toBeEnabled();

    fireEvent.click(goblin);
    expect(goblin).not.toBeChecked();
    expect(screen.getByText('Selected: 1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Soulstitch (1 chosen)' })).toBeEnabled();
  });

  it.each([1, 2])('caps selection at maxSelections=%s: unselected boxes are disabled with tooltip and inert until one is freed, then selectable again', (maxSelections) => {
    render(<SoulstitchSpellsModal {...makeProps({ maxSelections })} />);
    const all = ['Orc Warrior', 'Goblin Acolyte', 'Bugbear'];
    const chosen = all.slice(0, maxSelections);
    const free = all.slice(maxSelections);

    chosen.forEach((name) => fireEvent.click(screen.getByRole('checkbox', { name })));
    expect(screen.getByText(`Selected: ${maxSelections} / ${maxSelections}`)).toBeInTheDocument();

    free.forEach((name) => {
      const box = screen.getByRole('checkbox', { name });
      expect(box).toBeDisabled();
      expect(box.closest('label')).toHaveAttribute('title', `You can choose up to ${maxSelections} creatures`);
      fireEvent.click(box);
      expect(box).not.toBeChecked();
    });
    expect(screen.getByText(`Selected: ${maxSelections} / ${maxSelections}`)).toBeInTheDocument();

    // freeing a slot re-enables and accepts the overflow target
    fireEvent.click(screen.getByRole('checkbox', { name: chosen[0] }));
    const refilled = screen.getByRole('checkbox', { name: free[0] });
    expect(refilled).toBeEnabled();
    expect(refilled.closest('label')).not.toHaveAttribute('title');
    fireEvent.click(refilled);
    expect(refilled).toBeChecked();
    expect(screen.getByText(`Selected: ${maxSelections} / ${maxSelections}`)).toBeInTheDocument();
  });

  // ── Cancel / close — CLA-321 decline path ──

  it('Cancel declines the cast: resolves confirmation with [] once (chosen targets discarded), closes once, and never applies', () => {
    const props = makeProps();
    render(<SoulstitchSpellsModal {...props} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Goblin Acolyte' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirmSoulstitchSelection).toHaveBeenCalledTimes(1);
    expect(confirmSoulstitchSelection).toHaveBeenCalledWith([]);
    expect(applySoulstitchSelection).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('overlay and modal-surface clicks are inert — nothing closes or resolves', () => {
    const props = makeProps();
    const { container } = render(<SoulstitchSpellsModal {...props} />);
    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(confirmSoulstitchSelection).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Apply — CLA-321 single-writer flow ──

  it('Apply runs the exact write contract and releases the cast only after the stamp resolves', async () => {
    const props = makeProps();
    render(<SoulstitchSpellsModal {...props} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bugbear' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Goblin Acolyte' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply Soulstitch (2 chosen)' }));
    });
    expect(applySoulstitchSelection).toHaveBeenCalledTimes(1);
    expect(applySoulstitchSelection).toHaveBeenCalledWith(
      props.action,
      props.playerStats,
      'test-campaign',
      ['Bugbear', 'Goblin Acolyte']
    );
    expect(confirmSoulstitchSelection).toHaveBeenCalledTimes(1);
    expect(confirmSoulstitchSelection).toHaveBeenCalledWith(['Bugbear', 'Goblin Acolyte']);
    // single writer: the stamp lands before the cast is released
    expect(applySoulstitchSelection.mock.invocationCallOrder[0]).toBeLessThan(
      confirmSoulstitchSelection.mock.invocationCallOrder[0]
    );
  });

  it.each([
    ['the handler description', 'Orc Warrior automatically succeeds on saves and takes no damage.'],
    ['no description', undefined],
  ])('transitions to the result view carrying %s, hides all selection controls, and Done closes once without re-resolving the cast', async (_label, description) => {
    const props = makeProps({ featureName: 'Rite of the Stitch' });
    applySoulstitchSelection.mockResolvedValue(stampResult(description));
    render(<SoulstitchSpellsModal {...props} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Goblin Acolyte' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply Soulstitch (1 chosen)' }));
    });

    const done = screen.getByRole('button', { name: 'Done' });
    expect(screen.getByText('Rite of the Stitch')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Apply Soulstitch/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    const body = document.querySelector('.sp-body');
    if (description === undefined) {
      expect(body).toBeEmptyDOMElement();
    } else {
      expect(body).toHaveTextContent(description);
    }

    confirmSoulstitchSelection.mockClear(); // cast was already released at apply time
    fireEvent.click(done);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(confirmSoulstitchSelection).not.toHaveBeenCalled();
    expect(applySoulstitchSelection).toHaveBeenCalledTimes(1);
  });

  it('stays in the selection view when the handler resolves null, but the cast was already released once', async () => {
    applySoulstitchSelection.mockResolvedValue(null);
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Goblin Acolyte' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply Soulstitch (1 chosen)' }));
    });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Soulstitch (1 chosen)' })).toBeEnabled();
    expect(screen.getByText('Selected: 1 / 2')).toBeInTheDocument();
    expect(confirmSoulstitchSelection).toHaveBeenCalledTimes(1);
    expect(confirmSoulstitchSelection).toHaveBeenCalledWith(['Goblin Acolyte']);
  });
});

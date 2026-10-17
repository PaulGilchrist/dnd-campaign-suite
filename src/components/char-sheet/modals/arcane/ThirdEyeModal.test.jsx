import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ThirdEyeModal from './ThirdEyeModal.jsx';

// Write contract owned by this modal:
//   Apply → applyThirdEye(action, playerStats, campaignName, selected) — the exact
//     props objects plus the radio-selected benefit name, defaulting to the first
//     option — then each resolved logEntries item is flushed via
//     addEntry(campaignName, entry) in order, failures swallowed with console.error.
//     The result view shows the handler's own description; Done closes once.
//   Cancel → onClose once, handler never runs.
//   Overlay/modal-surface clicks are inert — .sp-overlay carries no handler.
// Consolidated from the old file: the three per-radio apply cases are one
// parameterised test, and the duplicated result-view/description cases are one
// parameterised result-view test (custom description now proves the view renders
// the handler response, not the static option copy).

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-wizard/thirdEyeHandler.js', () => ({
  applyThirdEye: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

// Re-import mocked modules after mocking
import { applyThirdEye } from '../../../../services/automation/handlers/class-wizard/thirdEyeHandler.js';
import { addEntry } from '../../../../services/ui/logService.js';

// ── Fixtures ──

// Fresh per call: pristine callback and per-test payload objects for exact-arg and
// same-object-identity assertions (no shared baseProps leaking between tests).
function makeProps(overrides = {}) {
  return {
    action: { name: 'Third Eye', automation: { duration: 'short_or_long_rest' } },
    playerStats: { name: 'Wizard1', level: 14 },
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    ...overrides,
  };
}

function thirdEyeResult(description, logEntries) {
  return {
    type: 'popup',
    payload: { type: 'automation_info', name: 'Third Eye', description },
    ...(logEntries ? { logEntries } : {}),
  };
}

const OPTION_NAMES = ['Darkvision (120 feet)', 'Greater Comprehension', 'See Invisibility'];

// ── Tests ──

describe('ThirdEyeModal', () => {
  let consoleError;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    applyThirdEye.mockResolvedValue(thirdEyeResult('Third Eye: Darkvision (120 feet) chosen. You gain Darkvision out to a range of 120 feet. (Duration: until start of Short or Long Rest)'));
    // addEntry must return a Promise — the component chains .catch() on it.
    addEntry.mockResolvedValue({});
  });

  afterEach(() => {
    // clearAllMocks keeps mockResolvedValue implementations — reset both mocks so
    // per-test overrides (null result, custom logs, rejections) never leak forward.
    applyThirdEye.mockReset();
    addEntry.mockReset();
    consoleError.mockRestore();
  });

  // ── Initial render ──

  it('renders the selection view: header, prompt, three radios with the first pre-selected, and an enabled Apply (default selection means disabled={!selected} is unreachable)', () => {
    render(<ThirdEyeModal {...makeProps()} />);
    expect(screen.getByText('Third Eye')).toBeInTheDocument();
    expect(screen.getByText(/Choose a benefit \(lasts until start of Short or Long Rest\)/)).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    OPTION_NAMES.forEach((name, i) => {
      const radio = screen.getByRole('radio', { name: new RegExp(name.replace(/[()]/g, '\\$&')) });
      expect(radio).toBe(radios[i]);
      if (i === 0) expect(radio).toBeChecked();
      else expect(radio).not.toBeChecked();
    });

    expect(screen.getByRole('button', { name: 'Use Bonus Action' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /Darkvision/ })); // re-click checked radio: controlled, stays selected
    expect(screen.getByRole('radio', { name: /Darkvision/ })).toBeChecked();
  });

  // ── Selection gating and apply — exact write contract ──

  it.each(OPTION_NAMES.map((name, i) => [i, name]))(
    'selecting radio %s applies the exact selection %s with the same prop objects, once',
    async (index, name) => {
      const props = makeProps();
      render(<ThirdEyeModal {...props} />);
      if (index > 0) {
        fireEvent.click(screen.getByRole('radio', { name: new RegExp(name.replace(/[()]/g, '\\$&')) }));
      }
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Use Bonus Action' }));
      });

      expect(applyThirdEye).toHaveBeenCalledTimes(1);
      expect(applyThirdEye).toHaveBeenCalledWith(props.action, props.playerStats, 'test-campaign', name);
      // same-object identity, not just deep-equal fixtures
      expect(applyThirdEye.mock.calls[0][0]).toBe(props.action);
      expect(applyThirdEye.mock.calls[0][1]).toBe(props.playerStats);
      await screen.findByRole('button', { name: 'Done' });
    }
  );

  // ── Result view ──

  it.each([
    ['the handler description', 'Third Eye hums: Greater Comprehension granted until your next rest.'],
    ['no description', undefined],
  ])('transitions to the result view carrying %s, hides all selection controls, and Done closes once without re-applying', async (_label, description) => {
    const props = makeProps();
    applyThirdEye.mockResolvedValue(thirdEyeResult(description));
    const { container } = render(<ThirdEyeModal {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: /Greater Comprehension/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use Bonus Action' }));
    });

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText('Third Eye')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use Bonus Action' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    const body = document.querySelector('.sp-body');
    if (description === undefined) {
      expect(body.textContent).toBe('');
    } else {
      expect(body).toHaveTextContent(description);
      // proves the view renders the handler response, not the static option copy
      expect(body).not.toHaveTextContent('Choose a benefit');
    }

    fireEvent.click(container.querySelector('.sp-modal')); // inert even in the result view
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(done);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(applyThirdEye).toHaveBeenCalledTimes(1);
  });

  // ── Cancel / inertness ──

  it('Cancel closes once, discards a non-default selection, and never applies or logs', () => {
    const props = makeProps();
    render(<ThirdEyeModal {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: /See Invisibility/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(applyThirdEye).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('overlay and modal-surface clicks are inert — nothing closes or applies', () => {
    const props = makeProps();
    const { container } = render(<ThirdEyeModal {...props} />);
    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    fireEvent.click(container.querySelector('.sp-header'));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(applyThirdEye).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Log flushing ──

  it('flushes handler logEntries to addEntry in order with exact campaign and same-object entry payloads, after the handler resolves', async () => {
    const entries = [
      { characterName: 'Wizard1', type: 'ability_use', abilityName: 'The Third Eye', description: 'Wizard1 uses The Third Eye, choosing Darkvision (120 feet).', timestamp: 123 },
      { characterName: 'Wizard1', type: 'info', description: 'Darkvision active.', timestamp: 124 },
    ];
    applyThirdEye.mockResolvedValue(thirdEyeResult('Granted.', entries));
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use Bonus Action' }));
    });

    await screen.findByRole('button', { name: 'Done' });
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', entries[0]);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', entries[1]);
    expect(addEntry.mock.calls[0][1]).toBe(entries[0]);
    expect(addEntry.mock.calls[1][1]).toBe(entries[1]);
    // flush strictly follows the handler
    expect(applyThirdEye.mock.invocationCallOrder[0]).toBeLessThan(addEntry.mock.invocationCallOrder[0]);
  });

  it.each([
    ['no logEntries key', undefined],
    ['empty logEntries', []],
  ])('does not call addEntry when the handler returns %s, but still reaches the result view', async (_label, logEntries) => {
    applyThirdEye.mockResolvedValue(thirdEyeResult('Granted quietly.', logEntries));
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use Bonus Action' }));
    });
    await screen.findByRole('button', { name: 'Done' });
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('reaches the result view when a log write rejects, logging the error without re-throwing', async () => {
    applyThirdEye.mockResolvedValue(thirdEyeResult('Granted.', [
      { characterName: 'Wizard1', type: 'ability_use', description: 'uses The Third Eye', timestamp: 123 },
    ]));
    addEntry.mockRejectedValueOnce(new Error('log service down'));
    render(<ThirdEyeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use Bonus Action' }));
    });
    await screen.findByRole('button', { name: 'Done' });
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it('stays in the selection view when the handler resolves null, and Cancel still closes cleanly', async () => {
    const props = makeProps();
    applyThirdEye.mockResolvedValue(null);
    render(<ThirdEyeModal {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use Bonus Action' }));
    });
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

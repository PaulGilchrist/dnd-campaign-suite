// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import IllusoryRealityModal from './IllusoryRealityModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-wizard/illusoryRealityHandler.js', () => ({
  confirmIllusoryReality: vi.fn(),
}));

// Re-import mocked module after mocking
import { confirmIllusoryReality } from '../../../../services/automation/handlers/class-wizard/illusoryRealityHandler.js';

// ── Test fixtures ──

const defaultAction = {
  name: 'Illusory Reality',
  automation: { type: 'illusory_reality' },
};

const defaultPlayerStats = { name: 'Wizard1', level: 14, rules: '2024' };
const defaultCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    action: defaultAction,
    playerStats: defaultPlayerStats,
    campaignName: defaultCampaignName,
    onClose: vi.fn(),
    ...overrides,
  };
}

// Mirrors the popup shape returned by illusoryRealityHandler.confirmIllusoryReality —
// confirmIllusoryReality is the component's ONLY server-first write path (the handler
// itself writes illusoryRealityObject and logs the ability_use entry), so exact-arg
// assertions on it here pin the modal's write contract. The modal passes the raw
// input verbatim; trimming lives in the handler.
function confirmResponse(featureName, objectName) {
  const name = featureName || 'Illusory Reality';
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name,
      description: `<b>${name}</b><br/><br/>You use your Bonus Action to make the object <b>"${objectName}"</b> real.<br/><br/>The object cannot deal damage or impose any conditions.<br/><br/><em>The object persists until you roll initiative, finish a short rest, or finish a long rest. It disappears if you use this feature again.</em>`,
      automation: defaultAction.automation,
    },
  };
}

function fill(objectValue) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: objectValue } });
}

// ── Tests ──

describe('IllusoryRealityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmIllusoryReality.mockResolvedValue(confirmResponse('Illusory Reality', 'stone'));
  });

  afterEach(() => {
    confirmIllusoryReality.mockReset();
  });

  // ── Initial render / display ──

  it('renders the header, rules text, object input, disabled action button, and Cancel', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
    expect(screen.getByText(/Choose one inanimate, nonmagical object/)).toBeInTheDocument();
    expect(screen.getByText(/The object cannot deal damage or impose any conditions/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter object name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Make Object Real/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // The header name is `action?.featureName || 'Illusory Reality'` — the modal
  // never renders action.name, so absent/null action and featureName both fall
  // back to the canonical label while a featureName wins over it.
  it.each([
    { action: undefined, header: 'Illusory Reality' },
    { action: null, header: 'Illusory Reality' },
    { action: { automation: {} }, header: 'Illusory Reality' },
    { action: { name: 'Illusory Reality', featureName: 'Mind Over Matter' }, header: 'Mind Over Matter' },
  ])('renders header "$header" for action %j', ({ action, header }) => {
    render(<IllusoryRealityModal {...makeProps({ action })} />);
    expect(screen.getByText(header)).toBeInTheDocument();
  });

  // ── Input gating ──

  it('gates Make Object Real on non-whitespace input — empty and whitespace keep it disabled', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Make Object Real/ });
    expect(btn).toBeDisabled();

    fill('   ');
    expect(btn).toBeDisabled();

    fill('a 5-foot cube of stone');
    expect(btn).toBeEnabled();

    fill('');
    expect(btn).toBeDisabled();
  });

  // ── Close / dismiss behavior ──

  it('Cancel closes exactly once and submits nothing', () => {
    const props = makeProps();
    render(<IllusoryRealityModal {...props} />);
    fill('stone');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(confirmIllusoryReality).not.toHaveBeenCalled();
  });

  it('clicking the overlay background and modal shell is inert — no close, no submission', () => {
    const props = makeProps();
    const { container } = render(<IllusoryRealityModal {...props} />);
    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(confirmIllusoryReality).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders and ignores Cancel when onClose is omitted', () => {
    const props = makeProps();
    delete props.onClose;
    render(<IllusoryRealityModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(confirmIllusoryReality).not.toHaveBeenCalled();
  });

  // ── Confirm flow — exact write payload ──

  it('pressing Make Object Real submits the exact action, playerStats, campaignName, and raw input', async () => {
    const props = makeProps({
      action: { name: 'Illusory Reality', featureName: 'Custom Feature', automation: { type: 'illusory_reality' } },
      playerStats: { name: 'CustomWizard', level: 10, rules: '2024' },
    });
    confirmIllusoryReality.mockResolvedValue(confirmResponse('Custom Feature', 'stone'));
    render(<IllusoryRealityModal {...props} />);

    fill('  stone  ');
    fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    await screen.findByRole('button', { name: 'Done' });

    expect(confirmIllusoryReality).toHaveBeenCalledTimes(1);
    expect(confirmIllusoryReality).toHaveBeenCalledWith(
      props.action,
      props.playerStats,
      props.campaignName,
      '  stone  '
    );
  });

  it('swaps to the Done-only result view with the handler description, and Done closes once without resubmitting', async () => {
    const props = makeProps();
    render(<IllusoryRealityModal {...props} />);
    fill('stone');
    fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Make Object Real/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByText(/You use your Bonus Action to make the object/)).toBeInTheDocument();
    expect(screen.getByText(/"stone"/)).toBeInTheDocument();

    fireEvent.click(done);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(confirmIllusoryReality).toHaveBeenCalledTimes(1);
  });

  // Empty-object refusals live in the handler (the modal's trim-gating blocks the
  // button) — verify the refusal popup payload still renders and closes cleanly.
  it('renders the handler refusal popup and closes without resubmitting', async () => {
    const props = makeProps();
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: 'Illusory Reality: You must specify an inanimate, nonmagical object that is part of an illusion spell you cast with a spell slot.',
        automation: defaultAction.automation,
      },
    });
    render(<IllusoryRealityModal {...props} />);
    fill('stone');
    fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText('Illusory Reality: You must specify an inanimate, nonmagical object that is part of an illusion spell you cast with a spell slot.')).toBeInTheDocument();

    fireEvent.click(done);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(confirmIllusoryReality).toHaveBeenCalledTimes(1);
  });
});

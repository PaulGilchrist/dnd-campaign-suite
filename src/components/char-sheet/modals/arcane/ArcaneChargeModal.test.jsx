// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ArcaneChargeModal from './ArcaneChargeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-sorcerer/arcaneChargeHandler.js', () => ({
  confirmArcaneCharge: vi.fn(),
}));

// Re-import mocked module after mocking
import { confirmArcaneCharge } from '../../../../services/automation/handlers/class-sorcerer/arcaneChargeHandler.js';

// ── Test fixtures ──

const defaultAction = {
  name: 'Arcane Charge',
  automation: { type: 'teleport', distance: '30 ft' },
};

const defaultPlayerStats = { name: 'Sorcerer1', level: 5 };
const defaultCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    action: defaultAction,
    playerStats: defaultPlayerStats,
    campaignName: defaultCampaignName,
    distance: '30 ft',
    onClose: vi.fn(),
    ...overrides,
  };
}

// Mirrors the popup shape returned by arcaneChargeHandler.arcaneChargePopup —
// confirmArcaneCharge is the component's ONLY server-first write path (it logs
// the ability_use entry itself), so exact-arg assertions here pin that contract.
function confirmResponse(action, distance) {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: action.name,
      automationType: action.automation.type,
      description: `${action.name}: Teleported ${distance} to an unoccupied space you can see.`,
      automation: action.automation,
    },
  };
}

// ── Tests ──

describe('ArcaneChargeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmArcaneCharge.mockResolvedValue(confirmResponse(defaultAction, '30 ft'));
  });

  afterEach(() => {
    confirmArcaneCharge.mockReset();
  });

  // ── Initial render / display ──

  it('renders the header, teleport description, and Teleport/Cancel buttons', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    expect(screen.getByText('Arcane Charge')).toBeInTheDocument();
    expect(screen.getByText('Teleport up to 30 ft to an unoccupied space you can see.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teleport' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // Consolidated from "custom distance" / "distance 0" / "distance null" cases.
  // The null-distance fallback lives in the old makeProps `??`, not in the
  // component (which interpolates `distance` verbatim), so that case tested the
  // fixture rather than the component and is dropped here.
  it.each(['60 ft', 0])('displays the supplied distance %p verbatim', (distance) => {
    render(<ArcaneChargeModal {...makeProps({ distance })} />);
    expect(screen.getByText(`Teleport up to ${distance} to an unoccupied space you can see.`)).toBeInTheDocument();
  });

  // ── Close / dismiss behavior ──

  it('Cancel closes once and stays inert — no teleport submitted, pre-confirm UI kept', () => {
    const onClose = vi.fn();
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmArcaneCharge).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Teleport' })).toBeInTheDocument();
  });

  it('clicking the overlay background is inert — no close, no submission', () => {
    const onClose = vi.fn();
    const { container } = render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    fireEvent.click(container.querySelector('.sp-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmArcaneCharge).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders and ignores Cancel when onClose is omitted', () => {
    // Replaces the old "null action" test: the component dereferences action.name
    // in both branches, so a null action legitimately throws — that case passed
    // only because the old fixture backfilled defaults.
    const props = makeProps();
    delete props.onClose;
    render(<ArcaneChargeModal {...props} />);
    expect(screen.getByText('Arcane Charge')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Teleport confirm flow ──

  it('pressing Teleport submits the exact action, playerStats, and campaignName to the handler', async () => {
    const props = makeProps({
      action: { name: 'Arcane Charge', automation: { type: 'teleport', distance: '60 ft' } },
      playerStats: { name: 'CustomSorcerer', level: 10 },
      distance: '60 ft',
    });
    confirmArcaneCharge.mockResolvedValue(confirmResponse(props.action, props.distance));
    render(<ArcaneChargeModal {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Teleport' }));
    await screen.findByRole('button', { name: 'Done' });
    expect(confirmArcaneCharge).toHaveBeenCalledTimes(1);
    expect(confirmArcaneCharge).toHaveBeenCalledWith(props.action, props.playerStats, props.campaignName);
  });

  it('swaps to the Done-only result view with the handler description, and Done closes once without resubmitting', async () => {
    const onClose = vi.fn();
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Teleport' }));
    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.queryByRole('button', { name: 'Teleport' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByText('Arcane Charge: Teleported 30 ft to an unoccupied space you can see.')).toBeInTheDocument();
    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmArcaneCharge).toHaveBeenCalledTimes(1);
  });

  // Resource gating lives in the handler (Action Surge latch, CLA-010), not in
  // the modal — verify the refusal popup payload still renders and closes cleanly.
  it('renders the handler refusal when Action Surge has not been used and closes without resubmitting', async () => {
    const onClose = vi.fn();
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: defaultAction.name,
        automationType: 'arcane_charge_refused',
        description: 'Arcane Charge requires Action Surge used this turn.',
        automation: defaultAction.automation,
      },
    });
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Teleport' }));
    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText('Arcane Charge requires Action Surge used this turn.')).toBeInTheDocument();
    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmArcaneCharge).toHaveBeenCalledTimes(1);
  });
});

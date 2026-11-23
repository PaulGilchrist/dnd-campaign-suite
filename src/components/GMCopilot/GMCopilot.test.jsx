import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { clearRuntimeState, seedTrackedResources, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { GM_COPILOT_KEY } from '../../hooks/management/useGmCopilot.js';
import GMCopilot from './GMCopilot.jsx';
import { COPILOT_TIPS } from './copilotTips.js';

describe('GMCopilot', () => {
  beforeEach(() => {
    cleanup();
    clearRuntimeState('campaign');
    vi.restoreAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
  });

  const renderTip = (props = {}) =>
    render(
      <GMCopilot
        campaignName="Test Camp"
        tipId="initiative-flow"
        onAction={() => {}}
        actionLabel="Open Encounter Builder"
        {...props}
      />
    );

  it('renders the registry copy when armed and unsettled', () => {
    renderTip();
    const card = screen.getByRole('note', { name: /GM tip/i });
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent(COPILOT_TIPS['initiative-flow'].title);
    expect(card).toHaveTextContent(COPILOT_TIPS['initiative-flow'].body);
  });

  it('renders nothing when the mount-site condition is not met', () => {
    renderTip({ when: false });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('renders nothing once the tip is dismissed (server-first, any device)', () => {
    seedTrackedResources('campaign', {
      [GM_COPILOT_KEY]: { dismissed: { 'initiative-flow': true } },
    });
    renderTip();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('× dismiss settles the tip forever and writes the campaign key', () => {
    renderTip();
    fireEvent.click(screen.getByTitle('Dismiss this tip for good'));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(getRuntimeValue('campaign', GM_COPILOT_KEY)).toEqual({
      dismissed: { 'initiative-flow': true },
    });
  });

  it('the action button settles the tip as seen AND runs the guided step', () => {
    const onAction = vi.fn();
    renderTip({ onAction });
    fireEvent.click(screen.getByRole('button', { name: 'Open Encounter Builder' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(getRuntimeValue('campaign', GM_COPILOT_KEY)).toEqual({
      seen: { 'initiative-flow': true },
    });
  });

  it('no action button when the mount site offers no guided step', () => {
    renderTip({ tipId: 'monster-avatars', onAction: undefined, actionLabel: undefined });
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open Encounter/ })).not.toBeInTheDocument();
  });

  it('unknown tip ids render nothing', () => {
    renderTip({ tipId: 'no-such-tip' });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('registry entries can carry their own flag label and a vars-driven body', () => {
    renderTip({ tipId: 'try-combat', vars: { encounters: 3, maps: 1 } });
    const card = screen.getByRole('note', { name: 'Try next: Try running combat in the app' });
    expect(card.querySelector('.gm-copilot-flag')).toHaveTextContent('Try next');
    expect(card).toHaveTextContent('3 encounters');
  });
});

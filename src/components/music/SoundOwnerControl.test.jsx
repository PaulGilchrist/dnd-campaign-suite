// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { clearRuntimeState, seedTrackedResources } from '../../hooks/runtime/useRuntimeState.js';
import { SOUND_OWNER_KEY } from '../../services/ui/soundOwner.js';
import SoundOwnerControl from './SoundOwnerControl.jsx';

describe('SoundOwnerControl', () => {
  beforeEach(() => {
    cleanup();
    clearRuntimeState('campaign');
    localStorage.removeItem('initiative-tv');
    vi.restoreAllMocks();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
  });

  it('GM default on the owning (localhost) tab: full accessible copy, no note', () => {
    render(<SoundOwnerControl campaignName="Test Camp" />);
    const button = screen.getByRole('button', {
      name: 'Sound screen: the GM machine — move to the TV screen',
    });
    expect(button).toHaveAttribute(
      'title',
      'Combat sound plays on the GM machine — click to move it to the TV screen'
    );
    expect(screen.queryByText(/Sound plays on/)).not.toBeInTheDocument();
  });

  it('clicking moves the role to the TV screen: label flips and this GM tab becomes a viewer with a note', () => {
    render(<SoundOwnerControl campaignName="Test Camp" />);
    fireEvent.click(screen.getByRole('button', { name: /move to the TV screen/ }));
    // The synced write lands in the campaign bucket; the label flips and the
    // localhost tab, no longer the owner, shows where the sound went.
    expect(
      screen.getByRole('button', { name: 'Sound screen: the TV screen — move to the GM machine' })
    ).toBeInTheDocument();
    expect(screen.getByText('Sound plays on the TV screen')).toBeInTheDocument();
  });

  it('non-owner tab with a TV claim but NO present TV screen shows the note plus the zero-screens qualifier', () => {
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.getByText('Sound plays on the TV screen')).toBeInTheDocument();
    expect(screen.getByText(/0 screens are in TV mode right now/)).toBeInTheDocument();
  });

  it('non-owner tab with a present TV screen sees the plain note, then moves the role back to the GM ungated', () => {
    seedTrackedResources('campaign', {
      [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { 'tab-foreign': true } },
    });
    render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.getByText('Sound plays on the TV screen')).toBeInTheDocument();
    expect(screen.queryByText(/0 screens are in TV mode right now/)).not.toBeInTheDocument();

    // Shared-table authoring posture: any tab may reclaim — no gating, no
    // auto-revert — and once the claim says 'gm' this tab owns the sound
    // again, so the note disappears.
    fireEvent.click(screen.getByRole('button', { name: /move to the GM machine/ }));
    expect(
      screen.getByRole('button', { name: 'Sound screen: the GM machine — move to the TV screen' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sound plays on/)).not.toBeInTheDocument();
  });

  it('the owning TV tab never shows a note — whether or not any TV screen is marked present', () => {
    localStorage.setItem('initiative-tv', '1');
    seedTrackedResources('campaign', {
      [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { 'tab-foreign': true } },
    });
    const { unmount } = render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.queryByText(/Sound plays on/)).not.toBeInTheDocument();

    // Empty presence map still means owner face: the zero-screen qualifier is
    // a non-owner honesty aid, never shown to the tab that is actually talking.
    unmount();
    clearRuntimeState('campaign');
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.queryByText(/Sound plays on/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 screens are in TV mode right now/)).not.toBeInTheDocument();
  });
});

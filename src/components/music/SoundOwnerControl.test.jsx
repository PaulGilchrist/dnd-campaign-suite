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

  it('shows the GM default with no note chip on the owning (localhost) tab', () => {
    render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.getByRole('button', { name: /Sound screen: the GM machine — move to the TV screen/ })).toBeInTheDocument();
    expect(screen.queryByText(/Sound plays on/)).not.toBeInTheDocument();
  });

  it('clicking moves the role to the TV screen (server-first write)', () => {
    render(<SoundOwnerControl campaignName="Test Camp" />);
    fireEvent.click(screen.getByRole('button', { name: /move to the TV screen/ }));
    // The synced write lands in the campaign bucket; the label flips.
    expect(screen.getByRole('button', { name: /Sound screen: the TV screen — move to the GM machine/ })).toBeInTheDocument();
  });

  it('non-owner tab with a TV claim but NO present TV screen shows the note plus the zero-screens qualifier', () => {
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.getByText('Sound plays on the TV screen')).toBeInTheDocument();
    expect(screen.getByText(/0 screens are in TV mode right now/)).toBeInTheDocument();
  });

  it('non-owner tab keeps the plain note while a TV-present screen is recorded', () => {
    seedTrackedResources('campaign', {
      [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { 'tab-foreign': true } },
    });
    render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.getByText('Sound plays on the TV screen')).toBeInTheDocument();
    expect(screen.queryByText(/0 screens are in TV mode right now/)).not.toBeInTheDocument();
  });

  it('the owning tab (TV claim + this tab\'s TV pref) renders no note at all, qualified or not', () => {
    localStorage.setItem('initiative-tv', '1');
    seedTrackedResources('campaign', {
      [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { 'tab-foreign': true } },
    });
    render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.queryByText(/Sound plays on/)).not.toBeInTheDocument();
  });

  it('owner face with an EMPTY presence map is still owner face — no note', () => {
    localStorage.setItem('initiative-tv', '1');
    seedTrackedResources('campaign', { [SOUND_OWNER_KEY]: { screen: 'tv' } });
    render(<SoundOwnerControl campaignName="Test Camp" />);
    expect(screen.queryByText(/Sound plays on/)).not.toBeInTheDocument();
  });

  it('claim posture unchanged: a TV claim still offers the move-to-GM press (no gating, no auto-revert)', () => {
    seedTrackedResources('campaign', {
      [SOUND_OWNER_KEY]: { screen: 'tv', tvScreens: { 'tab-foreign': true } },
    });
    render(<SoundOwnerControl campaignName="Test Camp" />);
    fireEvent.click(screen.getByRole('button', { name: /move to the GM machine/ }));
    expect(screen.getByRole('button', { name: /Sound screen: the GM machine — move to the TV screen/ })).toBeInTheDocument();
  });
});

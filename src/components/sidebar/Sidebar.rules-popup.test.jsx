// @maintained-by-ai
// Rules-launchpad popup-block feedback lane (backlog 2026-11-12 TE): openRules
// used to ignore window.open's return, so a browser-blocked popup left the
// click silent. Blocked face (falsy return) must fire the app's existing toast
// idiom (role=status div, local state + auto-hide — there is no shared toast
// utility to spy, so the lane is asserted on its rendered node, matching
// MusicPlayer.toast.test.jsx). Allowed face (truthy return) must launch the
// external URL in a new tab exactly as before with NO toast.
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Sidebar from './Sidebar.jsx';

const RULES_URL = 'https://paulgilchrist.github.io/dnd-tools/rules/general';
const BLOCKED_COPY = 'Popup blocked — allow popups for this site to open the Rules reference';

function renderSidebar() {
  return render(<Sidebar
    campaignName="test-campaign"
    characters={[]}
    activeCharacter={null}
    isLocalhost
    activeView="charSheet"
    onBackToCampaigns={vi.fn()}
    onAddCharacter={vi.fn()}
    onCharacterClick={vi.fn()}
  />);
}

const toastNode = () => document.querySelector('.sidebar-toast');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Sidebar Rules launchpad popup-block feedback', () => {
  it('renders no toast before Rules is clicked', () => {
    renderSidebar();
    expect(toastNode()).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('blocked face: window.open returning null fires the popup-blocked toast with exact copy', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Rules/ }));

    expect(openSpy).toHaveBeenCalledWith(RULES_URL, '_blank');
    const toast = toastNode();
    expect(toast).not.toBeNull();
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveTextContent(BLOCKED_COPY);
  });

  it('allowed face: window.open returning a tab handle launches untouched and shows NO toast', () => {
    const fakeTab = { focus: () => {} };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab);
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Rules/ }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(RULES_URL, '_blank');
    expect(toastNode()).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('auto-hides the blocked toast without interaction', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /Rules/ }));
    expect(toastNode()).not.toBeNull();

    await waitFor(() => expect(toastNode()).not.toBeInTheDocument(), { timeout: 3500 });
  });
});

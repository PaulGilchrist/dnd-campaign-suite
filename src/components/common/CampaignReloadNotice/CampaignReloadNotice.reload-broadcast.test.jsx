// @maintained-by-ai
/**
 * Regression contract for bug-admin-reload-broadcast-no-consumer.
 *
 * Admin rollback/upload/full-reset call reloadCampaign(), which publishes
 * `reload-<campaign>` with null data. Before the fix, nothing in src/
 * consumed that key: App.jsx's handleRuntimeEvent dropped every null-data
 * frame whose key was not `change-<campaign>-`, so non-initiating clients
 * silently kept serving pre-replace campaign data forever (live-proven two-
 * tab: NPC deleted by a rollback stayed listed; window.__noReload marker
 * survived; no toast/banner/console output).
 *
 * Locked behavior (CampaignReloadNotice, mounted app-wide by App.jsx, fed by
 * the shared SSE client exactly like useLog):
 *  - a `reload-<campaign>` frame (null data) surfaces the banner with Reload
 *    (window.location.reload) and Dismiss actions;
 *  - frames for OTHER campaigns and ordinary change-/log- traffic stay inert;
 *  - the initiating tab — the one holding the sessionStorage postRestoreNotice
 *    it wrote seconds before its own self-reload — never gets the banner;
 *  - Dismiss hides the banner until the next reload frame.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CampaignReloadNotice from './CampaignReloadNotice.jsx';
import { subscribeToSSE } from '../../../services/ui/sseClient.js';

vi.mock('../../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn(() => vi.fn()),
}));

let handlers;

// Invoke every SSE handler the component registered, as the shared client's
// onmessage fan-out would.
function emit(event) {
  return act(async () => {
    handlers.forEach((handler) => handler(event));
    await Promise.resolve();
  });
}

async function mount(campaignName = 'test-campaign') {
  handlers = [];
  subscribeToSSE.mockImplementation((_campaign, handler) => {
    handlers.push(handler);
    return vi.fn();
  });
  render(<CampaignReloadNotice campaignName={campaignName} />);
  await waitFor(() => expect(subscribeToSSE).toHaveBeenCalled());
}

describe('CampaignReloadNotice — reload-<campaign> SSE consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost', reload: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('renders nothing initially', async () => {
    await mount();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the banner when reload-<campaign> arrives with null data', async () => {
    await mount();

    await emit({ key: 'reload-test-campaign', data: null });

    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/replaced on the server/i);
  });

  it('Reload button reloads the page; Dismiss hides the banner until the next frame', async () => {
    await mount();

    await emit({ key: 'reload-test-campaign', data: null });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();

    // A later replace broadcasts the banner again.
    await emit({ key: 'reload-test-campaign', data: null });
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('stays silent for other campaigns and ordinary SSE traffic', async () => {
    await mount();

    await emit({ key: 'reload-frostfall', data: null });
    await emit({ key: 'change-test-campaign-targetEffects', data: [] });
    await emit({ key: 'log-test-campaign', data: { message: 'roll' } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('does not banner the initiating tab (sessionStorage postRestoreNotice present)', async () => {
    await mount();

    // The rollback handler stores the notice immediately before reload() —
    // the SSE fan-out can land in that window on the acting tab itself.
    sessionStorage.setItem(
      'postRestoreNotice',
      JSON.stringify({ campaign: 'test-campaign', restored: 'test-campaign-x.zip' }),
    );
    await emit({ key: 'reload-test-campaign', data: null });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('unsubscribes from the shared SSE client on unmount', async () => {
    const unsubscribe = vi.fn();
    handlers = [];
    subscribeToSSE.mockImplementation((_campaign, handler) => {
      handlers.push(handler);
      return unsubscribe;
    });
    const { unmount } = render(<CampaignReloadNotice campaignName="test-campaign" />);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

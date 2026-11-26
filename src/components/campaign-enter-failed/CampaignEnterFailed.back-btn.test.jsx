// @maintained-by-ai 2026-11-22
/**
 * CampaignEnterFailed escape-hatch pins (backlog TT 2026-11-22 follow-up):
 * the failure face must offer BOTH a Retry (re-runs the enter GET — pinned at
 * App level in src/App.enter-retry.test.jsx) and a secondary
 * `Back to Campaigns` ct-btn beside it, wired ONLY to the onBack prop — the
 * presentational card owns no transition state; App rides its ONE
 * back-to-selection lane (sidebar "Campaigns" seam) behind that callback.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CampaignEnterFailed from './CampaignEnterFailed.jsx';

function renderFace() {
  const onRetry = vi.fn();
  const onBack = vi.fn();
  render(
    <CampaignEnterFailed
      campaignName="test-campaign"
      onRetry={onRetry}
      onBack={onBack}
    />,
  );
  return { onRetry, onBack };
}

describe('CampaignEnterFailed Back to Campaigns affordance', () => {
  it('renders a secondary Back to Campaigns ct-btn beside Retry in the alert card', () => {
    renderFace();

    const face = document.querySelector('.campaign-enter-failed');
    expect(face).not.toBeNull();
    expect(face).toHaveAttribute('role', 'alert');

    const retry = screen.getByRole('button', { name: 'Retry' });
    const back = screen.getByRole('button', { name: 'Back to Campaigns' });
    expect(retry).toBeInTheDocument();
    expect(back).toBeInTheDocument();

    // Same card button-chrome family: plain ct-btn secondary (not primary).
    expect(back).toHaveClass('ct-btn');
    expect(back.className).not.toContain('ct-btn-primary');
    expect(back).toHaveClass('campaign-enter-failed-back-btn');

    // "Beside Retry": both live in the ONE actions row.
    expect(back.parentElement).toBe(retry.parentElement);
    expect(back.parentElement).toHaveClass('campaign-enter-failed-actions');
  });

  it('click routing: Back fires onBack only, Retry fires onRetry only', () => {
    const { onRetry, onBack } = renderFace();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Campaigns' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the honest copy and campaign name alongside the two-button row', () => {
    renderFace();
    expect(
      screen.getByText(/Could not load test-campaign\. The server did not answer the campaign data request\./),
    ).toBeInTheDocument();
  });
});

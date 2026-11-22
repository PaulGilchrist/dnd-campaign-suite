// @improved-by-ai

import './CampaignEnterFailed.css';

/**
 * Campaign-enter failure face (backlog TT 2026-11-22).
 *
 * The enter-seam change-data GET gates ALL campaign rendering, so a stalled
 * socket (or a fast 500 / network error) used to pin the tab on the
 * `Loading campaign...` face indefinitely — the deadlock's only escape was a
 * manual page reload. When App's enter lane hits its bounded wait or the GET
 * fails, the gate flips to THIS honest face instead: an alert-tier card
 * (global .ct-container / .ct-empty-state / .ct-btn idiom, mirroring the
 * MapUnavailable "Check Again" and ErrorBoundary reload-card patterns) whose
 * Retry button re-issues the enter GET in the SAME tab — no page reload — and
 * a secondary `Back to Campaigns` button escapes to campaign selection through
 * App's ONE back-to-selection lane (the sidebar "Campaigns" seam: closeWizards
 * + handleBackToCampaigns), also no reload, for when the server stays down.
 */
function CampaignEnterFailed({ campaignName, onRetry, onBack }) {
  return (
    <div className="campaign-enter-failed" role="alert">
      <div className="ct-container">
        <div className="ct-empty-state">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>
            Could not load {campaignName}. The server did not answer the campaign data request.
          </span>
          <div className="campaign-enter-failed-actions">
            <button
              type="button"
              className="ct-btn ct-btn-primary campaign-enter-failed-retry-btn"
              onClick={onRetry}
            >
              Retry
            </button>
            <button
              type="button"
              className="ct-btn campaign-enter-failed-back-btn"
              onClick={onBack}
            >
              Back to Campaigns
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignEnterFailed;

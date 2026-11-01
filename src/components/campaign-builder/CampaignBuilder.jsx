import { useState, useEffect, useCallback } from 'react';
import { DRAFT_KINDS, loadDrafts, approveDraft, rejectDraft, draftRowIdentity } from '../../services/campaign/draftActions.js';
import DraftFlag from '../common/DraftFlag.jsx';
import Subscriber from '../common/Subscriber.jsx';
import AiDesignerSection from './AiDesignerSection.jsx';
import './CampaignBuilder.css';

/** SSE channels whose events mean "a draft row may have changed": every
 * approve/reject goes through the kind's normal save/delete lane, and each
 * server route broadcasts `<kind>-list-<campaign>` for those mutations. */
const draftListKeys = campaignName =>
  new Set(DRAFT_KINDS.map(({ kind }) => `${kind}-list-${campaignName}`));

/** Kinds whose rows can carry story tie-ins worth surfacing during review. */
function rowTies(kind, row) {
  if (kind === 'encounters') {
    return (row.selectedMonsters || []).map(m => `${m.name} ×${m.qty}`);
  }
  if (kind === 'settlements') return row.notableNPCs || [];
  if (kind === 'sessions') {
    return Object.entries(row.links || {})
      .flatMap(([key, values]) => (values || []).map(v => `${key.replace(/s$/, '')}: ${v}`));
  }
  return [];
}

function DraftRow({ kind, row, busy, onApprove, onReject }) {
  const ties = rowTies(kind, row);
  const detail = row.description || row.summary || row.goals || '';
  return (
    <div className="campaign-builder-row">
      <div className="campaign-builder-row-main">
        <span className="campaign-builder-row-name">{row.name || row.displayName || row.fileName}</span>
        {/* Draft-review context: never surface lifecycle chips (an `active`
            quest status here is noise). Every row in this panel is a draft,
            so every kind gets the same shared draft badge in the status slot. */}
        <DraftFlag row={row} />
        {detail && <p className="campaign-builder-row-detail">{detail}</p>}
        {ties.length > 0 && (
          <div className="campaign-builder-row-ties" title="Story ties">
            {ties.map(tie => <span key={tie} className="campaign-builder-tie">{tie}</span>)}
          </div>
        )}
      </div>
      <div className="campaign-builder-row-actions">
        <button
          type="button"
          className="ct-btn ct-btn-primary"
          disabled={busy}
          onClick={() => onApprove(kind, row)}
          title="Approve — this becomes live campaign content"
        >
          <i className="fa-solid fa-check" /> Approve
        </button>
        <button
          type="button"
          className="ct-btn ct-btn-danger"
          disabled={busy}
          onClick={() => onReject(kind, row)}
          title="Reject — delete this draft"
        >
          <i className="fa-solid fa-trash" /> Reject
        </button>
      </div>
    </div>
  );
}

function CampaignBuilder({ campaignName }) {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // `keepError: true` marks SSE-triggered reloads (backlog 2026-11-01 AT:
  // approve-race banner self-erase). An action failure that 409s "was
  // modified in another tab — it was NOT saved" sets the banner right after
  // its own reload settles, but the other tab's `<kind>-list` broadcast lands
  // ~200ms later: a plain reload() started with setError(null) and erased the
  // message before the GM could read it. Row-sync reloads therefore leave the
  // banner untouched; it clears only on a user-initiated Refresh, the next
  // action, or a successful action (all of which reload without the flag).
  const reload = useCallback(async (options) => {
    if (!campaignName) return;
    setBusy(true);
    if (options?.keepError !== true) setError(null);
    try {
      setGroups(await loadDrafts(campaignName));
    } catch (err) {
      console.error('[CampaignBuilder] load failed:', err);
      setError(err.message || 'Failed to load drafts');
    } finally {
      setBusy(false);
    }
  }, [campaignName]);

  useEffect(() => { reload(); }, [reload]);

  const runAction = useCallback(async (action, kind, row) => {
    setBusy(true);
    setError(null);
    try {
      await action(campaignName, kind, row);
      await reload();
    } catch (err) {
      console.error(`[CampaignBuilder] ${kind} action failed:`, err);
      // Sync the list even after a FAILED action (bug-drafts-double-reject-
      // ghost-row): two GM tabs rejecting one draft — the loser's DELETE 404s
      // because the winner already removed the row server-side, and the
      // winner's `<kind>-list` broadcast lands inside this tab's busy window
      // and is skipped. Without this re-fetch the deleted row would linger as
      // a stale, fully-actionable ghost. reload() clears the banner itself,
      // so surface the failure message only after it settles.
      await reload();
      setError(err.message || 'Draft action failed');
      setBusy(false);
    }
  }, [campaignName, reload]);

  const approveAll = useCallback(async (kind, rows) => {
    // Sequential: uuid-array kinds (quests/factions) overwrite the whole list
    // per save — parallel saves would trip their concurrent-edit guards.
    for (const row of rows) {
      await runAction(approveDraft, kind, row);
    }
  }, [runAction]);

  // SSE handler (backlog drafts-panel-no-live-sync): another GM tab
  // approving/rejecting/creating a draft edits the entity behind this panel,
  // so any `<kind>-list-<campaign>` broadcast re-fetches the rows — the
  // Refresh button is no longer the only invalidation. Skipped while this
  // tab has an action in flight (runAction reloads when it completes — on
  // both the success and the failure path — and a concurrent
  // reload would race its busy flag). Mirrors Settlements.jsx /
  // Notes.jsx via the shared Subscriber (one EventSource per campaign).
  const handleSSEEvent = useCallback((event) => {
    if (!event || !draftListKeys(campaignName).has(event.key)) return;
    if (busy) return;
    // keepError: syncing rows must never erase an unread action-error banner.
    reload({ keepError: true });
  }, [campaignName, busy, reload]);

  const subscriber = <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />;

  if (!groups) {
    return (
      <div className="ct-container campaign-builder">
        {subscriber}
        {error && <div className="campaign-builder-error" role="alert">{error}</div>}
        <p>{busy ? 'Loading drafts…' : 'No AI drafts to review.'}</p>
        {!busy && !error && (
          <button type="button" className="ct-btn" onClick={() => reload()}>
            <i className="fa-solid fa-rotate" /> Refresh
          </button>
        )}
      </div>
    );
  }

  const total = Object.values(groups).reduce((sum, rows) => sum + rows.length, 0);

  return (
    // ct-container is load-bearing: App.css scopes the whole .ct-btn canon
    // under it (backlog drafts-panel-contrast-family — without it these
    // buttons fell to base UA styling and the disabled state was illegible).
    <div className="ct-container campaign-builder">
      {subscriber}
      <AiDesignerSection campaignName={campaignName} onGenerated={reload} />
      <div className="campaign-builder-header">
        <h2><i className="fa-solid fa-wand-magic-sparkles" /> Campaign Builder</h2>
        <p className="campaign-builder-subtitle">
          AI-drafted content — invisible to players until you approve it.
        </p>
        <div className="campaign-builder-header-actions">
          <button type="button" className="ct-btn" onClick={() => reload()} disabled={busy}>
            <i className="fa-solid fa-rotate" /> Refresh
          </button>
          {total > 0 && (
            <button
              type="button"
              className="ct-btn ct-btn-primary"
              disabled={busy}
              onClick={() => Object.entries(groups).forEach(([kind, rows]) => approveAll(kind, rows))}
            >
              <i className="fa-solid fa-check-double" /> Approve all ({total})
            </button>
          )}
        </div>
      </div>

      {error && <div className="campaign-builder-error" role="alert">{error}</div>}

      {total === 0 ? (
        <p className="campaign-builder-empty">
          Nothing is drafted right now — generate content with the AI designer and it will
          land here for review before any player can see it.
        </p>
      ) : (
        DRAFT_KINDS.filter(({ kind }) => groups[kind]?.length).map(({ kind, label, icon }) => (
          <section key={kind} className="campaign-builder-section">
            <h3>
              <i className={`fa-solid ${icon}`} /> {label}
              <span className="campaign-builder-count">{groups[kind].length}</span>
              <button
                type="button"
                className="ct-btn"
                disabled={busy}
                onClick={() => approveAll(kind, groups[kind])}
              >
                Approve all {label.toLowerCase()}
              </button>
            </h3>
            {groups[kind].map(row => (
              <DraftRow
                key={draftRowIdentity(row)}
                kind={kind}
                row={row}
                busy={busy}
                onApprove={(k, r) => runAction(approveDraft, k, r)}
                onReject={(k, r) => runAction(rejectDraft, k, r)}
              />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

export default CampaignBuilder;

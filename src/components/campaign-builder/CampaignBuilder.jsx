import { useState, useEffect, useCallback } from 'react';
import { DRAFT_KINDS, loadDrafts, approveDraft, rejectDraft, draftRowIdentity } from '../../services/campaign/draftActions.js';
import DraftFlag from '../common/DraftFlag.jsx';
import DeleteConfirmModal from '../common/DeleteConfirmModal.jsx';
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

// Display name of a draft row — same fallback chain DraftRow renders, so a
// banner names rows exactly as the GM sees them.
const rowDisplayName = row => row.name || row.displayName || row.fileName || 'Draft row';

/** Reject gate over the shared DeleteConfirmModal role="dialog" tier — the
 * same a11y family the maps-manager row Delete, sessions lane, and Initiative
 * Clear migrated to (backlog 2026-11-13 ZC: Reject used to be a silent
 * one-click destroy of the drafted row). The prompt names the draft and states
 * the row is destroyed; the confirm label follows the maps-manager delete
 * precedent ("Yes, Delete Permanently"). Cancel/dismiss writes NOTHING — the
 * delete only ever runs from onConfirm. */
function RejectDraftModal({ row, onCancel, onConfirm }) {
  return (
    <DeleteConfirmModal
      titleId="campaign-builder-reject-title"
      title="Reject Draft"
      confirmLabel="Yes, Delete Permanently"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      This will permanently reject the AI draft &apos;<strong>{rowDisplayName(row)}</strong>
      &apos; — the drafted row is destroyed. It never went live, and this{' '}
      <strong>cannot be undone</strong> (recoverable only from the AI designer&apos;s
      restore-point snapshot).
    </DeleteConfirmModal>
  );
}

/** The verbatim 404 copy the entity CRUD lanes answer with when the row is
 * already gone (server/utils/jsonEntityCrud.js `${singular} not found` plus
 * the encounters/sessions/maps routes) — i.e. a double-decision race the OTHER
 * GM tab won: its approve promoted/re-stamped the row or its reject deleted it
 * before this tab's write landed. Mirror the planner conflict family instead of
 * resurfacing the raw server string: name the draft, state the list refreshed
 * (runAction re-fetches before this mapping runs). Any other failure message
 * (500s, validation, name-law refusals) passes through untouched. */
const DRAFT_NOT_FOUND = /^(?:NPC|Faction|Quest|Settlement|Session|Encounter|Map) not found$/i;

const draftActionErrorMessage = (err, row) => {
  const message = err?.message || 'Draft action failed';
  if (DRAFT_NOT_FOUND.test(message.trim())) {
    return `Draft "${rowDisplayName(row)}" was approved or removed in another tab ` +
      'or session since you loaded it — the drafts list has already refreshed — ' +
      'nothing to do here.';
  }
  return message;
};

function CampaignBuilder({ campaignName }) {
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Draft awaiting a Reject confirmation ({ kind, row }) — non-null arms the
  // shared DeleteConfirmModal gate; only the modal's confirm reaches
  // runAction(rejectDraft, …), cancel/dismiss clears it with zero writes.
  const [pendingReject, setPendingReject] = useState(null);

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

  // `options.deferError` marks a step inside an "Approve all" batch (backlog
  // 2026-11-01 AU: mid-loop failures go invisible). The batch is ONE gesture,
  // so a row-k 409 must not flash and then be erased by row-k+1's opening
  // setError(null) — deferred failures are returned to approveAll, which
  // surfaces them as one accumulated banner after the loop. Single-row calls
  // keep the e1f282a42 contract: banner set only after the error-path reload
  // settles (ghost-row re-fetch survives), cleared by the next plain reload.
  const runAction = useCallback(async (action, kind, row, options) => {
    setBusy(true);
    if (options?.deferError !== true) setError(null);
    try {
      await action(campaignName, kind, row);
      await reload();
      return null;
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
      const message = draftActionErrorMessage(err, row);
      if (options?.deferError === true) return message;
      setError(message);
      setBusy(false);
      return message;
    }
  }, [campaignName, reload]);

  const approveAll = useCallback(async (kind, rows) => {
    // Gesture boundary: a fresh batch replaces any previous banner (the old
    // per-row clear lived in runAction; deferred steps don't touch it).
    setError(null);
    // Sequential: uuid-array kinds (quests/factions) overwrite the whole list
    // per save — parallel saves would trip their concurrent-edit guards.
    const failures = [];
    for (const row of rows) {
      const message = await runAction(approveDraft, kind, row, { deferError: true });
      if (message) failures.push(`“${rowDisplayName(row)}”: ${message}`);
    }
    if (failures.length > 0) {
      // Accumulate (functional set): the header "Approve all (n)" fires one
      // approveAll per kind concurrently — later kinds must not overwrite an
      // earlier kind's failures.
      const batch = `${failures.length} of ${rows.length} ${kind} rows failed — they were NOT saved: ${failures.join('; ')}`;
      setError(prev => (prev ? `${prev} ${batch}` : batch));
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
                onReject={(k, r) => setPendingReject({ kind: k, row: r })}
              />
            ))}
          </section>
        ))
      )}

      {pendingReject && (
        <RejectDraftModal
          row={pendingReject.row}
          onCancel={() => setPendingReject(null)}
          onConfirm={() => {
            const { kind, row } = pendingReject;
            setPendingReject(null);
            runAction(rejectDraft, kind, row);
          }}
        />
      )}
    </div>
  );
}

export default CampaignBuilder;

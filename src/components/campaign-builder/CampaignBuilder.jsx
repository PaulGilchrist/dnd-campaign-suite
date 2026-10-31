import { useState, useEffect, useCallback } from 'react';
import { DRAFT_KINDS, loadDrafts, approveDraft, rejectDraft, draftRowIdentity } from '../../services/campaign/draftActions.js';
import AiDesignerSection from './AiDesignerSection.jsx';
import './CampaignBuilder.css';

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
        {row.status && <span className="campaign-builder-row-status">{row.status}</span>}
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

  const reload = useCallback(async () => {
    if (!campaignName) return;
    setBusy(true);
    setError(null);
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

  if (!groups) {
    return (
      <div className="campaign-builder">
        {error && <div className="campaign-builder-error" role="alert">{error}</div>}
        <p>{busy ? 'Loading drafts…' : 'No AI drafts to review.'}</p>
        {!busy && !error && (
          <button type="button" className="ct-btn" onClick={reload}>
            <i className="fa-solid fa-rotate" /> Refresh
          </button>
        )}
      </div>
    );
  }

  const total = Object.values(groups).reduce((sum, rows) => sum + rows.length, 0);

  return (
    <div className="campaign-builder">
      <AiDesignerSection campaignName={campaignName} onGenerated={reload} />
      <div className="campaign-builder-header">
        <h2><i className="fa-solid fa-wand-magic-sparkles" /> Campaign Builder</h2>
        <p className="campaign-builder-subtitle">
          AI-drafted content — invisible to players until you approve it.
        </p>
        <div className="campaign-builder-header-actions">
          <button type="button" className="ct-btn" onClick={reload} disabled={busy}>
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

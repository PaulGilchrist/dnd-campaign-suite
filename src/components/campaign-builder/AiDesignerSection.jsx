import { useState, useEffect, useRef } from 'react';
import { getAiStatus, loadDesignerConversation, saveDesignerPendingPlan, designerChat, designerPlan, designerGenerate } from '../../services/ai/aiClient.js';
import './AiDesignerSection.css';

const PLAN_KINDS = ['faction', 'settlement', 'npc', 'quest', 'encounter', 'session', 'mapPlan'];

// network/save debounce — coalesce per-keystroke plan edits into one pending-plan POST
const PLAN_SAVE_DEBOUNCE_MS = 400;

function PlanEditor({ plan, setPlan, busy, onGenerate, onCancel }) {
  const setCount = (kind, value) => {
    const list = plan.entityPlan || [];
    const existing = list.find(p => p.kind === kind);
    const next = existing
      ? list.map(p => (p.kind === kind ? { ...p, count: Number(value) || 0 } : p))
      : [...list, { kind, count: Number(value) || 0 }];
    setPlan({ ...plan, entityPlan: next });
  };
  const countFor = (kind) => (plan.entityPlan || []).find(p => p.kind === kind)?.count ?? 0;

  return (
    <div className="ai-designer-plan">
      <h4>Review the build plan</h4>
      <label className="ai-designer-plan-field">
        Scope
        <select value={plan.scope} onChange={(e) => setPlan({ ...plan, scope: e.target.value })}>
          {['campaign', 'one_shot', 'arc', 'session', 'bespoke'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="ai-designer-plan-field">
        Levels (min)
        <input type="number" min="1" max="20" value={plan.levelRange?.min ?? ''}
          onChange={(e) => setPlan({ ...plan, levelRange: { ...(plan.levelRange || {}), min: Number(e.target.value) || 1, max: plan.levelRange?.max ?? (Number(e.target.value) || 1) } })} />
      </label>
      <label className="ai-designer-plan-field">
        Levels (max)
        <input type="number" min="1" max="20" value={plan.levelRange?.max ?? ''}
          onChange={(e) => setPlan({ ...plan, levelRange: { min: plan.levelRange?.min ?? 1, max: Number(e.target.value) || 1 } })} />
      </label>
      <label className="ai-designer-plan-field ai-designer-plan-summary">
        Story spine
        <textarea rows="5" value={plan.storySummary || ''} onChange={(e) => setPlan({ ...plan, storySummary: e.target.value })} />
      </label>
      <div className="ai-designer-plan-counts">
        {PLAN_KINDS.map(kind => (
          <label key={kind} className="ai-designer-plan-field">
            {kind}s
            <input type="number" min="0" max="50" value={countFor(kind)} onChange={(e) => setCount(kind, e.target.value)} />
          </label>
        ))}
      </div>
      <div className="ai-designer-plan-actions">
        <button type="button" className="ct-btn ct-btn-primary" disabled={busy} onClick={() => onGenerate(plan)}>
          <i className="fa-solid fa-wand-magic-sparkles" /> {busy ? 'Drafting… (local models can take a while)' : 'Generate drafts'}
        </button>
        <button type="button" className="ct-btn" disabled={busy} onClick={onCancel}
          title="Discard this plan and return to chat">Back to chat</button>
      </div>
      <p className="ai-designer-note">Everything generated lands as a draft below, invisible to players until you approve it.</p>
    </div>
  );
}

function AiDesignerSection({ campaignName, onGenerated }) {
  const [enabled, setEnabled] = useState(null); // null = probing
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const threadEnd = useRef(null);
  const saveTimerRef = useRef(null); // debounce handle (network only — the server holds the truth)
  const stagedPlanRef = useRef(null); // latest plan edit not yet POSTed to design-notes

  const stopPlanDebounce = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    stagedPlanRef.current = null;
  };

  // GM edits (counts/scope/levels/spine) persist to design-notes so view
  // navigation and page reloads restore the PlanEditor verbatim.
  const editPlan = (next) => {
    setPlan(next);
    stagedPlanRef.current = next;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { // network/save debounce tick — flush latest plan POST
      saveTimerRef.current = null;
      stagedPlanRef.current = null;
      saveDesignerPendingPlan({ campaignName, scope: next })
        .catch(err => console.error('[ai-designer] pending plan save failed', err));
    }, PLAN_SAVE_DEBOUNCE_MS);
  };

  const clearPendingPlan = () => {
    stopPlanDebounce();
    setPlan(null);
    saveDesignerPendingPlan({ campaignName, scope: null })
      .catch(err => console.error('[ai-designer] pending plan clear failed', err));
  };

  useEffect(() => {
    let cancelled = false;
    // Clean slate per campaign — never bleed a previous campaign's plan/error.
    setMessages([]);
    setPlan(null);
    setError(null);
    setResult(null);
    (async () => {
      try {
        const status = await getAiStatus(campaignName);
        if (cancelled) return;
        setEnabled(!!status.configured);
        if (status.configured) {
          const notes = await loadDesignerConversation({ campaignName });
          if (cancelled) return;
          setMessages(notes.messages || []);
          if (notes.pendingPlan) setPlan(notes.pendingPlan);
          if (notes.lastError?.error) setError(notes.lastError.error);
        }
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
      // Flushing on unmount is what makes "navigate away" lossless.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (stagedPlanRef.current) {
          saveDesignerPendingPlan({ campaignName, scope: stagedPlanRef.current })
            .catch(err => console.error('[ai-designer] pending plan flush failed', err));
        }
      }
      stagedPlanRef.current = null;
    };
  }, [campaignName]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages]);

  const send = async () => {
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setMessages(prev => [...prev, { role: 'gm', content: message }]);
    setDraft('');
    const res = await designerChat({ campaignName, message });
    if (res.ok) setMessages(prev => [...prev, { role: 'ai', content: res.reply }]);
    else setError(res.error || res.code || 'designer chat failed');
    setBusy(false);
  };

  const proposePlan = async () => {
    stopPlanDebounce(); // a fresh proposal replaces any half-edited plan
    setBusy(true);
    setError(null);
    const res = await designerPlan({ campaignName });
    if (res.ok) setPlan(res.scope); // route already persisted it as the pending plan
    else setError(res.error || res.code || 'plan request failed');
    setBusy(false);
  };

  const generate = async (confirmedScope) => {
    const hadUnsaved = saveTimerRef.current !== null || stagedPlanRef.current !== null;
    stopPlanDebounce();
    setBusy(true);
    setError(null);
    // Make sure the exact scope we are generating from is what the server holds.
    if (hadUnsaved) {
      await saveDesignerPendingPlan({ campaignName, scope: confirmedScope })
        .catch(err => console.error('[ai-designer] pending plan flush failed', err));
    }
    const res = await designerGenerate({ campaignName, scope: confirmedScope });
    setBusy(false);
    if (res.ok) {
      setResult(res);
      setPlan(null); // route cleared the server-side pending — plan consumed
      onGenerated?.();
    } else {
      setError((res.errors || [res.error || res.code || 'generation failed']).join('\n'));
    }
  };

  if (enabled === null) return null;
  if (!enabled) {
    return (
      <div className="ai-designer-section ai-designer-off">
        <i className="fa-solid fa-robot" /> The AI designer follows the referee model — configure AI in Admin to collaborate on content.
      </div>
    );
  }

  return (
    <div className="ai-designer-section">
      <h3><i className="fa-solid fa-wand-magic-sparkles" /> AI Designer</h3>
      {error && <div className="ai-designer-error" role="alert">{error}</div>}
      {result && (
        <div className="ai-designer-result">
          Drafted {Object.values(result.created).reduce((a, b) => a + b, 0)} entities
          {result.created?.maps ? ` (incl. ${result.created.maps} map${result.created.maps === 1 ? '' : 's'})` : ''}
          — restore point <code>{result.snapshot}</code>. Review them below.
        </div>
      )}

      {plan ? (
        <PlanEditor plan={plan} setPlan={editPlan} busy={busy} onGenerate={generate} onCancel={clearPendingPlan} />
      ) : (
        <>
          <div className="ai-designer-thread">
            {messages.length === 0 && (
              <p className="ai-designer-empty">Tell the AI your story ideas — a whole campaign, an arc for the next few levels, or prep for the next session. It reads the current campaign before answering.</p>
            )}
            {messages.map((m, i) => (
              <div key={`${m.at ?? i}-${m.role}-${i}`} className={`ai-designer-msg ai-designer-msg-${m.role === 'gm' ? 'gm' : 'ai'}`}>
                <span className="ai-designer-msg-who">{m.role === 'gm' ? 'GM' : 'Designer'}</span>
                <span className="ai-designer-msg-text">{m.content}</span>
              </div>
            ))}
            <div ref={threadEnd} />
          </div>
          <div className="ai-designer-composer">
            <textarea
              rows="2"
              value={draft}
              placeholder="What are we building?"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
            />
            <button type="button" className="ct-btn ct-btn-primary" disabled={busy || !draft.trim()} onClick={send}>
              <i className="fa-solid fa-paper-plane" /> Send
            </button>
            <button type="button" className="ct-btn" disabled={busy || messages.length === 0} onClick={proposePlan}
              title="Turn the conversation into an editable build plan">
              <i className="fa-solid fa-list-check" /> Propose build plan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AiDesignerSection;

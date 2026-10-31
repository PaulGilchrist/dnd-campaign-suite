import { useState } from 'react';
import { isEqual } from 'lodash';
import { refineEntity } from '../../services/ai/aiClient.js';
import './AiRefineButton.css';

// Server-owned stamps never round-trip in a proposal — the same strip the
// server refine preflight applies to the input before validating it.
const SERVER_OWNED_KEYS = ['id', 'updatedAt', 'savedAt', 'draft'];

/**
 * Backlog refine-no-op-silent: a success whose replacement echoes the input
 * must not close the row looking like an applied change. No-change holds when
 * every field the proposal offers back matches the current input AND the
 * proposal doesn't drop a field the GM actually filled in (that WOULD alter
 * the form via setFormData). Server-owned keys and empty inputs are exempt.
 */
function proposedNoChange(entity, replacement) {
  if (!replacement || typeof replacement !== 'object') return false;
  const current = Object.fromEntries(Object.entries(entity || {})
    .filter(([key]) => !SERVER_OWNED_KEYS.includes(key)));
  const keys = Object.keys(replacement);
  return keys.every((key) => isEqual(replacement[key], current[key]))
    && Object.keys(current).every((key) => keys.includes(key)
      || current[key] === '' || current[key] === null || current[key] === undefined);
}

/**
 * AI Campaign Authoring (plan Phase 6) — the "AI button" on one object.
 * The GM describes the change; the model returns a complete replacement the
 * CALLER drops into its editor form. Nothing is saved here: the GM still
 * presses the editor's own save, so the normal lane (stamps, 409 guards,
 * broadcasts) stays the only path to disk.
 */
function AiRefineButton({ campaignName, kind, entity, onReplaced }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const close = () => { setOpen(false); setError(null); setNotice(null); };

  const ask = async () => {
    const text = instruction.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await refineEntity({ campaignName, kind, entity, instruction: text });
    setBusy(false);
    if (res.ok && proposedNoChange(entity, res.replacement)) {
      // Echo: keep the row open with an honest hint — nothing was applied,
      // so the caller's applied-success affordances must NOT fire.
      setNotice('The model proposed no changes — the form is unchanged.');
      setInstruction('');
    } else if (res.ok) {
      onReplaced(res.replacement);
      setOpen(false);
      setInstruction('');
    } else {
      setError((res.errors || [res.error || res.code || 'refine failed']).join(' · '));
    }
  };

  if (!open) {
    return (
      <button type="button" className="ct-btn" onClick={() => setOpen(true)}
        title="Describe a change and let the AI rewrite this object (you still choose to save)">
        <i className="fa-solid fa-wand-magic-sparkles" /> Refine with AI
      </button>
    );
  }

  return (
    <div className="ai-refine-row">
      <input
        type="text"
        autoFocus
        placeholder="What should change? e.g. “make him a reluctant cult spy”"
        value={instruction}
        disabled={busy}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') ask(); }}
      />
      <button type="button" className="ct-btn ct-btn-primary" disabled={busy || !instruction.trim()} onClick={ask}>
        <i className="fa-solid fa-wand-magic-sparkles" /> {busy ? 'Thinking…' : 'Apply to form'}
      </button>
      <button type="button" className="ct-btn" disabled={busy} aria-label="Close AI refine" onClick={close}>
        <i className="fa-solid fa-times" />
      </button>
      {error && <p className="ai-refine-error" role="alert">{error}</p>}
      {notice && <p className="ai-refine-notice" role="status">{notice}</p>}
    </div>
  );
}

export default AiRefineButton;

import { useState } from 'react';
import { refineEntity } from '../../services/ai/aiClient.js';
import './AiRefineButton.css';

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

  const ask = async () => {
    const text = instruction.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const res = await refineEntity({ campaignName, kind, entity, instruction: text });
    setBusy(false);
    if (res.ok) {
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
      <button type="button" className="ct-btn" disabled={busy} aria-label="Close AI refine" onClick={() => { setOpen(false); setError(null); }}>
        <i className="fa-solid fa-times" />
      </button>
      {error && <p className="ai-refine-error" role="alert">{error}</p>}
    </div>
  );
}

export default AiRefineButton;

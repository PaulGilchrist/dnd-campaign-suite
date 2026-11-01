import { useState } from 'react';
import { isEqual } from 'lodash';
import { refineEntity } from '../../services/ai/aiClient.js';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import AiInstructionModal from './AiInstructionModal.jsx';
import './AiRefineButton.css';

// Server-owned stamps never round-trip in a proposal — the same strip the
// server refine preflight applies to the input before validating it.
const SERVER_OWNED_KEYS = ['id', 'updatedAt', 'savedAt', 'draft'];

const NO_CHANGE_NOTICE = 'The model proposed no changes — the form is unchanged.';

// Backlog refine-no-op-grammar-hint: on this backend family (oMLX Qwen-mtp,
// docs/app-exploration.md Depth Seeds) Decoding = "on" (aiConfig.jsonSchema
// === true, forced grammar) commonly makes the model echo the input verbatim.
// Shown ONLY when the stored config says so — otherwise we can't attribute a
// cause and stay honest with the base sentence alone.
const GRAMMAR_ECHO_HINT = ' If Decoding is set to "on" (a forced JSON grammar),'
  + ' this backend family commonly makes the model echo the input verbatim —'
  + ' try setting Decoding to "probe" (or "off") in the campaign admin’s AI'
  + ' config row and retry.';

/**
 * Backlog refine-no-op-silent: a success whose replacement echoes the input
 * must not close the prompt looking like an applied change. No-change holds
 * when every field the proposal offers back matches the current input AND
 * the proposal doesn't drop a field the GM actually filled in (that WOULD
 * alter the form via setFormData). Server-owned keys and empty inputs are
 * exempt.
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
 *
 * Backlog ai-instruction-inputs-undersized (owner ruling): the instruction
 * surface is a small modal with a 4-row auto-growing textarea — long asks
 * stay readable, and the old single-line row no longer crowds the host
 * editor's footer. All lanes are unchanged: apply-to-form, the no-change
 * notice (modal stays open with the hint), the error strip, and the
 * non-dismissible-while-busy × (aria-label "Close AI refine").
 */
function AiRefineButton({ campaignName, kind, entity, onReplaced }) {
  const aiConfig = useRuntimeValue('campaign', 'aiConfig', campaignName);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // 'echo' | 'echo-grammar' | null

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
      // Echo: keep the modal open with an honest hint — nothing was applied,
      // so the caller's applied-success affordances must NOT fire. With the
      // stored config forcing a grammar (Decoding "on"), name the usual cause.
      setNotice(aiConfig?.jsonSchema === true ? 'echo-grammar' : 'echo');
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
    <AiInstructionModal title={`Refine ${kind} with AI`} closeLabel="Close AI refine"
      busy={busy} onClose={close}>
      <label className="ai-instruction-field">
        Instruction
        <textarea
          className="ai-instruction-input"
          rows="4"
          autoFocus
          placeholder="What should change? e.g. “make him a reluctant cult spy — he keeps a ledger of the offerings”"
          value={instruction}
          disabled={busy}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(); }}
        />
      </label>
      <p className="ai-instruction-hint">⌘/Ctrl+Enter applies the proposal to the form — nothing is saved until you press the editor’s Save.</p>
      {error && <p className="ai-refine-error" role="alert">{error}</p>}
      {notice && (
        <p className="ai-refine-notice" role="status">
          {NO_CHANGE_NOTICE}
          {notice === 'echo-grammar' && <span className="ai-instruction-hint">{GRAMMAR_ECHO_HINT}</span>}
        </p>
      )}
      <div className="ai-instruction-actions">
        <button type="button" className="ct-btn ct-btn-primary" disabled={busy || !instruction.trim()} onClick={ask}>
          <i className="fa-solid fa-wand-magic-sparkles" /> {busy ? 'Thinking…' : 'Apply to form'}
        </button>
      </div>
    </AiInstructionModal>
  );
}

export default AiRefineButton;

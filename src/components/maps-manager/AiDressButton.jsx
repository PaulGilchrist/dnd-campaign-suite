import { useState } from 'react';
import { dressMapProposal } from '../../services/ai/aiClient.js';
import { saveMapData } from '../../services/maps/mapsService.js';
import { addEntry } from '../../services/ui/logService.js';
import './AiDressButton.css';

/**
 * AI Campaign Authoring (residual item 2) — "AI Dress" on a MapsManager row.
 * Proposal-first end to end: instruction → the server validates every in-place
 * op against the LIVE document (all-or-nothing) → the GM reads a human op
 * preview → Apply saves the pre-validated merged document through the NORMAL
 * map PUT lane (draft maps keep their draft flag). Walls, paint, fog and
 * image layers are untouchable — the op set has no verbs for them. Nothing
 * reaches disk without this button's second click.
 */
function failureText(res) {
  return (res.errors || [res.error || res.code || 'dress failed']).join(' · ');
}

function AiDressAsk({ instruction, setInstruction, busy, onAsk }) {
  return (
    <>
      <input
        type="text"
        autoFocus
        placeholder="How should this map change? e.g. “add a trapped chest guarding the throne room”"
        value={instruction}
        disabled={busy}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onAsk(); }}
      />
      <button type="button" className="ct-btn ct-btn-primary" disabled={busy || !instruction.trim()} onClick={onAsk}>
        <i className="fa-solid fa-wand-magic-sparkles" /> {busy ? 'Thinking…' : 'Dress map'}
      </button>
    </>
  );
}

function AiDressPreview({ proposal, busy, onApply }) {
  return (
    <div className="ai-dress-preview">
      <p className="ai-dress-preview-title">Proposed changes — nothing is saved yet:</p>
      <ul>
        {proposal.preview.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
      </ul>
      <button type="button" className="ct-btn ct-btn-primary" disabled={busy} onClick={onApply}>
        <i className="fa-solid fa-floppy-disk" /> {busy ? 'Saving…' : 'Apply to map'}
      </button>
    </div>
  );
}

function AiDressButton({ campaignName, map }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [proposal, setProposal] = useState(null);
  const mapKey = map.slug || map.fileName;

  const close = () => { setOpen(false); setProposal(null); setError(null); setInstruction(''); };

  const ask = async () => {
    const text = instruction.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const res = await dressMapProposal({ campaignName, mapName: mapKey, instruction: text });
    setBusy(false);
    if (res.ok) { setProposal(res); return; }
    setError(failureText(res));
  };

  // The GM's Apply IS the confirmation gate — and it rides the ordinary map
  // save lane (broadcasts, guards, disk semantics all unchanged), then logs
  // the applied dressing to the campaign log like every other mutation.
  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveMapData(campaignName, mapKey, proposal.updated);
      await addEntry(campaignName, { type: 'ai_dress', action: 'applied', name: 'AI dress', map: proposal.map, ops: proposal.ops.length });
      close();
    } catch (err) {
      setError(String(err?.message || 'Failed to save the dressed map'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="ct-btn ai-dress-open-btn" onClick={() => setOpen(true)}
        aria-label={`Dress "${map.name}" with AI`}
        title="Dress this map with AI in-place ops (you preview and apply — nothing saves silently)">
        <i className="fa-solid fa-wand-magic-sparkles" /> AI Dress
      </button>
    );
  }

  return (
    <div className="ai-dress-row">
      {proposal
        ? <AiDressPreview proposal={proposal} busy={busy} onApply={apply} />
        : <AiDressAsk instruction={instruction} setInstruction={setInstruction} busy={busy} onAsk={ask} />}
      <button type="button" className="ct-btn" disabled={busy} aria-label="Close AI dress" onClick={close}>
        <i className="fa-solid fa-times" />
      </button>
      {error && <p className="ai-dress-error" role="alert">{error}</p>}
    </div>
  );
}

export default AiDressButton;

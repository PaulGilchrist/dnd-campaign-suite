import { useEffect, useState } from 'react';
import { dressMapProposal } from '../../services/ai/aiClient.js';
import { dressStructureNotice } from '../../services/ai/dressCapabilities.js';
import { saveMapData } from '../../services/maps/mapsService.js';
import { addEntry } from '../../services/ui/logService.js';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import AiInstructionModal from '../common/AiInstructionModal.jsx';
import './AiDressButton.css';

/**
 * AI Campaign Authoring (residual item 2) — "AI Dress": instruction → the
 * server validates every in-place op against the LIVE document (all-or-
 * nothing) → the GM reads a human op preview → Apply saves the pre-validated
 * merged document through the NORMAL map PUT lane (draft maps keep their
 * draft flag). Walls, paint, fog and image layers are untouchable — the op
 * set has no verbs for them. Nothing reaches disk without Apply.
 *
 * Backlog ai-instruction-inputs-undersized (owner ruling): the ask and its
 * preview now live in a small modal with a 4-row auto-growing textarea sized
 * for the server's 2000-char instruction, instead of a 22px-high single-line
 * input wedged into the list row. Propose→preview→Apply, the busy lane and
 * the error strip are unchanged.
 *
 * Backlog ai-dress-belongs-in-map-view (owner ruling): TWO mounts, ONE
 * component — no logic fork:
 *   mount="list" (default) — MapsManager row shortcut: centered modal, the
 *     plain text preview only (there is no grid behind it to preview on).
 *   mount="map" — the open map view's toolbar: the modal docks to the right
 *     (`.ai-instruction-overlay-dock`) so the GM reads the grid while typing,
 *     and every proposed/cleared op list is mirrored out through
 *     `onProposalChange(ops|null)` so the host can paint the overlay preview
 *     (DressPreviewOverlay) on its canvas. Close/Apply/3D-switch/unmount
 *     pushes null — the preview vanishes with zero residue.
 * Ask, Apply, the log pair and the error lane behave identically at both.
 *
 * Backlog (2026-11-12 WY) ai-dress-hides-vocabulary: the ask form states the
 * capability vocabulary UP FRONT (item/furniture ops only — prop sprites like
 * doors and stairs ARE served; real walls/paint/fog layers are not, and the
 * server refuses wall-named item TYPES fail-closed after the wall-as-item
 * bug), and the preview shows an honest sentinel when a structure-implied
 * ask came back items-only, so "why did the walls vanish?" is never a silent
 * surprise. The sentinel gate also reads item nouns, so it can never
 * contradict `add wall at x,y` preview lines. The dress cycle is untouched:
 * propose → preview → Apply.
 */
function failureText(res) {
  return (res.errors || [res.error || res.code || 'dress failed']).join(' · ');
}

function AiDressAsk({ instruction, setInstruction, busy, aiLive, onAsk }) {
  return (
    <>
      {!aiLive && (
        <p className="ai-instruction-hint" role="status">
          <i className="fa-solid fa-circle-info" /> AI is not enabled for this campaign —
          configure it in Campaign Admin → AI Referee, then reopen this dialog.
        </p>
      )}
      <label className="ai-instruction-field">
        Instruction
        <textarea
          className="ai-instruction-input"
          rows="4"
          autoFocus
          placeholder="How should this map change? e.g. “add a trapped chest guarding the throne room, then line the gallery with banners”"
          value={instruction}
          disabled={busy}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onAsk(); }}
        />
      </label>
      <p className="ai-instruction-hint">
        <i className="fa-solid fa-circle-info" /> Dress supports item-level operations only —
        props, furniture, POIs and tokens (tables, chairs, chests, prop doors…). It cannot add,
        move or remove real walls, paint or fog — the structural map layers.
      </p>
      <p className="ai-instruction-hint">⌘/Ctrl+Enter proposes — nothing saves until you preview and Apply.</p>
      <div className="ai-instruction-actions">
        <button type="button" className="ct-btn ct-btn-primary" disabled={busy || !aiLive || !instruction.trim()} onClick={onAsk}>
          <i className="fa-solid fa-wand-magic-sparkles" /> {busy ? 'Thinking…' : 'Dress map'}
        </button>
      </div>
    </>
  );
}

function AiDressPreview({ proposal, instruction, busy, onApply, docked }) {
  const structureNotice = dressStructureNotice(instruction, proposal);
  return (
    <div className="ai-dress-preview">
      <p className="ai-dress-preview-title">Proposed changes — nothing is saved yet:</p>
      <ul>
        {proposal.preview.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
      </ul>
      {structureNotice && (
        <p className="ai-dress-notice" role="status">
          <i className="fa-solid fa-circle-info" /> {structureNotice}
        </p>
      )}
      {docked && (
        <p className="ai-dress-preview-hint">
          <i className="fa-solid fa-crosshairs" /> Markers show on the map — read them against the grid before applying.
        </p>
      )}
      <div className="ai-instruction-actions">
        <button type="button" className="ct-btn ct-btn-primary" disabled={busy} onClick={onApply}>
          <i className="fa-solid fa-floppy-disk" /> {busy ? 'Saving…' : 'Apply to map'}
        </button>
      </div>
    </div>
  );
}

function AiDressButton({ campaignName, map, mount = 'list', onProposalChange }) {
  const aiConfig = useRuntimeValue('campaign', 'aiConfig', campaignName);
  // Backlog (2026-11-05 CX) no-config-path-POSTs-before-telling: gate on the
  // SAME aiConfig lane the referee surfaces use (AiRefereeSection: `mode &&
  // mode !== 'off'`). Unset/off ⇒ the ask form shows an inline notice and the
  // submit stays disabled — zero round-trip, zero console-error noise instead
  // of the old fire-then-403 dance. The read is live (store listener + SSE
  // echo), so configuring AI while the dialog is open enables it immediately.
  const aiLive = !!(aiConfig && aiConfig.mode && aiConfig.mode !== 'off');
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [proposal, setProposal] = useState(null);
  // The instruction that PRODUCED the live proposal — snapshotted at response
  // time so the structure sentinel reads what was actually sent, not a prompt
  // the GM may have edited while the preview is on screen.
  const [sentInstruction, setSentInstruction] = useState('');
  const mapKey = map.slug || map.fileName;
  const docked = mount === 'map';

  // Map-view mount: mirror the live proposal's ops out to the host so it can
  // paint (and, via null, wipe) the canvas overlay preview. Covers close,
  // Apply (close inside), error stays, and toolbar unmounts (e.g. 2D↔3D
  // switch) — every path leaves zero preview residue.
  useEffect(() => {
    if (!onProposalChange) return undefined;
    onProposalChange(open && proposal ? proposal.ops : null);
    return () => onProposalChange(null);
  }, [open, proposal, onProposalChange]);

  const close = () => { setOpen(false); setProposal(null); setSentInstruction(''); setError(null); setInstruction(''); };

  const ask = async () => {
    const text = instruction.trim();
    if (!text || busy || !aiLive) return;
    setBusy(true);
    setError(null);
    const res = await dressMapProposal({ campaignName, mapName: mapKey, instruction: text });
    setBusy(false);
    if (res.ok) { setProposal(res); setSentInstruction(text); return; }
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
      const opsCount = proposal.ops.length;
      await addEntry(campaignName, {
        type: 'ai_dress', action: 'applied', name: 'AI dress', map: proposal.map, ops: opsCount,
        // Human row copy (write_rejected/map_regenerated sibling pattern) — the
        // log list renders this verbatim instead of the derived fallback line.
        description: `AI dressed "${proposal.map}" with ${opsCount} op${opsCount === 1 ? '' : 's'} (applied)`,
      });
      close();
    } catch (err) {
      setError(String(err?.message || 'Failed to save the dressed map'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button"
        className={docked ? 'ai-dress-open-btn ai-dress-map-btn' : 'ct-btn ai-dress-open-btn'}
        onClick={() => setOpen(true)}
        aria-label={`Dress "${map.name}" with AI`}
        title="Dress this map with AI in-place ops (you preview and apply — nothing saves silently)">
        <i className="fa-solid fa-wand-magic-sparkles" /> AI Dress
      </button>
    );
  }

  return (
    <AiInstructionModal title={`AI Dress — “${map.name}”`} closeLabel="Close AI dress"
      busy={busy} onClose={close}
      overlayClassName={docked ? 'ai-instruction-overlay-dock' : undefined}>
      {proposal
        ? <AiDressPreview proposal={proposal} instruction={sentInstruction} busy={busy} onApply={apply} docked={docked} />
        : <AiDressAsk instruction={instruction} setInstruction={setInstruction} busy={busy} aiLive={aiLive} onAsk={ask} />}
      {error && <p className="ai-dress-error" role="alert">{error}</p>}
    </AiInstructionModal>
  );
}

export default AiDressButton;

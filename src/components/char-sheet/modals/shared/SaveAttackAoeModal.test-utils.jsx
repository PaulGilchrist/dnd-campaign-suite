// Shared test kit for the SaveAttackAoeModal.* family (rec :222).
// Extracts the CreatureSelectionModal row-markup stub previously copy-pasted
// across the family lanes. Shape model: SaveAttackHealModal.test-utils.js.
//
// Honest split (fix#246): the kit holds the shared-common picker shapes only.
// Lane-DISTINCTIVE deviations are expressed either as documented factory opts
// below or stay as local vi.mock blocks in the deviating lanes:
//   NOT-IN-KIT (kit-serves-majority-not-all):
//   - cla120-empowered-evocation  (array-state interactive, no sp-modal wrap)
//   - lair-darkness               (captures {targets, description, note} split keys)
//   - staged-petrify             (captures icon + dual seenTargets/seenPicker refs)
//   - ma1673-vrock-spores       (dangerouslySetInnerHTML body + pickerCopy string)
// Real-mount lanes (blocking-effects, damage-edge-cases, overlay,
// creature-selection, damage-resolution, ac-penalty, overchannel, radiantSoul,
// repulsion-breath) never stub CreatureSelectionModal and import nothing here.
//
// Lanes adopt via dynamic import inside their hoisted vi.mock factory:
//   vi.mock('./CreatureSelectionModal.jsx', async () => {
//     const { createStaticPickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
//     return { default: createStaticPickerModal(seenTargets, { descClass: 'sp-desc', noteClass: 'sp-note-copy' }) };
//   });

import { useCallback, useState } from 'react';

// Static (uncontrolled) picker stub: every row renders an unchecked plain
// checkbox; Confirm submits ALL targets. `ref` receives the latest targets
// (or { title, note, targets } when capturePicker). Opts map 1:1 to the DOM
// variants previously written out verbatim in the lanes.
export function createStaticPickerModal(ref, opts = {}) {
  const {
    header = true,        // render <div className="sp-header">{title}</div>
    descClass,            // when set, render <div className={descClass}>{description}</div>
    noteClass,            // when set, render <div className={noteClass}>{note}</div>
    listWrapper = false,  // wrap rows in <div className="secondary-target-list">
    dataName = false,     // put data-name={t.name} on each row checkbox
    capturePicker = false, // ref.current = { title, note, targets } instead of targets
    confirmFromParam = false, // onConfirm(targets…) from prop, not ref.current
  } = opts;

  return function MockCreatureSelectionModal({ title, description, note, targets, onConfirm, onSkip }) {
    if (capturePicker) ref.current = { title, note, targets };
    else ref.current = targets;
    const rows = targets.map(t => (
      <label key={t.name} className="secondary-target-row">
        <input type="checkbox" {...(dataName ? { 'data-name': t.name } : {})} />
        {t.name}
      </label>
    ));
    return (
      <div className="sp-overlay">
        {header && <div className="sp-header">{title}</div>}
        {descClass && <div className={descClass}>{description}</div>}
        {noteClass && <div className={noteClass}>{note}</div>}
        {listWrapper ? <div className="secondary-target-list">{rows}</div> : rows}
        <button className="sp-roll-btn" onClick={() => onConfirm((confirmFromParam ? targets : ref.current).map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  };
}

// Interactive (controlled) picker stub: clicking a row toggles its checkbox;
// Confirm submits the selected names and is disabled while none are selected;
// the button label is "{confirmLabel} ({count})". Lives inside sp-modal.
export function createInteractivePickerModal(opts = {}) {
  const { dataName = false } = opts;

  return function MockCreatureSelectionModal({ targets, onConfirm, onSkip, confirmLabel }) {
    const [selected, setSelected] = useState(new Set());
    const toggleTarget = useCallback((name) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }, []);
    return (
      <div className="sp-overlay">
        <div className="sp-modal">
          {targets.map((t) => (
            <label key={t.name} className="secondary-target-row">
              <input type="checkbox" {...(dataName ? { 'data-name': t.name } : {})} checked={selected.has(t.name)} onChange={() => toggleTarget(t.name)} />
              {t.name}
            </label>
          ))}
          <button className="sp-roll-btn" onClick={() => onConfirm(Array.from(selected))} disabled={selected.size === 0} type="button">
            {confirmLabel} ({selected.size})
          </button>
          <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
        </div>
      </div>
    );
  };
}

import { useState, useEffect, useRef } from 'react';
import './SecondaryTargetModal.css';
import { getCurrentOverlayTarget, getCreaturesInsideOverlay, getTargetMapStatuses, distanceBadgeText } from '../../../../services/maps/spellOverlayService.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { useOverlayEntranceFocus } from '../../../../hooks/ui/useOverlayEntranceFocus.js';

// '' and non-numeric bucket values are the app's "no data" fingerprint
// (liveTargetHp.js storedNumber idiom) — treat them as absent, never render NaN.
function bucketNumber(name, key) {
    const stored = getRuntimeValue(name, key);
    if (stored == null || stored === '') return null;
    const num = Number(stored);
    return Number.isFinite(num) ? num : null;
}

// Per-row HP affordance. Monster/creature rows keep the combatSummary pair they
// arrive with (bucket HP keys never exist for them). PC rows take the character
// bucket as their ONLY HP truth: a mounted mid-session board can carry stub cs
// player rows with `currentHp: 1` placeholders, so feeding those to the picker
// would print a fabricated percentage (Known Quirks: the bucket is the HP truth
// face for players). No bucket pair → no chip (honest degradation to the bare
// name, the pre-improve face). A current>max pair means the halves came from
// different truths (SecondaryTargetModal hasHpValues law) — skip rather than
// invent a max.
function rowHpPercent(target) {
    const isPlayer = target.type === 'player';
    const currentHp = isPlayer ? bucketNumber(target.name, 'currentHitPoints') : target.currentHp;
    const maxHp = isPlayer ? bucketNumber(target.name, 'hitPoints') : target.maxHp;
    if (currentHp == null || maxHp == null || currentHp > maxHp || maxHp <= 0) return null;
    return `${Math.round((currentHp / maxHp) * 100)}%`;
}

// Per-row presentation of one candidate. A component (not inline JSX) so the
// picker body stays inside the complexity ceiling; HP resolves through
// rowHpPercent at render — the runtime store is fully hydrated at campaign
// select, well before any cast opens this modal.
function PickerTargetRow({ target, selected, maxTargets, mapStatuses, metamagicHeighten, heightenTarget, heightenWasCheckedRef, onToggle, onHeightenToggle }) {
    const name = target.name || target;
    const isSelected = selected.includes(name);
    const atMax = maxTargets && typeof maxTargets === 'number' && selected.length >= maxTargets && !isSelected;
    const hpDisplay = rowHpPercent(target);
    const status = mapStatuses ? mapStatuses[name] : null;
    return (
        <label
            className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''} ${atMax ? 'secondary-target-disabled' : ''}`}
        >
            <input
                type="checkbox"
                checked={isSelected}
                disabled={atMax}
                onChange={() => onToggle(name)}
            />
            <span className="secondary-target-name">
                <strong>{name}</strong>
                {hpDisplay && (
                    <span className="secondary-target-hp">
                        ({hpDisplay} HP)
                    </span>
                )}
            </span>
            {status && (
                <span className={`secondary-target-dist secondary-target-dist-${status.status}`}>
                    {distanceBadgeText(status)}
                </span>
            )}
            {target.carefulSpellProtected && (
                <span className="sp-note" style={{ fontSize: '0.85em', color: '#4ade80', marginLeft: '4px' }}>✓ Careful Spell protected</span>
            )}
            {metamagicHeighten && (
                <span style={{ fontSize: '0.85em', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                    <input
                        type="radio"
                        name="heightenTarget"
                        checked={heightenTarget === name}
                        onPointerDown={(e) => { heightenWasCheckedRef.current = e.currentTarget.checked; }}
                        onChange={(e) => { e.stopPropagation(); onHeightenToggle(name); }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (heightenWasCheckedRef.current) {
                                onHeightenToggle(name); // was checked; no change event fires here -> toggle back to null
                            }
                            heightenWasCheckedRef.current = false;
                        }}
                        title="Select this target for Heightened Spell disadvantage"
                    />
                    Heighten
                    <span className="sp-note" style={{ fontSize: '0.8em', marginLeft: '4px' }}>(gives target disadvantage)</span>
                </span>
            )}
        </label>
    );
}

export default function CreatureSelectionModal({
    title,
    icon,
    targets,
    description,
    note,
    maxTargets,
    confirmLabel,
    confirmIcon,
    // picker-confirm-live-while-prompts-stack: consumers that dispatch a
    // fire-and-forget cast from onConfirm pass this once the cast is in
    // flight so the picker (which stays mounted behind the prompt queue)
    // cannot re-dispatch. Falsy default = byte-identical for every other
    // consumer.
    confirmDisabled,
    onConfirm,
    onSkip,
    defaultSelected,
    metamagicHeighten,
    heightenTarget,
    setHeightenTarget,
    campaignName,
    attackerName,
    rangeFt,
}) {
    const [selected, setSelected] = useState(defaultSelected || []);
    const [mapStatuses, setMapStatuses] = useState(null);
    // Snapshot of the Heighten radio's native checkedness at pointerdown, before the
    // click completes. Radio change events never fire on an already-checked radio, so
    // re-click deselect is gated on this snapshot (and stays inert when the same click
    // newly selected the radio, since browsers dispatch change before click).
    const heightenWasCheckedRef = useRef(false);
    // Entrance focus + stranded-close restore (backlog 2026-11-17 sp-overlay adoption).
    const overlayRef = useRef(null);
    useOverlayEntranceFocus(overlayRef);

    useEffect(() => {
        if (!campaignName || !attackerName || targets.length === 0) return undefined;
        let cancelled = false;
        const names = targets.map(t => t.name || t);
        (async () => {
            const overlay = await getCurrentOverlayTarget(campaignName, attackerName);
            if (overlay && !cancelled) {
                const inside = await getCreaturesInsideOverlay(campaignName, overlay, names);
                if (inside.length && !cancelled) {
                    setSelected(prev => [...new Set([...prev, ...inside])]);
                }
            }
            const statuses = await getTargetMapStatuses(campaignName, attackerName, names, rangeFt);
            if (statuses && !cancelled) setMapStatuses(statuses);
        })();
        return () => { cancelled = true; };
    }, [campaignName, attackerName, rangeFt]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleTarget = (name) => {
        setSelected(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : !maxTargets || prev.length < maxTargets
                    ? [...prev, name]
                    : prev
        );
    };

    const handleHeightenSelect = (name) => {
        if (setHeightenTarget) {
            setHeightenTarget(heightenTarget === name ? null : name);
        }
    };

    const handleConfirm = () => {
        if (selected.length === 0 || confirmDisabled) return;
        onConfirm(selected);
    };

    const iconClass = confirmIcon || 'fa-crosshairs';
    const label = confirmLabel || 'Confirm';

    return (
        <div className="sp-overlay" ref={overlayRef}>
            <div className="sp-modal">
                <div className="sp-header">
                    <i className={`fa-solid ${icon}`}></i> {title}
                </div>
                <div className="sp-body">
                    {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
                    {!description && targets.length > 0 && <p>{description || `Choose ${maxTargets ? `up to ${maxTargets}` : 'multiple'} targets:`}</p>}
                    {note && <p className="sp-note" dangerouslySetInnerHTML={{ __html: note }} />}
                    <div className="secondary-target-list">
                        {targets.map((target, i) => (
                            <PickerTargetRow
                                key={i}
                                target={target}
                                selected={selected}
                                maxTargets={maxTargets}
                                mapStatuses={mapStatuses}
                                metamagicHeighten={metamagicHeighten}
                                heightenTarget={heightenTarget}
                                heightenWasCheckedRef={heightenWasCheckedRef}
                                onToggle={toggleTarget}
                                onHeightenToggle={handleHeightenSelect}
                            />
                        ))}
                        {targets.length === 0 && (
                            <p className="sp-note">No targets available.</p>
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={selected.length === 0 || confirmDisabled}
                        type="button"
                    >
                        <i className={`fa-solid ${iconClass}`}></i> {label} ({selected.length})
                    </button>
                    <button className="sp-dismiss-btn" onClick={onSkip} type="button">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    );
}

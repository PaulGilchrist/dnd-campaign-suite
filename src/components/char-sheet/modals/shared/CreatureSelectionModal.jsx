import { useState, useEffect } from 'react';
import './SecondaryTargetModal.css';
import { getCurrentOverlayTarget, getCreaturesInsideOverlay, getTargetMapStatuses, distanceBadgeText } from '../../../../services/maps/spellOverlayService.js';

export default function CreatureSelectionModal({
    title,
    icon,
    targets,
    description,
    note,
    maxTargets,
    confirmLabel,
    confirmIcon,
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
        if (selected.length === 0) return;
        onConfirm(selected);
    };

    const iconClass = confirmIcon || 'fa-crosshairs';
    const label = confirmLabel || 'Confirm';

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className={`fa-solid ${icon}`}></i> {title}
                </div>
                <div className="sp-body">
                    {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
                    {!description && targets.length > 0 && <p>{description || `Choose ${maxTargets ? `up to ${maxTargets}` : 'multiple'} targets:`}</p>}
                    {note && <p className="sp-note" dangerouslySetInnerHTML={{ __html: note }} />}
                    <div className="secondary-target-list">
                        {targets.map((target, i) => {
                            const name = target.name || target;
                            const isSelected = selected.includes(name);
                            const atMax = maxTargets && typeof maxTargets === 'number' && selected.length >= maxTargets && !isSelected;
                            const isPlayer = target.type === 'player';
                            const hpDisplay = (!isPlayer && target.currentHp != null && target.maxHp != null)
                                ? `${Math.round((target.currentHp / target.maxHp) * 100)}%`
                                : null;
                            return (
                                <label
                                    key={i}
                                    className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''} ${atMax ? 'secondary-target-disabled' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={atMax}
                                        onChange={() => toggleTarget(name)}
                                    />
                                    <span className="secondary-target-name">
                                        <strong>{name}</strong>
                                        {hpDisplay && (
                                            <span className="secondary-target-hp">
                                                ({hpDisplay} HP)
                                            </span>
                                        )}
                                    </span>
                                    {mapStatuses && mapStatuses[name] && (
                                        <span className={`secondary-target-dist secondary-target-dist-${mapStatuses[name].status}`}>
                                            {distanceBadgeText(mapStatuses[name])}
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
                                                onChange={(e) => { e.stopPropagation(); handleHeightenSelect(name); }}
                                                title="Select this target for Heightened Spell disadvantage"
                                            />
                                            Heighten
                                            <span className="sp-note" style={{ fontSize: '0.8em', marginLeft: '4px' }}>(gives target disadvantage)</span>
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                        {targets.length === 0 && (
                            <p className="sp-note">No targets available.</p>
                        )}
                    </div>
                </div>
                <div className="sp-actions">
                    <button
                        className="sp-roll-btn"
                        onClick={handleConfirm}
                        disabled={selected.length === 0}
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

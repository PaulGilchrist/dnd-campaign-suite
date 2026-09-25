import React, { useCallback, memo } from 'react';

export function ResultsSummaryModal({ results, conditionLabel, onClose }) {
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return (
        <div className="sp-overlay">
            <div className="sp-modal">
                <div className="sp-header">
                    <i className="fa-solid fa-dice-d20"></i> Save Results
                </div>
                <div className="sp-body">
                    <p><strong>{successCount}</strong> target{successCount !== 1 ? 's' : ''} saved, <strong>{failCount}</strong> target{failCount !== 1 ? 's' : ''} failed.</p>
                    <div className="abjure-results-list">
                        {results.map(r => {
                            const saveBonusText = r.saveBonus !== 0 ? ' +' + r.saveBonus : '';
                            return (
                                <div key={r.targetName} className={`abjure-result ${r.success ? 'abjure-result-success' : 'abjure-result-fail'}`}>
                                    <strong>{r.targetName}</strong>: {r.success
                                        ? 'Saved — unaffected (rolled ' + (r.roll ?? 0) + saveBonusText + ' = ' + r.total + ')'
                                        : 'Failed — ' + conditionLabel + '! (rolled ' + (r.roll ?? 0) + saveBonusText + ' = ' + r.total + ')'}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="sp-actions">
                    <button className="sp-dismiss-btn" onClick={handleClose} type="button">Close</button>
                </div>
            </div>
        </div>
    );
}

export const TargetListRenderer = memo(function TargetListRenderer({ eligibleTargets, selected, toggleTarget, heightenTarget, setHeightenTarget, metamagicHeighten }) {
    return (
        <div className="secondary-target-list">
            {eligibleTargets.map((target, i) => {
                const name = target.name || target;
                const isSelected = selected.has(name);
                const isPlayer = target.type === 'player';
                const hpDisplay = (!isPlayer && target.currentHp != null && target.maxHp != null)
                    ? `${Math.round((target.currentHp / target.maxHp) * 100)}%`
                    : null;
                return (
                    <label
                        key={i}
                        className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                        onClick={() => toggleTarget(name)}
                    >
                        <input
                            type="checkbox"
                            checked={isSelected}
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
                        {target.carefulSpellProtected && (
                            <span className="sp-note" style={{ fontSize: '0.85em', color: '#4ade80', marginLeft: '4px' }}>✓ Careful Spell protected</span>
                        )}
                        {metamagicHeighten && (
                            <span style={{ fontSize: '0.85em', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                                <input
                                    type="radio"
                                    name="heightenTarget"
                                    checked={heightenTarget === name}
                                    onChange={(e) => { e.stopPropagation(); setHeightenTarget(heightenTarget === name ? null : name); }}
                                    title="Select this target for Heightened Spell disadvantage"
                                />
                                Heighten
                            </span>
                        )}
                    </label>
                );
            })}
        </div>
    );
});

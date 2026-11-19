// Quick reference: the conditions' mechanical effects from
// /data/conditions.json and the base actions from /data/actions.json.
// Both ride the cached dataLoader lane (one fetch per app session, shared
// with any later consumer); the section itself is pure presentation over the
// resolved arrays — the only useState here holds static ruleset content, not
// game state. Collapsible via native <details> (zero JS state).
import { useEffect, useState } from 'react';
import { loadConditions, loadActions } from '../../services/ui/dataLoader.js';
import { BASE_ACTION_DESCRIPTIONS } from '../char-sheet/baseActionDescriptions.js';
import { sanitizeHtml } from '../../services/ui/sanitize.js';

// conditions.json carries one row per ruleset printing of Exhaustion (the
// file's own 5e-then-2024 order); name them apart so neither vanishes.
function conditionLabels(conditions) {
    const seen = new Map();
    return conditions.map((condition, index) => {
        const count = conditions.filter(other => other.name === condition.name).length;
        let label = condition.name;
        if (count > 1) {
            const occurrence = seen.get(condition.name) || 0;
            seen.set(condition.name, occurrence + 1);
            label = `${condition.name} (${occurrence === 0 ? '5e' : '2024'})`;
        }
        return { condition, label, key: `${condition.index}-${index}` };
    });
}

export default function GMScreenQuickRef() {
    const [reference, setReference] = useState(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([loadConditions(), loadActions()]).then(([conditions, actions]) => {
            if (!cancelled) setReference({ conditions, actions });
        });
        return () => { cancelled = true; };
    }, []);

    if (!reference) {
        return (
            <section className="gm-section" aria-label="Quick reference">
                <h3 className="gm-section-title">
                    <i className="fa-solid fa-book-open" aria-hidden="true"></i> Quick Reference
                </h3>
                <p className="gm-empty text-muted" role="status" aria-busy="true">Loading rules reference…</p>
            </section>
        );
    }

    const conditions = Array.isArray(reference.conditions) ? reference.conditions : [];
    const actions = Array.isArray(reference.actions) ? reference.actions : [];
    const uniqueNames = new Set(conditions.map(condition => condition.name)).size;

    return (
        <section className="gm-section" aria-label="Quick reference">
            <h3 className="gm-section-title">
                <i className="fa-solid fa-book-open" aria-hidden="true"></i> Quick Reference
            </h3>
            <div className="gm-ref-columns">
                <details className="gm-ref-group">
                    <summary>
                        <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                        {' '}Conditions ({uniqueNames})
                    </summary>
                    <div className="gm-ref-conditions">
                        {conditionLabels(conditions).map(({ condition, label, key }) => (
                            <details key={key} className="gm-ref-item">
                                <summary>{label}</summary>
                                <div
                                    className="gm-ref-item-body"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(condition.description) }}
                                />
                            </details>
                        ))}
                    </div>
                </details>
                <details className="gm-ref-group">
                    <summary>
                        <i className="fa-solid fa-gavel" aria-hidden="true"></i>
                        {' '}Base Actions ({actions.length})
                    </summary>
                    <ul className="gm-ref-actions">
                        {actions.map(name => (
                            <li key={name}>
                                <b>{name}</b>
                                {BASE_ACTION_DESCRIPTIONS[name] && (
                                    <span className="gm-ref-action-desc"> — {BASE_ACTION_DESCRIPTIONS[name]}</span>
                                )}
                                {name === 'Dodge' && BASE_ACTION_DESCRIPTIONS.Dodge2024 && (
                                    <span className="gm-ref-action-desc"> (2024: {BASE_ACTION_DESCRIPTIONS.Dodge2024})</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </details>
            </div>
        </section>
    );
}

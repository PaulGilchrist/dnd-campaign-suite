// Shared badge cluster for the GM Screen: a creature's active conditions
// (runtime activeConditions keys) plus campaign target effects aimed at it.
// Pure presentation — CreatureBadge renders a <span> whenever no onClick is
// passed, so nothing here can mutate state (GM Screen is a read-only view).
import CreatureBadge from '../common/CreatureBadge.jsx';
import { CONDITION_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';
import { conditionLabel, conditionTone } from '../../services/combat/conditions/conditionDisplay.js';

// conditionLabel / conditionTone come from conditionDisplay.js — the shared
// label/tone law (sheet CharConditions / map token indicators) so every
// surface reads identically.

function StatusBadges({ conditionKeys = [], targetEffects = [] }) {
    const hasContent = conditionKeys.length > 0 || targetEffects.length > 0;
    if (!hasContent) return null;
    return (
        <div className="gm-status-badges">
            {conditionKeys.map(key => (
                <CreatureBadge
                    key={`cond-${key}`}
                    label={conditionLabel(key)}
                    cls={conditionTone(key)}
                    tooltip={CONDITION_DESCRIPTIONS[conditionLabel(key)] || conditionLabel(key)}
                />
            ))}
            {targetEffects.map((te, index) => {
                const def = getEffectDefinition(te.effect);
                const label = def?.label || te.effect;
                return (
                    <CreatureBadge
                        key={`te-${te.effect}-${index}`}
                        icon={def?.icon}
                        label={te.saveDc ? `${label} DC ${te.saveDc}` : label}
                        cls={def?.cls || 'effect-neutral'}
                        tooltip={def?.description || label}
                    />
                );
            })}
        </div>
    );
}

export default StatusBadges;

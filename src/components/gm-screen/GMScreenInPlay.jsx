// "What's in play" strip: conditions and effects currently live across the
// party (runtime character stores), campaign-level target effects (zones and
// markers), and the initiative board when a combatSummary exists. Everything
// derives from shared-store subscriptions — no local state, no writes.
import { useMemo } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import StatusBadges from './StatusBadges.jsx';
import { normalizeConditionKeys } from './partyRowData.js';

// One party member's live line; renders nothing while the character carries
// no conditions and no effects (per-row hook = per-row component).
function CharacterActivity({ character, campaignName, campaignEffects }) {
    const name = character.computedStats.name;
    const rawConditions = useRuntimeValue(name, 'activeConditions', campaignName);
    const conditionKeys = useMemo(() => normalizeConditionKeys(rawConditions), [rawConditions]);
    const myEffects = useMemo(
        () => (campaignEffects || []).filter(te => te.target === name),
        [campaignEffects, name],
    );
    if (conditionKeys.length === 0 && myEffects.length === 0) return null;
    return (
        <div className="gm-inplay-line">
            <span className="gm-inplay-name">{name}</span>
            <StatusBadges conditionKeys={conditionKeys} targetEffects={myEffects} />
        </div>
    );
}

// Initiative-board rows are heterogeneous: player rows mirror the sheet,
// monster rows carry the join-stamped board fields. Conditions arrive as
// {key,label} objects (CreatureCard contract).
function CombatActivity({ campaignName, campaignEffects }) {
    // Live lane: the App echo adopts every combatSummary bucket into the
    // 'combatSummary' store (App.applyStoreUpdate), so these subscriptions
    // re-render the strip whenever the board changes. The combatData module
    // cache (kept in step with the same echoes by App) covers a cold mount
    // before any echo has landed on this tab.
    const storedCreatures = useRuntimeValue('combatSummary', 'creatures', campaignName);
    const storedRound = useRuntimeValue('combatSummary', 'round', campaignName);
    const activeCreatureName = useRuntimeValue('campaign', 'activeCreatureName', campaignName);
    const cached = getCombatSummary(campaignName);
    const creatures = storedCreatures ?? cached?.creatures ?? null;
    const round = storedRound ?? cached?.round ?? null;
    if (!Array.isArray(creatures) || creatures.length === 0) return null;
    return (
        <div className="gm-combat">
            <div className="gm-combat-header">
                <i className="fa-solid fa-dice-d20" aria-hidden="true"></i>
                {' '}Combat — round {round ?? 1}
                {activeCreatureName && <span className="gm-combat-active">active: {activeCreatureName}</span>}
            </div>
            <div className="gm-combat-rows">
                {creatures.map((creature, index) => {
                    const conditionKeys = Array.isArray(creature.conditions)
                        ? [...new Set(creature.conditions.map(cond => (
                            cond && typeof cond === 'object' ? (cond.label || cond.key) : cond
                        )).filter(Boolean))]
                        : [];
                    return (
                        <div key={`${creature.name}-${index}`} className="gm-inplay-line">
                            <span className="gm-inplay-name">{creature.name}</span>
                            <span className={`gm-combat-hp${creature.currentHp <= 0 ? ' gm-hp-down' : ''}`}>
                                {creature.currentHp} / {creature.maxHp}
                            </span>
                            <StatusBadges
                                conditionKeys={conditionKeys}
                                targetEffects={(campaignEffects || []).filter(te => te.target === creature.name)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function GMScreenInPlay({ party, campaignName, campaignEffects }) {
    // Stable identity for the shared zones array (a fresh `|| []` each render
    // would break the memo below).
    const zones = useMemo(() => campaignEffects || [], [campaignEffects]);
    const campaignOnly = useMemo(() => {
        const partyNames = new Set(party.map(character => character.computedStats.name));
        return zones.filter(te => !partyNames.has(te.target));
    }, [zones, party]);
    return (
        <section className="gm-section" aria-label="What is in play">
            <h3 className="gm-section-title">
                <i className="fa-solid fa-bolt" aria-hidden="true"></i> In Play
            </h3>
            <CombatActivity campaignName={campaignName} campaignEffects={zones} />
            {party.map(character => (
                <CharacterActivity
                    key={character.computedStats.name || character.name}
                    character={character}
                    campaignName={campaignName}
                    campaignEffects={campaignEffects}
                />
            ))}
            {campaignOnly.length > 0 && (
                <div className="gm-inplay-line">
                    <span className="gm-inplay-name">Unassigned effects</span>
                    <StatusBadges targetEffects={campaignOnly} />
                </div>
            )}
            {zones.length === 0 && (
                <p className="gm-empty text-muted">No zones or markers on the table.</p>
            )}
        </section>
    );
}

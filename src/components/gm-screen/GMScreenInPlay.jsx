// "What's in play" strip: conditions and effects currently live across the
// party (runtime character stores), campaign-level target effects (zones and
// markers), and the initiative board when a combatSummary exists. Everything
// derives from shared-store subscriptions — no local state, no writes.
import { useMemo } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { normalizeConditionKeys } from '../../services/combat/conditions/conditionDisplay.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import StatusBadges from './StatusBadges.jsx';

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
//
// HP law (mirrors CreatureCard/CreatureHp): the board's currentHp/maxHp are
// authoritative ONLY for monster/NPC rows — a player row's board HP is the
// join-time placeholder (e.g. 1/1), so player rows resolve the same runtime
// keys the sheet writes, exactly like the party table's HpCell.
function CombatRow({ creature, partyStats, campaignName, campaignEffects }) {
    const isPlayer = creature.type === 'player' && partyStats;
    const storedHp = useRuntimeValue(creature.name, 'currentHitPoints', campaignName);
    const aidIncrease = useRuntimeValue(creature.name, 'aidHpMaxIncrease', campaignName);
    const heroesFeastIncrease = useRuntimeValue(creature.name, 'heroesFeastHpMaxIncrease', campaignName);
    const tempHp = useRuntimeValue(creature.name, 'tempHp', campaignName);

    const conditionKeys = Array.isArray(creature.conditions)
        ? [...new Set(creature.conditions.map(cond => (
            cond && typeof cond === 'object' ? (cond.label || cond.key) : cond
        )).filter(Boolean))]
        : [];

    let current;
    let max;
    if (isPlayer) {
        const effectiveMax = (partyStats.hitPoints || 0)
            + (Number(aidIncrease) || 0) + (Number(heroesFeastIncrease) || 0);
        max = effectiveMax;
        current = storedHp != null ? storedHp : effectiveMax;
    } else {
        current = creature.currentHp;
        max = creature.maxHp;
    }
    return (
        <div className="gm-inplay-line">
            <span className="gm-inplay-name">{creature.name}</span>
            <span className={`gm-combat-hp${current <= 0 ? ' gm-hp-down' : ''}`}>
                {current} / {max}
                {Number(tempHp) > 0 && (
                    <span className="gm-temp-hp" title="Temporary hit points">{` +${Number(tempHp)}`}</span>
                )}
            </span>
            <StatusBadges
                conditionKeys={conditionKeys}
                targetEffects={(campaignEffects || []).filter(te => te.target === creature.name)}
            />
        </div>
    );
}

function CombatActivity({ party, campaignName, campaignEffects }) {
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
    const partyStatsByName = useMemo(
        () => new Map((party || []).map(character => [character.computedStats.name, character.computedStats])),
        [party],
    );
    if (!Array.isArray(creatures) || creatures.length === 0) return null;
    return (
        <div className="gm-combat">
            <div className="gm-combat-header">
                <i className="fa-solid fa-dice-d20" aria-hidden="true"></i>
                {' '}Combat — round {round ?? 1}
                {activeCreatureName && <span className="gm-combat-active">active: {activeCreatureName}</span>}
            </div>
            <div className="gm-combat-rows">
                {creatures.map((creature, index) => (
                    <CombatRow
                        key={`${creature.name}-${index}`}
                        creature={creature}
                        partyStats={partyStatsByName.get(creature.name)}
                        campaignName={campaignName}
                        campaignEffects={campaignEffects}
                    />
                ))}
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
            <CombatActivity party={party} campaignName={campaignName} campaignEffects={zones} />
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

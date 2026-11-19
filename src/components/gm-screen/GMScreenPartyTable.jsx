// GM Screen party table: one row per character, everything derived at render
// from PlayerStats (computedCharacters — the single source of truth) plus the
// live runtime store via read-only useRuntimeValue subscriptions. Zero local
// game state: the row component subscribes to its own character's HP /
// condition keys (hooks must live per-row, so each row is its own component).
import { useMemo } from 'react';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { normalizeConditionKeys } from '../../services/combat/conditions/conditionDisplay.js';
import StatusBadges from './StatusBadges.jsx';
import { getBaseSpeed } from '../char-sheet/char-summary/charSummaryCalc.js';
import {
    deriveSaves,
    deriveProficientSkills,
    deriveClassLabel,
    formatBonus,
} from './partyRowData.js';

function SkillsCell({ skills }) {
    if (skills.length === 0) {
        return <td className="gm-cell-skills"><span className="text-muted">—</span></td>;
    }
    return (
        <td className="gm-cell-skills">
            {skills.map(skill => (
                <span
                    key={skill.name}
                    className={`gm-skill${skill.expert ? ' gm-skill-expert' : ''}`}
                    title={skill.expert ? `${skill.name} (expertise)` : skill.name}
                >
                    {skill.name} {formatBonus(skill.bonus)}
                </span>
            ))}
        </td>
    );
}

function DefenseCell({ stats }) {
    const resistances = Array.isArray(stats.resistances) ? stats.resistances : [];
    const immunities = Array.isArray(stats.immunities) ? stats.immunities : [];
    if (resistances.length === 0 && immunities.length === 0) {
        return <td className="gm-cell-defense"><span className="text-muted">—</span></td>;
    }
    return (
        <td className="gm-cell-defense">
            {resistances.length > 0 && <div className="gm-defense-line">Res {resistances.join(', ')}</div>}
            {immunities.length > 0 && <div className="gm-defense-line">Imm {immunities.join(', ')}</div>}
        </td>
    );
}

function HpCell({ maxHp, storedHp, aidIncrease, heroesFeastIncrease, tempHp }) {
    const effectiveMax = maxHp + (Number(aidIncrease) || 0) + (Number(heroesFeastIncrease) || 0);
    const currentHp = storedHp != null ? storedHp : effectiveMax;
    const hpCls = currentHp <= 0 ? 'gm-hp-down' : currentHp <= effectiveMax / 2 ? 'gm-hp-bloodied' : '';
    return (
        <td className={`gm-cell-hp ${hpCls}`.trim()}>
            {currentHp} / {effectiveMax}
            {Number(tempHp) > 0 && (
                <span className="gm-temp-hp" title="Temporary hit points">{` +${Number(tempHp)}`}</span>
            )}
        </td>
    );
}

function PartyRow({ character, campaignName, campaignEffects }) {
    const stats = character.computedStats;
    const derived = useMemo(() => ({
        saves: deriveSaves(stats),
        skills: deriveProficientSkills(stats),
        classLabel: deriveClassLabel(stats),
        // CLA-201 speed resolution law: the rules-layer folded
        // playerStats.speed first, else the race-JSON base the sheet's
        // getBaseSpeed lane uses. (Reading stats.speed alone showed "—"
        // for every character with no speed passive.)
        speed: stats.speed ?? getBaseSpeed(stats, campaignName),
    }), [stats, campaignName]);

    // Same lane the sheet's CharHitPoints uses: stored current HP (defaulting
    // to the effective max), max folded with Aid / Hero's Feast increases.
    const storedHp = useRuntimeValue(stats.name, 'currentHitPoints', campaignName);
    const aidIncrease = useRuntimeValue(stats.name, 'aidHpMaxIncrease', campaignName);
    const heroesFeastIncrease = useRuntimeValue(stats.name, 'heroesFeastHpMaxIncrease', campaignName);
    const tempHp = useRuntimeValue(stats.name, 'tempHp', campaignName);
    const rawConditions = useRuntimeValue(stats.name, 'activeConditions', campaignName);

    const conditionKeys = useMemo(() => normalizeConditionKeys(rawConditions), [rawConditions]);
    const myEffects = useMemo(
        () => (campaignEffects || []).filter(te => te.target === stats.name),
        [campaignEffects, stats.name],
    );

    return (
        <tr>
            <td className="gm-cell-name">{stats.name}</td>
            <td>{derived.classLabel || '—'}</td>
            <td
                className="gm-cell-ac"
                title={stats.armorClassFormula ? `AC formula: ${stats.armorClassFormula}` : 'Armor Class'}
            >
                {stats.armorClass}
            </td>
            <td className="gm-cell-saves">
                {derived.saves.map(save => (
                    <span
                        key={save.name}
                        className={`gm-save${save.proficient ? ' gm-save-proficient' : ''}`}
                        title={`${save.name} saving throw${save.proficient ? ' (proficient)' : ''}`}
                    >
                        {save.abbr} {formatBonus(save.bonus)}
                    </span>
                ))}
            </td>
            <SkillsCell skills={derived.skills} />
            <HpCell
                maxHp={stats.hitPoints || 0}
                storedHp={storedHp}
                aidIncrease={aidIncrease}
                heroesFeastIncrease={heroesFeastIncrease}
                tempHp={tempHp}
            />
            <td className="gm-cell-speed">{derived.speed} ft.</td>
            <DefenseCell stats={stats} />
            <td className="gm-cell-status">
                <StatusBadges conditionKeys={conditionKeys} targetEffects={myEffects} />
            </td>
        </tr>
    );
}

export default function GMScreenPartyTable({ party, campaignName, campaignEffects }) {
    return (
        <section className="gm-section" aria-label="Party overview">
            <h3 className="gm-section-title">
                <i className="fa-solid fa-users" aria-hidden="true"></i> Party
            </h3>
            {party.length === 0 ? (
                <p className="gm-empty text-muted">No party members loaded yet.</p>
            ) : (
                <div className="gm-table-scroll">
                    <table className="table-striped gm-party-table">
                        <thead>
                            <tr>
                                <th scope="col">Character</th>
                                <th scope="col">Class</th>
                                <th scope="col">AC</th>
                                <th scope="col">Saves</th>
                                <th scope="col">Skills</th>
                                <th scope="col">HP</th>
                                <th scope="col">Speed</th>
                                <th scope="col">Res/Imm</th>
                                <th scope="col">In Play</th>
                            </tr>
                        </thead>
                        <tbody>
                            {party.map(character => (
                                <PartyRow
                                    key={character.computedStats.name || character.name}
                                    character={character}
                                    campaignName={campaignName}
                                    campaignEffects={campaignEffects}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

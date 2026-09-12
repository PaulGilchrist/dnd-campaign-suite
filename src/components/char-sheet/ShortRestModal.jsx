
import React from 'react'
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js'
import { rollDice } from '../../services/dice/diceRoller.js'
import { getHitDieSize, computeHitDieRecovery, SHORT_REST_RESOURCES, getShortRestResourceLabels, applyShortRest } from '../../services/rules/effects/restRules.js'
import { getClassFeatures } from '../../services/character/classFeatures.js'
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js'
import { addEntry } from '../../services/ui/logService.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { applyHealingToTarget } from '../../services/rules/combat/applyHealing.js'
import { loadSpellData } from '../../services/ui/dataLoader.js'
import CreatureSelectionModal from './modals/shared/CreatureSelectionModal.jsx'

function recoverArcaneSlots(playerStats, campaignName) {
    const maxSlotsToRecover = Math.ceil(playerStats.level / 2);
    let slotsRecovered = 0;
    for (const level of [1, 2, 3, 4, 5]) {
        if (slotsRecovered >= maxSlotsToRecover) break;
        const slotKey = `spell_slots_level_${level}`;
        const max = playerStats.spellAbilities?.[slotKey] || 0;
        const current = Number(getRuntimeValue(playerStats.name, slotKey) ?? max);
        const available = max - current;
        if (available > 0) {
            const remaining = maxSlotsToRecover - slotsRecovered;
            const toRecover = Math.min(available, Math.floor(remaining / level));
            setRuntimeValue(playerStats.name, slotKey, current + toRecover, campaignName);
            slotsRecovered += level * toRecover;
        }
    }
}

function applyNaturalRecoverySelections(playerStats, campaignName, naturalRecoverySelections) {
    for (const [levelStr, count] of Object.entries(naturalRecoverySelections)) {
        if (count > 0) {
            const slotKey = `spell_slots_level_${levelStr}`;
            const max = playerStats.spellAbilities?.[slotKey] || 0;
            const current = Number(getRuntimeValue(playerStats.name, slotKey) ?? max);
            setRuntimeValue(playerStats.name, slotKey, Math.min(max, current + count), campaignName);
        }
    }
}

function collectClassResourceLabels(playerStats, campaignName, restoredResources) {
    if (playerStats.class?.name === 'Fighter') {
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const maxSW = classLevel?.second_wind || 0;
        const currentSW = Number(getRuntimeValue(playerStats.name, 'secondWindUses', campaignName) ?? 0);
        if (currentSW < maxSW) restoredResources.push('Second Wind');
    }
    if (playerStats.class?.name === 'Barbarian' && playerStats.rules === '2024') {
        const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
        const maxRage = classLevel?.rages || 0;
        const storedRage = getRuntimeValue(playerStats.name, 'ragePoints', campaignName);
        const trackedRage = playerStats._trackedResources?.ragePoints;
        const currentRage = storedRage != null ? Number(storedRage) : (trackedRage?.current ?? maxRage);
        if (currentRage < maxRage) restoredResources.push('Rage (2024)');
    }
}

function isCelestialPatron(playerStats) {
    return playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron';
}

function pushTirelessLabel(playerStats, campaignName, restoredResources) {
    if (playerStats.class?.name !== 'Ranger' || playerStats.level < 10) return;
    const currentExhaustion = getRuntimeValue(playerStats.name, 'exhaustionLevel', campaignName);
    if (typeof currentExhaustion === 'number' && currentExhaustion > 0) restoredResources.push('Tireless (exhaustion reduced)');
}

function collectFeatureRestorationLabels(playerStats, campaignName, ctx, restoredResources) {
    const { arcaneRecoveryRequested, restorationRequested, hasFontOfInspiration } = ctx;
    const passives = playerStats.automation?.passives ?? [];
    if (playerStats.specialActions?.some(f => f.name === 'Improved Warding Flare')) restoredResources.push('Warding Flare');
    if (hasFontOfInspiration) restoredResources.push('Bardic Inspiration (Font of Inspiration)');
    if (arcaneRecoveryRequested && passives.some(p => p.type === 'resource_restoration' && p.resourceKey === 'arcaneRecoveryLevels')) restoredResources.push('Arcane Recovery');
    if (passives.some(p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats')) restoredResources.push('Bolstering Treats');
    if (playerStats.class?.name === 'Warlock') restoredResources.push('Pact Magic (Warlock spell slots)');
    if (isCelestialPatron(playerStats) && playerStats.specialActions?.some(f => f.name === 'Celestial Resilience')) restoredResources.push('Celestial Resilience (temp HP)');
    pushTirelessLabel(playerStats, campaignName, restoredResources);
    if (restorationRequested && passives.some(p => p.type === 'resource_restoration' && p.resourceKey === 'sorcerousRestorationUses')) restoredResources.push('Sorcery Points (Sorcerous Restoration)');
}

function buildNaturalRecoveryDetail(playerStats, naturalRecoveryAvailable, naturalRecoverySelections) {
    const hasNaturalRecovery = (playerStats.automation?.passives ?? []).some(p => p.type === 'natural_recovery');
    if (hasNaturalRecovery && naturalRecoveryAvailable && Object.keys(naturalRecoverySelections).some(k => naturalRecoverySelections[k] > 0)) {
        return Object.entries(naturalRecoverySelections)
            .filter(([_, count]) => count > 0)
            .map(([lvl, count]) => `${count}x level ${lvl}`)
            .join(', ');
    }
    return null;
}

function collectRestoredResources(playerStats, campaignName, ctx) {
    const restoredResources = [];
    const resourceLabels = getShortRestResourceLabels(playerStats);
    SHORT_REST_RESOURCES.forEach(key => {
        const label = resourceLabels.find(r => r.key === key);
        if (label) restoredResources.push(label.label);
    });
    collectClassResourceLabels(playerStats, campaignName, restoredResources);
    collectFeatureRestorationLabels(playerStats, campaignName, ctx, restoredResources);
    const naturalRecoveryDetail = buildNaturalRecoveryDetail(playerStats, ctx.naturalRecoveryAvailable, ctx.naturalRecoverySelections);
    if (naturalRecoveryDetail) restoredResources.push(`Natural Recovery (${naturalRecoveryDetail})`);
    return { restoredResources, naturalRecoveryDetail };
}

function buildShortRestLogEntries({ playerStats, hitDie, rollLog, hpBeforeRest, displayHp, naturalRecoveryDetail, mealConsumed, restoredResources }) {
    const logEntries = [];
    logEntries.push(`${playerStats.name} takes a short rest.`);
    if (rollLog.length > 0) {
        const totalDiceHeal = rollLog.filter(r => !r.isSongOfRest).reduce((sum, r) => sum + r.hp, 0);
        const totalSongHeal = rollLog.filter(r => r.isSongOfRest).reduce((sum, r) => sum + r.hp, 0);
        const diceDetail = rollLog.filter(r => !r.isSongOfRest).map(r => `${r.roll}→${r.hp}`).join(', ');
        logEntries.push(`Hit Dice: ${rollLog.filter(r => !r.isSongOfRest).length}d${hitDie} (${diceDetail}) = ${totalDiceHeal} HP recovered`);
        if (totalSongHeal > 0) {
            logEntries.push(`Song of Rest: ${totalSongHeal} HP recovered`);
        }
        logEntries.push(`Current HP: ${hpBeforeRest} → ${displayHp}`);
    } else {
        logEntries.push(`Hit Dice: 0 used`);
    }
    if (naturalRecoveryDetail) {
        logEntries.push(`Natural Recovery: ${naturalRecoveryDetail}`);
    }
    if (mealConsumed) {
        logEntries.push('Replenishing Meal consumed: +1d8 HP');
    }
    if (restoredResources.length > 0) {
        logEntries.push(`Resources restored: ${restoredResources.join(', ')}`);
    }
    return logEntries;
}

// Pure: resolve Sorcerous Restoration flags the modal gates on.
function computeSorcererRestFlags(playerStats) {
    const isSorcerer = playerStats?.class?.name === 'Sorcerer';
    const sorcRestoration = isSorcerer && (playerStats.automation?.passives ?? []).find(a => a.type === 'resource_restoration');
    const restorationCur = getRuntimeValue(playerStats.name, 'sorcerousRestorationUses');
    const restorationAvailable = !!sorcRestoration && restorationCur !== 0;
    const restoreAmount = isSorcerer ? evaluateAutoExpression(sorcRestoration?.restore_expression ?? '', playerStats, playerStats.proficiency, playerStats.level) : 0;
    return { isSorcerer, sorcRestoration, restorationAvailable, restoreAmount };
}

// Pure: resolve Wizard Arcane Recovery / memorize_spell flags the modal gates on.
function computeWizardRestFlags(playerStats) {
    const isWizard = playerStats?.class?.name === 'Wizard';
    const arcaneRecovery = isWizard && (playerStats.automation?.passives ?? []).find(a => a.type === 'resource_restoration' && a.resourceKey === 'arcaneRecoveryLevels');
    const arcaneRecoveryCur = getRuntimeValue(playerStats.name, 'arcaneRecoveryLevels');
    const arcaneRecoveryAvailable = !!arcaneRecovery && arcaneRecoveryCur !== null && arcaneRecoveryCur !== 0;
    const arcaneRecoveryMaxSlots = isWizard ? Math.ceil(playerStats.level / 2) : 0;
    // CLA-226: automationRouter routes memorize_spell into specialActions (automationRouter.js:589),
    // matching the signature_spells gate pattern in restRules-shortRest.js — gate must read that bucket.
    const hasMemorizeSpell = isWizard && (playerStats.automation?.specialActions ?? []).find(a => a.type === 'memorize_spell');
    return { arcaneRecovery, arcaneRecoveryAvailable, arcaneRecoveryMaxSlots, hasMemorizeSpell };
}

// Pure: resolve Druid Natural Recovery flags the modal gates on.
function computeDruidRestFlags(playerStats) {
    const isDruid = playerStats?.class?.name === 'Druid';
    const naturalRecovery = isDruid && (playerStats.automation?.passives ?? []).find(a => a.type === 'natural_recovery');
    const naturalRecoveryCur = getRuntimeValue(playerStats.name, 'naturalRecoverySlots');
    const naturalRecoveryAvailable = !!naturalRecovery && naturalRecoveryCur !== 0;
    const naturalRecoveryMaxLevels = isDruid ? Math.floor(playerStats.level / 2) : 0;
    return { naturalRecovery, naturalRecoveryAvailable, naturalRecoveryMaxLevels };
}

// Pure: resolve Bard Font of Inspiration flags the modal gates on.
function computeBardRestFlags(playerStats) {
    const hasFontOfInspiration = (playerStats.automation?.passives ?? []).some(p => p.type === 'font_of_inspiration');
    const bardicInspirationMax = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
    const bardicInspirationCur = getRuntimeValue(playerStats.name, 'bardicInspirationUses');
    const fontOfInspirationAvailable = hasFontOfInspiration && (bardicInspirationCur == null || Number(bardicInspirationCur) < bardicInspirationMax);
    return { hasFontOfInspiration, bardicInspirationMax, fontOfInspirationAvailable };
}

// Pure: resolve the class/feature recovery flags the modal gates on.
function computeRestFlags(playerStats) {
    const sorcerer = computeSorcererRestFlags(playerStats);
    const wizard = computeWizardRestFlags(playerStats);
    const druid = computeDruidRestFlags(playerStats);
    const bard = computeBardRestFlags(playerStats);
    return {
        isSorcerer: sorcerer.isSorcerer,
        sorcRestoration: sorcerer.sorcRestoration,
        restorationAvailable: sorcerer.restorationAvailable,
        arcaneRecovery: wizard.arcaneRecovery,
        arcaneRecoveryAvailable: wizard.arcaneRecoveryAvailable,
        arcaneRecoveryMaxSlots: wizard.arcaneRecoveryMaxSlots,
        naturalRecovery: druid.naturalRecovery,
        naturalRecoveryAvailable: druid.naturalRecoveryAvailable,
        naturalRecoveryMaxLevels: druid.naturalRecoveryMaxLevels,
        hasMemorizeSpell: wizard.hasMemorizeSpell,
        hasFontOfInspiration: bard.hasFontOfInspiration,
        bardicInspirationMax: bard.bardicInspirationMax,
        fontOfInspirationAvailable: bard.fontOfInspirationAvailable,
        hasBolsteringTreats: (playerStats.automation?.passives ?? []).some(p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'),
        maxHitDice: playerStats.level,
        hitDie: getHitDieSize(playerStats),
        conBonus: playerStats.abilities?.find(a => a.name === 'Constitution')?.bonus || 0,
        songOfRestDie: getClassFeatures(playerStats)?.songOfRestDie || null,
        restoreAmount: sorcerer.restoreAmount,
    };
}

function ShortRestRollLog({ rollLog, recoveredHp }) {
    if (rollLog.length === 0) return null;
    return (
        <div className="short-rest-roll-log">
            <table>
                <thead>
                    <tr><th>Roll</th><th>HP Recovered</th></tr>
                </thead>
                <tbody>
                    {rollLog.map((entry, i) => (
                        <tr key={i} className={entry.isSongOfRest ? 'short-rest-song-row' : ''}>
                            <td>{entry.roll}{entry.isSongOfRest ? ' (Song of Rest)' : ''}</td>
                            <td>{entry.hp}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="short-rest-total"><b>Total HP Recovered:</b> {recoveredHp}</p>
        </div>
    );
}

function SongOfRestSection({ songOfRestDie, applied, onApply }) {
    if (!songOfRestDie || applied) return null;
    return (
        <div className="short-rest-section">
            <h4>Song of Rest</h4>
            <p>Roll d{songOfRestDie} + CON bonus and add to recovered HP.</p>
            <div className="short-rest-dice-row">
                <button className="char-btn" onClick={onApply}>
                    <i className="fa-solid fa-music"></i> Apply Song of Rest (d{songOfRestDie})
                </button>
            </div>
        </div>
    );
}

function SorcerousRestorationSection({ restoration, available, requested, restoreAmount, onRequest }) {
    if (!restoration || (!available && !requested)) return null;
    return (
        <div className="short-rest-section">
            <h4>Sorcerous Restoration</h4>
            <p>Regain {restoreAmount} expended sorcery points.</p>
            <div className="short-rest-dice-row">
                {requested ? (
                    <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Restoration requested</span>
                  ) : (
                    <button className="char-btn" onClick={onRequest} disabled={!available}>
                        <i className="fas fa-wand-magic-sparkles"></i> Regain {restoreAmount} Sorcery Points
                    </button>
                  )}
            </div>
        </div>
    );
}

function FontOfInspirationSection({ visible, bardicInspirationMax }) {
    if (!visible) return null;
    return (
        <div className="short-rest-section">
            <h4>Font of Inspiration</h4>
            <p>Regain {bardicInspirationMax} expended Bardic Inspiration uses.</p>
            <div className="short-rest-dice-row">
                <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Font of Inspiration applied on short rest</span>
            </div>
        </div>
    );
}

function BolsteringTreatsSection({ visible, crafted, proficiency, onCraft }) {
    if (!visible) return null;
    return (
        <div className="short-rest-section">
            <h4>Bolstering Treats</h4>
            <p>Craft {proficiency || 0} bolstering treats (last 8 hours).</p>
            <div className="short-rest-dice-row">
                {crafted ? (
                    <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Treats crafted</span>
                  ) : (
                    <button className="char-btn" onClick={onCraft}>
                        <i className="fas fa-cookie-bite"></i> Craft Bolstering Treats
                    </button>
                  )}
            </div>
        </div>
    );
}

function MealSections({ hasMeal, mealConsumed }) {
    return (
        <>
            {hasMeal && !mealConsumed && (
                <div className="short-rest-section">
                    <h4>Replenishing Meal</h4>
                    <p>Your next Hit Die roll gains +1d8 HP. The meal will be consumed.</p>
                </div>
            )}
            {mealConsumed && (
                <div className="short-rest-section">
                    <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Replenishing Meal consumed (+1d8 HP)</span>
                </div>
            )}
        </>
    );
}

function NaturalRecoverySection({ naturalRecovery, maxLevels, budgetRemaining, slotLevels, selections, onChange }) {
    if (!naturalRecovery) return null;
    return (
        <div className="short-rest-section">
            <h4>Natural Recovery</h4>
            <p>Recover expended spell slots with combined level up to {maxLevels}.</p>
            <>
                <div className="short-rest-nr-budget">
                        Budget: {budgetRemaining} of {maxLevels} levels remaining
                    </div>
                    <table className="short-rest-nr-table">
                        <thead>
                            <tr>
                                <th>Level</th>
                                <th>Current</th>
                                <th>Available</th>
                                <th>Recover</th>
                            </tr>
                        </thead>
                        <tbody>
                            {slotLevels.map(({ level, max, current, available }) => {
                                const selected = selections[level] || 0;
                                const canAdd = selected < available && budgetRemaining >= level;
                                const canRemove = selected > 0;
                                return (
                                    <tr key={level}>
                                        <td>{level}</td>
                                        <td>{current} / {max}</td>
                                        <td>{available}</td>
                                        <td className="short-rest-nr-controls">
                                            <button
                                                className="char-btn char-btn-sm"
                                                onClick={() => onChange(level, -1)}
                                                disabled={!canRemove}
                                            >-</button>
                                            <span className="short-rest-nr-count">{selected}</span>
                                            <button
                                                className="char-btn char-btn-sm"
                                                onClick={() => onChange(level, 1)}
                                                disabled={!canAdd}
                                            >+</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </>
        </div>
    );
}

function ArcaneRecoverySection({ arcaneRecovery, available, requested, maxSlots, onRequest }) {
    if (!arcaneRecovery || (!available && !requested)) return null;
    return (
        <div className="short-rest-section">
            <h4>Arcane Recovery</h4>
            <p>Regain expended Wizard spell slots up to level {maxSlots}. No slots level 6+.</p>
            <div className="short-rest-dice-row">
                {requested ? (
                    <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Arcane Recovery applied</span>
                  ) : (
                    <button className="char-btn" onClick={onRequest} disabled={!available}>
                        <i className="fas fa-book-open"></i> Recover Spell Slots
                    </button>
                  )}
            </div>
        </div>
    );
}

function MemorizeSpellSection({ hasMemorizeSpell, available, mode, from, to, fromOptions, toOptions, onEnterMode, onChangeFrom, onChangeTo, onSwap, onCancel }) {
    if (!hasMemorizeSpell || (!available && !mode)) return null;
    return (
        <div className="short-rest-section">
            <h4>Memorize Spell</h4>
            <p>Replace one prepared level 1+ spell with another from your spellbook.</p>
            <div className="short-rest-dice-row">
                {!mode ? (
                    <button className="char-btn" onClick={onEnterMode}>
                        <i className="fas fa-book-journal-whills"></i> Swap Prepared Spell
                    </button>
                  ) : (
                     <div>
                         <div className="short-rest-memorize-field">
                             <label>Remove prepared spell: </label>
                             <select className="char-btn" value={from || ''} onChange={e => onChangeFrom(e.target.value)}>
                                 <option value="">-- Select spell to remove --</option>
                                 {fromOptions.map(s => (
                                     <option key={s.name} value={s.name}>{s.name} (level {s.level})</option>
                                 ))}
                             </select>
                         </div>
                         <div className="short-rest-memorize-field">
                             <label>Add from spellbook: </label>
                            <select className="char-btn" value={to || ''} onChange={e => onChangeTo(e.target.value)}>
                                <option value="">-- Select spell to add --</option>
                                {toOptions.map(s => (
                                    <option key={s.name} value={s.name}>{s.name} (level {s.level})</option>
                                ))}
                            </select>
                        </div>
                        <div className="short-rest-dice-row">
                            <button className="char-btn" onClick={onSwap} disabled={!from || !to}>
                                <i className="fas fa-check"></i> Swap Spell
                            </button>
                            <button className="char-btn" onClick={onCancel}>
                                Cancel
                            </button>
                        </div>
                    </div>
                  )}
            </div>
        </div>
    );
}

function ResourceLabelsSection({ labels }) {
    if (labels.length === 0) return null;
    return (
        <div className="short-rest-section">
            <h4>Resources Restored</h4>
            <ul>
                {labels.map(label => (
                    <li key={label}>{label}</li>
                  ))}
            </ul>
        </div>
    );
}

function ShortRestModal({ playerStats, campaignName, onClose, onComplete }) {
    const [remainingHitDice, setRemainingHitDice] = React.useState(() => {
        const stored = getRuntimeValue(playerStats.name, 'shortRestHitDice');
        return stored != null ? stored : playerStats.level;
       });
    const [recoveredHp, setRecoveredHp] = React.useState(0);
    const [rollLog, setRollLog] = React.useState([]);
    const [songOfRestApplied, setSongOfRestApplied] = React.useState(false);
    const [restorationRequested, setRestorationRequested] = React.useState(false);
    const [celestialResilienceModal, setCelestialResilienceModal] = React.useState(null);

    const replenishingMeals = useRuntimeValue(playerStats.name, 'replenishingMeals', campaignName);
    const hasMeal = Number(replenishingMeals ?? 0) > 0;
    const [mealConsumed, setMealConsumed] = React.useState(false);


    const { sorcRestoration, restorationAvailable, arcaneRecovery, arcaneRecoveryAvailable, arcaneRecoveryMaxSlots, naturalRecovery, naturalRecoveryAvailable, naturalRecoveryMaxLevels, hasMemorizeSpell, hasFontOfInspiration, bardicInspirationMax, fontOfInspirationAvailable, hasBolsteringTreats, maxHitDice, hitDie, conBonus, songOfRestDie, restoreAmount } = computeRestFlags(playerStats);

    const [arcaneRecoveryRequested, setArcaneRecoveryRequested] = React.useState(false);

    const [naturalRecoverySelections, setNaturalRecoverySelections] = React.useState({});

    const naturalRecoverySlotLevels = React.useMemo(() => {
        if (!naturalRecovery) return [];
        const levels = [];
        for (let lvl = 1; lvl <= 9; lvl++) {
            const slotKey = `spell_slots_level_${lvl}`;
            const max = playerStats.spellAbilities?.[slotKey] || 0;
            if (max > 0) {
                const current = Number(getRuntimeValue(playerStats.name, slotKey) ?? max);
                levels.push({ level: lvl, max, current, available: max - current });
            }
        }
        return levels;
    }, [naturalRecovery, playerStats.spellAbilities, playerStats.name]);

    const naturalRecoveryBudgetUsed = Object.entries(naturalRecoverySelections).reduce(
        (sum, [lvl, count]) => sum + (Number(lvl) * count), 0
    );
    const naturalRecoveryBudgetRemaining = naturalRecoveryMaxLevels - naturalRecoveryBudgetUsed;

    const handleNaturalRecoveryChange = (level, delta) => {
        setNaturalRecoverySelections(prev => {
            const current = prev[level] || 0;
            const newVal = Math.max(0, current + delta);
            const newSelections = newVal === 0
                ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== String(level)))
                : { ...prev, [level]: newVal };
            return newSelections;
        });
    };

    // CLA-226: automationRouter routes memorize_spell into specialActions (automationRouter.js:589),
    // matching the signature_spells gate pattern in restRules-shortRest.js — gate must read that bucket.
    const [memorizeSpellMode, setMemorizeSpellMode] = React.useState(false);
    const [memorizeSpellFrom, setMemorizeSpellFrom] = React.useState(null);
    const [memorizeSpellTo, setMemorizeSpellTo] = React.useState(null);
    const [allSpellbookSpells, setAllSpellbookSpells] = React.useState([]);

    React.useEffect(() => {
        if (hasMemorizeSpell) {
            loadSpellData(playerStats).then(spells => {
                // Spellbook offers Wizard-list spells only (mirrors spellValidation.js class filter).
                setAllSpellbookSpells((spells || []).filter(s => (s.classes || []).includes('Wizard')));
            }).catch(() => setAllSpellbookSpells([]));
        }
    }, [hasMemorizeSpell, playerStats]);

    const preparedSpells = React.useMemo(() => {
        const stored = getRuntimeValue(playerStats.name, 'preparedSpells', campaignName);
        if (Array.isArray(stored)) {
            return stored;
        }
        const spells = playerStats.spellAbilities?.spells || [];
        return spells.filter(s => s.prepared === 'Prepared').map(s => s.name);
    }, [playerStats.spellAbilities?.spells, playerStats.name, campaignName]);

    const memorizeSpellAvailable = hasMemorizeSpell && !memorizeSpellMode && preparedSpells.length > 0;

    const memorizeSpellFromOptions = React.useMemo(() => {
        return allSpellbookSpells.filter(s => preparedSpells.includes(s.name) && s.level >= 1);
    }, [allSpellbookSpells, preparedSpells]);

    const memorizeSpellToOptions = React.useMemo(() => {
        const preparedSet = new Set(preparedSpells);
        return allSpellbookSpells.filter(s => s.level >= 1 && !preparedSet.has(s.name));
    }, [allSpellbookSpells, preparedSpells]);

    const handleMemorizeSwap = () => {
        if (!memorizeSpellFrom || !memorizeSpellTo) return;
        const newPrepared = preparedSpells.filter(n => n !== memorizeSpellFrom);
        if (!newPrepared.includes(memorizeSpellTo)) {
            newPrepared.push(memorizeSpellTo);
        }
        setRuntimeValue(playerStats.name, 'preparedSpells', newPrepared, campaignName);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Memorize Spell',
            description: `${playerStats.name} swapped prepared spell ${memorizeSpellFrom} for ${memorizeSpellTo} (short rest).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[ShortRestModal] Error logging Memorize Spell swap:', e); });
        setMemorizeSpellMode(false);
        setMemorizeSpellFrom(null);
        setMemorizeSpellTo(null);
    };

    const [bolsteringTreatsCrafted, setBolsteringTreatsCrafted] = React.useState(false);
    const resourceLabels = React.useMemo(() => getShortRestResourceLabels(playerStats), [playerStats]);

    const handleRollOne = () => {
        if (remainingHitDice <= 0) return;
        const { total, rolls } = rollDice(1, hitDie);
        let hp = computeHitDieRecovery(total, conBonus);
        if (hasMeal && !mealConsumed) {
            const { total: mealTotal } = rollDice(1, 8);
            const mealBonus = Math.max(1, mealTotal);
            hp += mealBonus;
            setMealConsumed(true);
            setRuntimeValue(playerStats.name, 'replenishingMeals', Number(replenishingMeals ?? 0) - 1, campaignName);
        }
        setRemainingHitDice(prev => prev - 1);
        setRecoveredHp(prev => prev + hp);
        setRollLog(prev => [...prev, { roll: rolls[0], hp }]);
     };

    const handleRollAll = () => {
        if (remainingHitDice <= 0) return;
        let totalHp = 0;
        let newRolls = [];
        let mealApplied = false;
        for (let i = 0; i < remainingHitDice; i++) {
            const { total, rolls } = rollDice(1, hitDie);
            let hp = computeHitDieRecovery(total, conBonus);
            if (hasMeal && !mealApplied) {
                const { total: mealTotal } = rollDice(1, 8);
                const mealBonus = Math.max(1, mealTotal);
                hp += mealBonus;
                mealApplied = true;
                setMealConsumed(true);
                setRuntimeValue(playerStats.name, 'replenishingMeals', Number(replenishingMeals ?? 0) - 1, campaignName);
            }
            totalHp += hp;
            newRolls.push({ roll: rolls[0], hp });
         }
        setRemainingHitDice(0);
        setRecoveredHp(prev => prev + totalHp);
        setRollLog(prev => [...prev, ...newRolls]);
     };

    const handleApplySongOfRest = async () => {
        if (!songOfRestDie || songOfRestApplied) return;
        const { total } = rollDice(1, songOfRestDie);
        const bonus = Math.max(1, total + conBonus);
        const combatSummary = await getCombatContext(campaignName);
        if (combatSummary) {
            const result = applyHealingToTarget(combatSummary, playerStats.name, bonus, campaignName);
            if (result) {
                setRecoveredHp(prev => prev + result.actualHeal);
                setRollLog(prev => [...prev, { roll: total, hp: result.actualHeal, isSongOfRest: true }]);
            }
        } else {
            setRecoveredHp(prev => prev + bonus);
            setRollLog(prev => [...prev, { roll: total, hp: bonus, isSongOfRest: true }]);
        }
        setSongOfRestApplied(true);
       };

    const handleApplySorcerousRestoration = () => {
        if (!sorcRestoration || !restorationAvailable || restorationRequested) return;
        setRestorationRequested(true);
       };

    const handleCraftBolsteringTreats = () => {
        if (!hasBolsteringTreats || bolsteringTreatsCrafted) return;
        const treatCount = playerStats.proficiency || 0;
        setRuntimeValue(playerStats.name, 'chefBolsteringTreats', treatCount, campaignName);
        setBolsteringTreatsCrafted(true);
       };

    const handleCelestialResilienceConfirm = async (selectedAllies) => {
        if (!celestialResilienceModal) return;
        const { allyTempHp, creatureTargets } = celestialResilienceModal;
        for (const allyName of selectedAllies) {
            const ally = creatureTargets.find(a => a.name === allyName);
            if (!ally) continue;
            setTempHp(ally.name, allyTempHp, campaignName);
        }
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Celestial Resilience',
            description: `${playerStats.name} grants ${allyTempHp} temporary hit points to ${selectedAllies.join(', ')}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[celestialResilience] Error logging:', e); });
        setCelestialResilienceModal(null);
        onComplete && onComplete();
    };

    const handleCelestialResilienceSkip = () => {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Celestial Resilience',
            description: `${playerStats.name} skipped ally selection for Celestial Resilience (short rest).`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[celestialResilience] Error logging:', e); });
        setCelestialResilienceModal(null);
        onComplete && onComplete();
    };

    const applySorcerousRestorationState = () => {
        const curSorcery = getRuntimeValue(playerStats.name, 'sorceryPoints');
        const maxSp = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
        setRuntimeValue(playerStats.name, 'sorceryPoints', Math.min(maxSp, (curSorcery != null ? Number(curSorcery) : 0) + restoreAmount), campaignName);
        setRuntimeValue(playerStats.name, 'sorcerousRestorationUses', 0, campaignName);
    };

    const handleComplete = async () => {
        const hpBeforeRest = Number(getRuntimeValue(playerStats.name, 'currentHitPoints') ?? playerStats.hitPoints);

        // Apply base short rest logic (resource clearing, feature clearing, expiration)
        const restResult = await applyShortRest(playerStats, campaignName, { skipAutoRecovery: true });

        // Replenishing Meal was consumed during this rest — subtract 1 from the reset value
        if (mealConsumed) {
            setRuntimeValue(playerStats.name, 'replenishingMeals', Number(getRuntimeValue(playerStats.name, 'replenishingMeals', campaignName) ?? 0) - 1, campaignName);
        }

        // Check if Celestial Resilience needs ally selection
        if (restResult?.celestialResilienceAllies) {
            setCelestialResilienceModal({
                ...restResult.celestialResilienceAllies,
                playerStats,
                campaignName
            });
            return;
        }

        // Layer on UI-driven updates: hit dice healing
        let currentHp = hpBeforeRest + recoveredHp;
        setRuntimeValue(playerStats.name, 'currentHitPoints', Math.min(playerStats.hitPoints, currentHp), campaignName);
        setRuntimeValue(playerStats.name, 'shortRestHitDice', remainingHitDice, campaignName);

        // UI-driven: Sorcerous Restoration
        if (sorcRestoration && restorationAvailable && restorationRequested) {
            applySorcerousRestorationState();
        }

        // UI-driven: Arcane Recovery
        if (arcaneRecovery && arcaneRecoveryAvailable && arcaneRecoveryRequested) {
            recoverArcaneSlots(playerStats, campaignName);
        }

        // UI-driven: Natural Recovery
        const hasNaturalRecoverySelections = Object.keys(naturalRecoverySelections).some(k => naturalRecoverySelections[k] > 0);
        if (naturalRecovery && naturalRecoveryAvailable && hasNaturalRecoverySelections) {
            applyNaturalRecoverySelections(playerStats, campaignName, naturalRecoverySelections);
        }

        const { restoredResources, naturalRecoveryDetail } = collectRestoredResources(playerStats, campaignName, {
            arcaneRecoveryRequested, restorationRequested, naturalRecovery, naturalRecoveryAvailable, naturalRecoverySelections, hasFontOfInspiration,
        });
        const logEntries = buildShortRestLogEntries({
            playerStats, hitDie, rollLog, hpBeforeRest,
            displayHp: Math.min(playerStats.hitPoints, currentHp),
            naturalRecoveryDetail, mealConsumed, restoredResources,
        });
        addEntry(campaignName, { type: 'short_rest', message: logEntries.join(' | ') }).catch(err => {
            console.error('[ShortRestModal] Failed to log short rest:', err);
        });

        onComplete && onComplete();
    };

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="short-rest-overlay no-print" onClick={onClose}>
            <div className="short-rest-modal" onClick={(e) => e.stopPropagation()}>
                <h3><i className="fa-solid fa-bed"></i> Short Rest</h3>

                <div className="short-rest-section">
                    <h4>Hit Dice</h4>
                    <p>d{hitDie} &mdash; {remainingHitDice} of {maxHitDice} remaining</p>
                    <div className="short-rest-dice-row">
                        <button className="char-btn" onClick={handleRollOne} disabled={remainingHitDice <= 0}>
                            <i className="fa-solid fa-dice"></i> Roll One
                        </button>
                        <button className="char-btn" onClick={handleRollAll} disabled={remainingHitDice <= 0}>
                            <i className="fa-solid fa-dice-d6"></i> Roll All ({remainingHitDice})
                        </button>
                    </div>
                     <ShortRestRollLog rollLog={rollLog} recoveredHp={recoveredHp} />
                 </div>

                 <SongOfRestSection songOfRestDie={songOfRestDie} applied={songOfRestApplied} onApply={handleApplySongOfRest} />

                   <SorcerousRestorationSection restoration={sorcRestoration} available={restorationAvailable} requested={restorationRequested} restoreAmount={restoreAmount} onRequest={handleApplySorcerousRestoration} />

                     <FontOfInspirationSection visible={hasFontOfInspiration && fontOfInspirationAvailable} bardicInspirationMax={bardicInspirationMax} />

                     <BolsteringTreatsSection visible={hasBolsteringTreats} crafted={bolsteringTreatsCrafted} proficiency={playerStats.proficiency} onCraft={handleCraftBolsteringTreats} />

                     <MealSections hasMeal={hasMeal} mealConsumed={mealConsumed} />

                     <ResourceLabelsSection labels={resourceLabels} />

                     <NaturalRecoverySection naturalRecovery={naturalRecovery} maxLevels={naturalRecoveryMaxLevels} budgetRemaining={naturalRecoveryBudgetRemaining} slotLevels={naturalRecoverySlotLevels} selections={naturalRecoverySelections} onChange={handleNaturalRecoveryChange} />

                     <ArcaneRecoverySection arcaneRecovery={arcaneRecovery} available={arcaneRecoveryAvailable} requested={arcaneRecoveryRequested} maxSlots={arcaneRecoveryMaxSlots} onRequest={() => setArcaneRecoveryRequested(true)} />

                     <MemorizeSpellSection hasMemorizeSpell={hasMemorizeSpell} available={memorizeSpellAvailable} mode={memorizeSpellMode} from={memorizeSpellFrom} to={memorizeSpellTo} fromOptions={memorizeSpellFromOptions} toOptions={memorizeSpellToOptions} onEnterMode={() => setMemorizeSpellMode(true)} onChangeFrom={setMemorizeSpellFrom} onChangeTo={setMemorizeSpellTo} onSwap={handleMemorizeSwap} onCancel={() => {
                         setMemorizeSpellMode(false);
                         setMemorizeSpellFrom(null);
                         setMemorizeSpellTo(null);
                     }} />

                     {celestialResilienceModal && (
                        <CreatureSelectionModal
                            title="Celestial Resilience"
                            icon="fa-shield-hart"
                            targets={celestialResilienceModal.creatureTargets}
                            maxTargets={celestialResilienceModal.maxTargets}
                            description="Choose up to 5 allies to gain temporary hit points from your Celestial Resilience."
                            note={`You gain ${celestialResilienceModal.selfTempHp} temporary hit points. Each selected ally gains ${celestialResilienceModal.allyTempHp} temporary hit points.`}
                            confirmLabel="Grant Resilience"
                            confirmIcon="fa-shield-hart"
                            onConfirm={handleCelestialResilienceConfirm}
                            onSkip={handleCelestialResilienceSkip}
                        />
                    )}

                <div className="short-rest-actions">
                    <button className="char-btn" onClick={handleComplete}>
                        <i className="fa-solid fa-check"></i> Complete Short Rest
                    </button>
                    <button className="char-btn" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default ShortRestModal

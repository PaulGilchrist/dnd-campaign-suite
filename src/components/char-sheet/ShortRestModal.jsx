
import React from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { rollDice } from '../../services/dice/diceRoller.js'
import { getHitDieSize, computeHitDieRecovery, SHORT_REST_RESOURCES, getShortRestResourceLabels } from '../../services/rules/effects/restRules.js'
import { clearAllExpirationEffects } from '../../services/rules/effects/expirations.js'
import { getClassFeatures } from '../../services/character/classFeatures.js'
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { applyHealingToTarget } from '../../services/rules/combat/applyHealing.js'
import { loadSpellData } from '../../services/ui/dataLoader.js'

function ShortRestModal({ playerStats, campaignName, onClose, onComplete }) {
    const [remainingHitDice, setRemainingHitDice] = React.useState(() => {
        const stored = getRuntimeValue(playerStats.name, 'shortRestHitDice');
        return stored != null ? stored : playerStats.level;
       });
    const [recoveredHp, setRecoveredHp] = React.useState(0);
    const [rollLog, setRollLog] = React.useState([]);
    const [songOfRestApplied, setSongOfRestApplied] = React.useState(false);
    const [restorationRequested, setRestorationRequested] = React.useState(false);
    const [fontOfInspirationRequested, setFontOfInspirationRequested] = React.useState(false);

    const isSorcerer = playerStats?.class?.name === 'Sorcerer';
    const sorcRestoration = isSorcerer && (playerStats.automation?.passives ?? []).find(
        a => a.type === 'resource_restoration'
      );
    const restorationCur = getRuntimeValue(playerStats.name, 'sorcerousRestorationUses');
    const restorationAvailable = !!sorcRestoration && restorationCur !== 0;

    const isWizard = playerStats?.class?.name === 'Wizard';
    const arcaneRecovery = isWizard && (playerStats.automation?.passives ?? []).find(
        a => a.type === 'resource_restoration' && a.resourceKey === 'arcaneRecoveryLevels'
    );
    const arcaneRecoveryCur = getRuntimeValue(playerStats.name, 'arcaneRecoveryLevels');
    const arcaneRecoveryAvailable = !!arcaneRecovery && arcaneRecoveryCur !== null && arcaneRecoveryCur !== 0;
    const arcaneRecoveryMaxSlots = isWizard ? Math.ceil(playerStats.level / 2) : 0;
    const [arcaneRecoveryRequested, setArcaneRecoveryRequested] = React.useState(false);

    const hasMemorizeSpell = isWizard && (playerStats.automation?.passives ?? []).find(
        a => a.type === 'memorize_spell'
    );
    const [memorizeSpellMode, setMemorizeSpellMode] = React.useState(false);
    const [memorizeSpellFrom, setMemorizeSpellFrom] = React.useState(null);
    const [memorizeSpellTo, setMemorizeSpellTo] = React.useState(null);
    const [allSpellbookSpells, setAllSpellbookSpells] = React.useState([]);

    React.useEffect(() => {
        if (hasMemorizeSpell) {
            loadSpellData('wizard_spells', playerStats).then(spells => {
                setAllSpellbookSpells(spells || []);
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

    const hasFontOfInspiration = (playerStats.automation?.passives ?? []).some(p => p.type === 'font_of_inspiration');
    const bardicInspirationMax = (() => { const charisma = playerStats.abilities?.find(a => a.name === 'Charisma'); return charisma?.bonus || 0; })();
    const bardicInspirationCur = getRuntimeValue(playerStats.name, 'bardicInspirationUses');
    const fontOfInspirationAvailable = hasFontOfInspiration && (bardicInspirationCur == null || Number(bardicInspirationCur) < bardicInspirationMax);

    const hasBolsteringTreats = (playerStats.automation?.passives ?? []).some(p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats');
    const [bolsteringTreatsCrafted, setBolsteringTreatsCrafted] = React.useState(false);

    const maxHitDice = playerStats.level;
    const hitDie = getHitDieSize(playerStats);
    const conBonus = playerStats.abilities?.find(a => a.name === 'Constitution')?.bonus || 0;
    const classFeatures = getClassFeatures(playerStats);
    const songOfRestDie = classFeatures?.songOfRestDie || null;
    const resourceLabels = React.useMemo(() => getShortRestResourceLabels(playerStats), [playerStats]);

    const handleRollOne = () => {
        if (remainingHitDice <= 0) return;
        const { total, rolls } = rollDice(1, hitDie);
        const hp = computeHitDieRecovery(total, conBonus);
        setRemainingHitDice(prev => prev - 1);
        setRecoveredHp(prev => prev + hp);
        setRollLog(prev => [...prev, { roll: rolls[0], hp }]);
     };

    const handleRollAll = () => {
        if (remainingHitDice <= 0) return;
        let totalHp = 0;
        let newRolls = [];
        for (let i = 0; i < remainingHitDice; i++) {
            const { total, rolls } = rollDice(1, hitDie);
            const hp = computeHitDieRecovery(total, conBonus);
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

    const restoreAmount = isSorcerer ? evaluateAutoExpression(sorcRestoration?.restore_expression ?? '', playerStats, playerStats.proficiency, playerStats.level) : 0;

    const handleApplySorcerousRestoration = () => {
        if (!sorcRestoration || !restorationAvailable || restorationRequested) return;
        setRestorationRequested(true);
       };

    const handleApplyFontOfInspiration = () => {
        if (!hasFontOfInspiration || !fontOfInspirationAvailable || fontOfInspirationRequested) return;
        setFontOfInspirationRequested(true);
       };

    const handleCraftBolsteringTreats = () => {
        if (!hasBolsteringTreats || bolsteringTreatsCrafted) return;
        const treatCount = playerStats.proficiency || 0;
        setRuntimeValue(playerStats.name, 'chefBolsteringTreats', treatCount, campaignName);
        setBolsteringTreatsCrafted(true);
       };

    const handleComplete = () => {
        setRuntimeValue(playerStats.name, 'shortRestHitDice', remainingHitDice, campaignName);

        let currentHp = getRuntimeValue(playerStats.name, 'currentHitPoints');
        if (currentHp == null || currentHp === '') {
            currentHp = playerStats.hitPoints;
           } else {
            currentHp = Number(currentHp) + recoveredHp;
           }
        setRuntimeValue(playerStats.name, 'currentHitPoints', Math.min(playerStats.hitPoints, currentHp), campaignName);

        SHORT_REST_RESOURCES.forEach((key) => {
            setRuntimeValue(playerStats.name, key, null, campaignName);
            });

        if (playerStats.class?.name === 'Fighter') {
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const maxSW = classLevel?.second_wind || 0;
            const currentSW = Number(getRuntimeValue(playerStats.name, 'secondWindUses', campaignName) ?? 0);
            if (currentSW < maxSW) {
                setRuntimeValue(playerStats.name, 'secondWindUses', Math.min(maxSW, currentSW + 1), campaignName);
            }
        }

        if (sorcRestoration && restorationAvailable && restorationRequested) {
            let curSorcery = getRuntimeValue(playerStats.name, 'sorceryPoints');
            const maxSp = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
            setRuntimeValue(playerStats.name, 'sorceryPoints', Math.min(maxSp, (curSorcery != null ? Number(curSorcery) : 0) + restoreAmount), campaignName);
            setRuntimeValue(playerStats.name, 'sorcerousRestorationUses', 0, campaignName);
            }

        if (hasFontOfInspiration && fontOfInspirationAvailable && fontOfInspirationRequested) {
            setRuntimeValue(playerStats.name, 'bardicInspirationUses', bardicInspirationMax, campaignName);
            }

        if (arcaneRecovery && arcaneRecoveryAvailable && arcaneRecoveryRequested) {
            const maxSlotsToRecover = Math.ceil(playerStats.level / 2);
            let slotsRecovered = 0;
            for (const level of [1, 2, 3, 4, 5]) {
                if (slotsRecovered >= maxSlotsToRecover) break;
                const slotKey = `spell_slots_level_${level}`;
                const max = playerStats.spellAbilities?.[slotKey] || 0;
                const current = Number(getRuntimeValue(playerStats.name, slotKey) ?? max);
                const available = max - current;
                if (available > 0) {
                    const toRecover = Math.min(available, maxSlotsToRecover - slotsRecovered);
                    setRuntimeValue(playerStats.name, slotKey, current + toRecover, campaignName);
                    slotsRecovered += toRecover;
                }
            }
            setRuntimeValue(playerStats.name, 'arcaneRecoveryLevels', null, campaignName);
            }

        // Signature Spells: Reset per-spell used flags on short rest
        const hasSignatureSpells = (playerStats.automation?.specialActions ?? []).some(
            a => a.type === 'signature_spells'
        )
        if (hasSignatureSpells) {
            const selection = getRuntimeValue(playerStats.name, 'SignatureSpells_selection', campaignName)
            if (selection && Array.isArray(selection)) {
                for (const spell of selection) {
                    const usedKey = `SignatureSpells_${spell.replace(/\s+/g, '_')}_used`
                    setRuntimeValue(playerStats.name, usedKey, null, campaignName)
                }
            }
        }

        clearAllExpirationEffects(playerStats.name, campaignName);

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
                     {rollLog.length > 0 && (
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
                     )}
                 </div>

                 {songOfRestDie && !songOfRestApplied && (
                     <div className="short-rest-section">
                         <h4>Song of Rest</h4>
                         <p>Roll d{songOfRestDie} + CON bonus and add to recovered HP.</p>
                         <div className="short-rest-dice-row">
                             <button className="char-btn" onClick={handleApplySongOfRest}>
                                 <i className="fa-solid fa-music"></i> Apply Song of Rest (d{songOfRestDie})
                             </button>
                         </div>
                     </div>
                   )}

                   {sorcRestoration && (restorationAvailable || restorationRequested) && (
                        <div className="short-rest-section">
                            <h4>Sorcerous Restoration</h4>
                            <p>Regain {restoreAmount} expended sorcery points.</p>
                            <div className="short-rest-dice-row">
                                {restorationRequested ? (
                                    <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Restoration requested</span>
                                  ) : (
                                    <button className="char-btn" onClick={handleApplySorcerousRestoration} disabled={!restorationAvailable}>
                                        <i className="fas fa-wand-magic-sparkles"></i> Regain {restoreAmount} Sorcery Points
                                    </button>
                                  )}
                            </div>
                        </div>
                    )}

                     {hasFontOfInspiration && (fontOfInspirationAvailable || fontOfInspirationRequested) && (
                         <div className="short-rest-section">
                             <h4>Font of Inspiration</h4>
                             <p>Regain {bardicInspirationMax} expended Bardic Inspiration uses.</p>
                             <div className="short-rest-dice-row">
                                 {fontOfInspirationRequested ? (
                                     <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Font of Inspiration applied</span>
                                   ) : (
                                     <button className="char-btn" onClick={handleApplyFontOfInspiration} disabled={!fontOfInspirationAvailable}>
                                         <i className="fas fa-wand-magic-sparkles"></i> Regain {bardicInspirationMax} Bardic Inspiration Uses
                                     </button>
                                   )}
                             </div>
                         </div>
                     )}

                     {hasBolsteringTreats && (
                         <div className="short-rest-section">
                             <h4>Bolstering Treats</h4>
                             <p>Craft {playerStats.proficiency || 0} bolstering treats (last 8 hours).</p>
                             <div className="short-rest-dice-row">
                                 {bolsteringTreatsCrafted ? (
                                     <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Treats crafted</span>
                                   ) : (
                                     <button className="char-btn" onClick={handleCraftBolsteringTreats}>
                                         <i className="fas fa-cookie-bite"></i> Craft Bolstering Treats
                                     </button>
                                   )}
                             </div>
                         </div>
                     )}

                      {resourceLabels.length > 0 && (
                       <div className="short-rest-section">
                           <h4>Resources Restored</h4>
                           <ul>
                               {resourceLabels.map(label => (
                                   <li key={label}>{label}</li>
                                  ))}
                           </ul>
                       </div>
                   )}

                    {arcaneRecovery && (arcaneRecoveryAvailable || arcaneRecoveryRequested) && (
                        <div className="short-rest-section">
                            <h4>Arcane Recovery</h4>
                            <p>Regain expended Wizard spell slots up to level {arcaneRecoveryMaxSlots}. No slots level 6+.</p>
                            <div className="short-rest-dice-row">
                                {arcaneRecoveryRequested ? (
                                    <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Arcane Recovery applied</span>
                                  ) : (
                                    <button className="char-btn" onClick={() => setArcaneRecoveryRequested(true)} disabled={!arcaneRecoveryAvailable}>
                                        <i className="fas fa-book-open"></i> Recover Spell Slots
                                    </button>
                                  )}
                            </div>
                        </div>
                    )}

                    {hasMemorizeSpell && (memorizeSpellAvailable || memorizeSpellMode) && (
                        <div className="short-rest-section">
                            <h4>Memorize Spell</h4>
                            <p>Replace one prepared level 1+ spell with another from your spellbook.</p>
                            <div className="short-rest-dice-row">
                                {!memorizeSpellMode ? (
                                    <button className="char-btn" onClick={() => setMemorizeSpellMode(true)}>
                                        <i className="fas fa-book-journal-whills"></i> Swap Prepared Spell
                                    </button>
                                  ) : (
                                    <div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <label>Remove prepared spell: </label>
                                            <select className="char-btn" value={memorizeSpellFrom || ''} onChange={e => setMemorizeSpellFrom(e.target.value)}>
                                                <option value="">-- Select spell to remove --</option>
                                                {memorizeSpellFromOptions.map(s => (
                                                    <option key={s.name} value={s.name}>{s.name} (level {s.level})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <label>Add from spellbook: </label>
                                            <select className="char-btn" value={memorizeSpellTo || ''} onChange={e => setMemorizeSpellTo(e.target.value)}>
                                                <option value="">-- Select spell to add --</option>
                                                {memorizeSpellToOptions.map(s => (
                                                    <option key={s.name} value={s.name}>{s.name} (level {s.level})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="short-rest-dice-row">
                                            <button className="char-btn" onClick={() => {
                                                if (!memorizeSpellFrom || !memorizeSpellTo) return;
                                                const newPrepared = preparedSpells.filter(n => n !== memorizeSpellFrom);
                                                if (!newPrepared.includes(memorizeSpellTo)) {
                                                    newPrepared.push(memorizeSpellTo);
                                                }
                                                setRuntimeValue(playerStats.name, 'preparedSpells', newPrepared, campaignName);
                                                setMemorizeSpellMode(false);
                                                setMemorizeSpellFrom(null);
                                                setMemorizeSpellTo(null);
                                            }} disabled={!memorizeSpellFrom || !memorizeSpellTo}>
                                                <i className="fas fa-check"></i> Swap Spell
                                            </button>
                                            <button className="char-btn" onClick={() => {
                                                setMemorizeSpellMode(false);
                                                setMemorizeSpellFrom(null);
                                                setMemorizeSpellTo(null);
                                            }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                  )}
                            </div>
                        </div>
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

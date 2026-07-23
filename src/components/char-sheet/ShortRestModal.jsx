
import React from 'react'
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { rollDice } from '../../services/dice/diceRoller.js'
import { getHitDieSize, computeHitDieRecovery, SHORT_REST_RESOURCES, getShortRestResourceLabels, applyShortRest } from '../../services/rules/effects/restRules.js'
import { getClassFeatures } from '../../services/character/classFeatures.js'
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js'
import { addEntry } from '../../services/ui/logService.js'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { applyHealingToTarget } from '../../services/rules/combat/applyHealing.js'
import { loadSpellData } from '../../services/ui/dataLoader.js'
import CreatureSelectionModal from './modals/shared/CreatureSelectionModal.jsx'

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

    const isDruid = playerStats?.class?.name === 'Druid';
    const naturalRecovery = isDruid && (playerStats.automation?.passives ?? []).find(
        a => a.type === 'natural_recovery'
    );
    const naturalRecoveryCur = getRuntimeValue(playerStats.name, 'naturalRecoverySlots');
    const naturalRecoveryAvailable = !!naturalRecovery && naturalRecoveryCur !== 0;
    const naturalRecoveryMaxLevels = isDruid ? Math.floor(playerStats.level / 2) : 0;

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

    const hasMemorizeSpell = isWizard && (playerStats.automation?.passives ?? []).find(
        a => a.type === 'memorize_spell'
    );
    const [memorizeSpellMode, setMemorizeSpellMode] = React.useState(false);
    const [memorizeSpellFrom, setMemorizeSpellFrom] = React.useState(null);
    const [memorizeSpellTo, setMemorizeSpellTo] = React.useState(null);
    const [allSpellbookSpells, setAllSpellbookSpells] = React.useState([]);

    React.useEffect(() => {
        if (hasMemorizeSpell) {
            loadSpellData(playerStats).then(spells => {
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

    const restoreAmount = isSorcerer ? evaluateAutoExpression(sorcRestoration?.restore_expression ?? '', playerStats, playerStats.proficiency, playerStats.level) : 0;

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
            const existingTempHp = Number(getRuntimeValue(ally.name, 'tempHp') || 0);
            setRuntimeValue(ally.name, 'tempHp', Math.max(existingTempHp, allyTempHp), campaignName);
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
            let curSorcery = getRuntimeValue(playerStats.name, 'sorceryPoints');
            const maxSp = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
            setRuntimeValue(playerStats.name, 'sorceryPoints', Math.min(maxSp, (curSorcery != null ? Number(curSorcery) : 0) + restoreAmount), campaignName);
            setRuntimeValue(playerStats.name, 'sorcerousRestorationUses', 0, campaignName);
        }

        // UI-driven: Arcane Recovery
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
        }

        // UI-driven: Natural Recovery
        if (naturalRecovery && naturalRecoveryAvailable && Object.keys(naturalRecoverySelections).some(k => naturalRecoverySelections[k] > 0)) {
            for (const [levelStr, count] of Object.entries(naturalRecoverySelections)) {
                if (count > 0) {
                    const slotKey = `spell_slots_level_${levelStr}`;
                    const max = playerStats.spellAbilities?.[slotKey] || 0;
                    const current = Number(getRuntimeValue(playerStats.name, slotKey) ?? max);
                    setRuntimeValue(playerStats.name, slotKey, Math.min(max, current + count), campaignName);
                }
            }
        }

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
            logEntries.push(`Current HP: ${hpBeforeRest} → ${Math.min(playerStats.hitPoints, currentHp)}`);
        } else {
            logEntries.push(`Hit Dice: 0 used`);
        }
        const restoredResources = [];
        SHORT_REST_RESOURCES.forEach(key => {
            const label = getShortRestResourceLabels(playerStats).find(r => r.key === key);
            if (label) restoredResources.push(label.label);
        });
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
        const hasImprovedWardingFlare = playerStats.specialActions?.some(f => f.name === 'Improved Warding Flare');
        if (hasImprovedWardingFlare) restoredResources.push('Warding Flare');
        if (hasFontOfInspiration) restoredResources.push('Bardic Inspiration (Font of Inspiration)');
        const hasArcaneRecovery = (playerStats.automation?.passives ?? []).some(p => p.type === 'resource_restoration' && p.resourceKey === 'arcaneRecoveryLevels');
        if (hasArcaneRecovery && arcaneRecoveryRequested) restoredResources.push('Arcane Recovery');
        const hasBolsteringTreats = (playerStats.automation?.passives ?? []).some(p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats');
        if (hasBolsteringTreats) restoredResources.push('Bolstering Treats');
        if (playerStats.class?.name === 'Warlock') restoredResources.push('Pact Magic (Warlock spell slots)');
        const hasCelestialResilience = playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron';
        if (hasCelestialResilience && playerStats.specialActions?.some(f => f.name === 'Celestial Resilience')) restoredResources.push('Celestial Resilience (temp HP)');
        const hasTireless = playerStats.class?.name === 'Ranger' && playerStats.level >= 10;
        if (hasTireless) {
            const currentExhaustion = getRuntimeValue(playerStats.name, 'exhaustionLevel', campaignName);
            if (typeof currentExhaustion === 'number' && currentExhaustion > 0) restoredResources.push('Tireless (exhaustion reduced)');
        }
        const hasSorcRestoration = (playerStats.automation?.passives ?? []).some(p => p.type === 'resource_restoration' && p.resourceKey === 'sorcerousRestorationUses');
        if (hasSorcRestoration && restorationRequested) restoredResources.push('Sorcery Points (Sorcerous Restoration)');
        const hasNaturalRecovery = (playerStats.automation?.passives ?? []).some(p => p.type === 'natural_recovery');
        if (hasNaturalRecovery && naturalRecoveryAvailable && Object.keys(naturalRecoverySelections).some(k => naturalRecoverySelections[k] > 0)) {
            const slotDetails = Object.entries(naturalRecoverySelections)
                .filter(([_, count]) => count > 0)
                .map(([lvl, count]) => `${count}x level ${lvl}`)
                .join(', ');
            logEntries.push(`Natural Recovery: ${slotDetails}`);
            restoredResources.push(`Natural Recovery (${slotDetails})`);
        }
        if (mealConsumed) {
            logEntries.push('Replenishing Meal consumed: +1d8 HP');
        }
        if (restoredResources.length > 0) {
            logEntries.push(`Resources restored: ${restoredResources.join(', ')}`);
        }
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

                      {hasFontOfInspiration && fontOfInspirationAvailable && (
                          <div className="short-rest-section">
                              <h4>Font of Inspiration</h4>
                              <p>Regain {bardicInspirationMax} expended Bardic Inspiration uses.</p>
                              <div className="short-rest-dice-row">
                                  <span className="short-rest-applied"><i className="fa-solid fa-check"></i> Font of Inspiration applied on short rest</span>
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

                    {naturalRecovery && (
                        <div className="short-rest-section">
                            <h4>Natural Recovery</h4>
                            <p>Recover expended spell slots with combined level up to {naturalRecoveryMaxLevels}.</p>
                            <>
                                <div className="short-rest-nr-budget">
                                        Budget: {naturalRecoveryBudgetRemaining} of {naturalRecoveryMaxLevels} levels remaining
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
                                            {naturalRecoverySlotLevels.map(({ level, max, current, available }) => {
                                                const selected = naturalRecoverySelections[level] || 0;
                                                const canAdd = selected < available && naturalRecoveryBudgetRemaining >= level;
                                                const canRemove = selected > 0;
                                                return (
                                                    <tr key={level}>
                                                        <td>{level}</td>
                                                        <td>{current} / {max}</td>
                                                        <td>{available}</td>
                                                        <td className="short-rest-nr-controls">
                                                            <button
                                                                className="char-btn char-btn-sm"
                                                                onClick={() => handleNaturalRecoveryChange(level, -1)}
                                                                disabled={!canRemove}
                                                            >-</button>
                                                            <span className="short-rest-nr-count">{selected}</span>
                                                            <button
                                                                className="char-btn char-btn-sm"
                                                                onClick={() => handleNaturalRecoveryChange(level, 1)}
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

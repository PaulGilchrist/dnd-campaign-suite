import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeObject, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../services/shared/logPoster.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { evaluateAutoExpression, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { parseMagicItemName } from '../../services/rules/core/attackCalc.js';
import { addEntry } from '../../services/ui/logService.js';
import { createSaveListener } from '../../services/automation/common/savePrompt.js';
import { getAttackRiderOptions, getAttackRiderOptionsByContext, executeAttackRiderManeuver as executeAttackRiderManeuverService } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { sendBardicInspirationOffensePrompt } from '../../services/combat/prompts/bardicInspirationPromptUtils.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize } from '../../services/combat/auras/bardicInspirationState.js';
import { spendResource } from '../../services/automation/common/resourceCheck.js';
import utils from '../../services/ui/utils.js';

export default function useAttackDamageResolution({
    playerStats, campaignName, mapName,
    popupHtml, setPopupHtml, rollDamage, buildCtx, buildCtxSync,
    setDamageTypeChoice, setDivineFuryChoice, setWeaponMasteryModal: _, setAttackRiderModal,
    setAttackRiderManeuverPrompt,
    setSweepingAttackTargetModal,
    pendingDamageRef,
    setSecondaryTargetModal,
}) {
    const proceedWithDamage = (attack, formula, total, rolls, modifier) => {
        (mapName ? buildCtx(attack) : buildCtxSync(attack)).then(ctx => {
            rollDamage(attack.name, formula, total, rolls, modifier, ctx);
        }).catch((e) => { console.error("[useAttackDamageResolution] Error:", e); });
    };

    const resolveAttackDamage = async (attack) => {
        // Handle Sudden Strike: clear the pending flag for this attack
        const isBonusActionAttack = attack.type === 'Bonus Action';
        if (isBonusActionAttack) {
            const pendingSudden = getRuntimeValue(playerStats.name, 'pendingSuddenStrike', campaignName);
            if (pendingSudden) {
                setRuntimeValue(playerStats.name, 'pendingSuddenStrike', null, campaignName);
            }
        }

        // Handle Horde Breaker: mark as used for this round
        if (attack.name === 'Horde Breaker' && isBonusActionAttack) {
            const hunterPreyChoice = getRuntimeValue(playerStats.name, "_Hunter's_Prey_choice", campaignName);
            if (hunterPreyChoice === 'Horde Breaker') {
                const usedKey = '_Hunters_Prey_HordeBreaker_UsedRound';
                const currentRound = getCurrentCombatRound();
                setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
            }
        }

        // Battle Master Attack Rider Maneuvers: prompt for maneuver selection on hit
        const isHit = popupHtml?.hit === true || popupHtml?.isCrit === true;
        if (isHit && setAttackRiderManeuverPrompt) {
            const attackInfo = {
                weaponType: attack.weaponType,
                isUnarmedStrike: attack.weaponType === 'unarmed',
                targetName: popupHtml?.targetName || null,
            };
            const availableManeuvers = await getAttackRiderOptions(playerStats, campaignName, attackInfo);
            if (availableManeuvers.length > 0) {
                setAttackRiderManeuverPrompt({
                    maneuvers: availableManeuvers,
                    attack,
                    popupHtml,
                });
                return;
            }
        }

        // Precision Attack: if attack missed, offer to add superiority die to the attack roll
        const isMiss = popupHtml?.hit === false && popupHtml?.isCrit !== true;
        if (isMiss && setAttackRiderManeuverPrompt) {
            const attackInfo = {
                weaponType: attack.weaponType,
                isUnarmedStrike: attack.weaponType === 'unarmed',
                targetName: popupHtml?.targetName || null,
            };
            const availableManeuvers = await getAttackRiderOptionsByContext(playerStats, campaignName, attackInfo, 'miss');
            if (availableManeuvers.length > 0) {
                setAttackRiderManeuverPrompt({
                    maneuvers: availableManeuvers,
                    attack,
                    popupHtml,
                    isMiss: true,
                });
                return;
            }
        }

        // Cunning Strike: prompt before sneak attack damage is applied
        const combatSummary = await loadCombatSummary(campaignName);
        const lastAttackResult = combatSummary?.lastAttack;
        const attackHit = lastAttackResult?.hit === true || lastAttackResult?.isCrit === true;
        if (attackHit) {
            const ctx = mapName ? await buildCtx(attack) : await buildCtxSync(attack);
            const sneakDice = ctx?.sneakAttackDice || 0;
            const cunningStrikePassive = (playerStats.automation?.passives || []).find(
                p => p.name === 'Devious Strikes' && p.type === 'attack_rider'
            ) || (playerStats.automation?.passives || []).find(
                p => p.name === 'Improved Cunning Strike' && p.type === 'attack_rider'
            ) || (playerStats.automation?.passives || []).find(
                p => p.name === 'Cunning Strike' && p.type === 'attack_rider'
            );
            const hasCunningStrike = !!cunningStrikePassive;
            if (hasCunningStrike && sneakDice > 0) {
                const currentRound = getCurrentCombatRound();
                const oncePerRound = getRuntimeValue(playerStats.name, '_CunningStrike_usedRound', campaignName);
                const skipRound = getRuntimeValue(playerStats.name, '_cunningStrikeSkippedRound', campaignName);
                if (oncePerRound !== currentRound && skipRound !== currentRound) {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    pendingDamageRef.current = {
                        _cunningStrike: true,
                        attack,
                        popupHtml,
                    };
                    setAttackRiderModal({
                        action: cunningStrikePassive,
                        playerStats,
                        campaignName,
                        targetName: target?.name || null,
                    });
                    return;
                }
                if (skipRound === currentRound) {
                    setRuntimeValue(playerStats.name, '_cunningStrikeSkippedRound', null, campaignName);
                }
            }
        }

        // Combat Inspiration - Offense: prompt to add BI die to damage on hit
        if (isHit && playerStats.name) {
            const hasOffense = hasBardicInspirationOffense(playerStats.name, campaignName);
            const dieSize = getBardicInspirationDieSize(playerStats.name, campaignName);
            const biUsesRaw = getRuntimeValue(playerStats.name, 'bardicInspirationUses', campaignName);
            const biUsesNum = (typeof biUsesRaw === 'object' && biUsesRaw !== null) ? biUsesRaw.current : (biUsesRaw != null ? Number(biUsesRaw) : (playerStats?._trackedResources?.bardicInspirationUses?.current ?? 0));
            if (hasOffense && dieSize && biUsesNum > 0) {
                    const targetName = popupHtml?.targetName || 'unknown target';
                    const promptId = `bi-offense-${utils.guid()}`;
                    sendBardicInspirationOffensePrompt(campaignName, playerStats.name, targetName, dieSize, promptId);
                    let biResolved = false;
                    await new Promise(resolve => {
                        const handler = event => {
                            if (event.detail.promptId !== promptId) return;
                            window.removeEventListener('bardic-inspiration-offense-result', handler);
                            biResolved = true;
                            if (event.detail.used) {
                                const biRoll = event.detail.biRoll;
                                spendResource(playerStats.name, 'bardicInspirationUses', 1, campaignName);
                                setRuntimeObject(playerStats.name, { bardicInspirationOffenseValue: String(biRoll) }, campaignName, true);
                                addEntry(campaignName, {
                                    type: 'ability_use',
                                    characterName: playerStats.name,
                                    abilityName: 'Combat Inspiration - Offense',
                                    description: `${playerStats.name} used Combat Inspiration - Offense, rolling ${biRoll} (d${dieSize}) bonus damage against ${targetName}.`,
                                    biDieRoll: biRoll,
                                    timestamp: Date.now(),
                                }).catch(() => {});
                            }
                            resolve();
                        };
                        window.addEventListener('bardic-inspiration-offense-result', handler);
                        setTimeout(() => {
                            if (!biResolved) {
                                window.removeEventListener('bardic-inspiration-offense-result', handler);
                                resolve();
                            }
                        }, 30000);
                    });
                }
            }

        const wasCrit = popupHtml?.isCrit;
        const isNatural20 = popupHtml?.isNatural20 === true;
        if (wasCrit && setPopupHtml) setPopupHtml(null);
        const result = wasCrit ? rollExpressionDoubled(attack.damage) : rollExpression(attack.damage);
        if (!result) return;

        // Build context to get sneak attack dice and other modifiers
        const ctx = mapName ? await buildCtx(attack) : await buildCtxSync(attack);
        const sneakAttackDice = ctx?.sneakAttackDice || 0;

        let formula = attack.damage;
        let total = result.total;
        let rolls = result.rolls;
        const modifier = result.modifier;

        // Apply Sneak Attack damage (Rogue class feature) — deduct Cunning Strike cost
        const cunningStrikeCost = sneakAttackDice > 0
            ? Number(getRuntimeValue(playerStats.name, '_cunningStrikeCostUsed', campaignName) ?? 0)
            : 0;
        const effectiveSneakDice = Math.max(0, sneakAttackDice - cunningStrikeCost);

        if (effectiveSneakDice > 0) {
            const sneakAttackFormula = `${effectiveSneakDice}d6`;
            const sneakAttackResult = wasCrit ? rollExpressionDoubled(sneakAttackFormula) : rollExpression(sneakAttackFormula);
            if (sneakAttackResult) {
                formula += ` + ${sneakAttackFormula} [Sneak Attack]`;
                total += sneakAttackResult.total;
                rolls = [...rolls, ...sneakAttackResult.rolls];
                await setRuntimeValue(playerStats.name, '_SneakAttack_usedRound', getCurrentCombatRound(), campaignName);
            }
        }

        // Clear cost after consumption
        if (cunningStrikeCost > 0) {
            await setRuntimeValue(playerStats.name, '_cunningStrikeCostUsed', 0, campaignName);
        }

        // Apply Two Weapon Fighting feat: add ability modifier to bonus action attack damage for light weapons
        if (isBonusActionAttack && hasTwoWeaponFighting(playerStats)) {
            const weaponProperties = attack.properties || [];
            const hasLight = weaponProperties.includes('Light');
            if (hasLight && attack.abilityName) {
                const ability = playerStats.abilities?.find(a => a.name === attack.abilityName);
                const abilityMod = ability?.bonus || 0;
                if (abilityMod > 0 && !formula.match(new RegExp(`\\+${abilityMod}\\[${attack.abilityName}\\]`))) {
                    formula += ` + ${abilityMod} [${attack.abilityName}]`;
                    total += abilityMod;
                    rolls = [...rolls, abilityMod];
                }
            }
        }

        // Apply rider damage expressions from targetEffects (e.g., Charger feat damage bonus)
        const rawEffects = getRuntimeValue(campaignName, 'targetEffects');
        const storedEffects = Array.isArray(rawEffects) ? rawEffects : [];
        const riderDamageEffects = storedEffects.filter(te => te.effect === 'damage_bonus' && te.damageExpression);
        for (const te of riderDamageEffects) {
            const riderResult = rollExpression(te.damageExpression);
            if (riderResult) {
                const dmgType = te.damageType || attack.damageType || 'same_as_weapon';
                formula += ` + ${te.damageExpression} [${dmgType}]`;
                total += riderResult.total;
                rolls = [...rolls, ...riderResult.rolls];
            }
        }

        // Apply Feinting Attack superiority die damage bonus
        const feintDieValue = getRuntimeValue(playerStats.name, 'feintingAttackDieValue', campaignName);
        if (feintDieValue && Number(feintDieValue) > 0) {
            const feintVal = Number(feintDieValue);
            const dmgType = attack.damageType || 'same_as_weapon';
            formula += ` + ${feintVal} [${dmgType}]`;
            total += feintVal;
            rolls = [...rolls, feintVal];
            await setRuntimeValue(playerStats.name, 'feintingAttackDieValue', null, campaignName);
        }

        // Apply Combat Inspiration - Offense damage bonus
        const biOffenseValue = getRuntimeValue(playerStats.name, 'bardicInspirationOffenseValue', campaignName);
        if (biOffenseValue && Number(biOffenseValue) > 0) {
            const biVal = Number(biOffenseValue);
            formula += ` + ${biVal} [Bardic Inspiration]`;
            total += biVal;
            rolls = [...rolls, biVal];
            await setRuntimeValue(playerStats.name, 'bardicInspirationOffenseValue', null, campaignName);
        }

        // Apply Riposte superiority die damage bonus (reaction attack)
        const riposteDieValue = getRuntimeValue(playerStats.name, 'pendingRiposteDieValue', campaignName);
        if (riposteDieValue && Number(riposteDieValue) > 0) {
            const riposteVal = Number(riposteDieValue);
            const dmgType = attack.damageType || 'same_as_weapon';
            formula += ` + ${riposteVal} [${dmgType}]`;
            total += riposteVal;
            rolls = [...rolls, riposteVal];
            await setRuntimeValue(playerStats.name, 'pendingRiposteDieValue', null, campaignName);
        }

        // Apply Lunging Attack superiority die damage bonus (melee hit only)
        const isMeleeOrUnarmed = attack.weaponType === 'melee' || attack.weaponType === 'unarmed';
        if (isMeleeOrUnarmed) {
            const lungingDieValue = getRuntimeValue(playerStats.name, 'lungingAttackDieValue', campaignName);
            if (lungingDieValue && Number(lungingDieValue) > 0) {
                const lungingVal = Number(lungingDieValue);
                const dmgType = attack.damageType || 'same_as_weapon';
                formula += ` + ${lungingVal} [${dmgType}]`;
                total += lungingVal;
                rolls = [...rolls, lungingVal];
                await setRuntimeValue(playerStats.name, 'lungingAttackDieValue', null, campaignName);
            }
        }

        // Apply Commander's Strike superiority die damage bonus (from ally)
        const csBonus = getRuntimeValue(playerStats.name, 'commanderStrikeBonus', campaignName);
        if (csBonus && Number(csBonus) > 0) {
            const csVal = Number(csBonus);
            const dmgType = attack.damageType || 'same_as_weapon';
            formula += ` + ${csVal} [${dmgType}]`;
            total += csVal;
            rolls = [...rolls, csVal];
            await setRuntimeValue(playerStats.name, 'commanderStrikeBonus', null, campaignName);
            await setRuntimeValue(playerStats.name, 'commanderStrikeActive', null, campaignName);
            await setRuntimeValue(playerStats.name, 'commanderStrikeSource', null, campaignName);
        }

        // Apply any melee_weapon_hit damage bonus automations (e.g. Radiant Strikes)
        if (isMeleeOrUnarmed && playerStats.automation?.actions) {
            const hitBonuses = playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'melee_weapon_hit'
            );
            for (const bonus of hitBonuses) {
                const bonusResult = rollExpression(bonus.damageExpression);
                if (bonusResult) {
                    formula += ` + ${bonus.damageExpression} [${bonus.damageType}]`;
                    total += bonusResult.total;
                    rolls = [...rolls, ...bonusResult.rolls];
                }
            }

            // Apply monk weapon / unarmed strike damage bonuses (e.g. Elemental Strike)
            const monkHitBonuses = playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'monk_weapon_or_unarmed_hit'
            );
            for (const bonus of monkHitBonuses) {
                const bonusResult = rollExpression(bonus.damageExpression);
                if (bonusResult) {
                    const elemOption = getRuntimeValue(playerStats.name, '_Elemental_Attunement_option', campaignName);
                    const damageType = elemOption ? elemOption.toLowerCase() : 'fire';
                    formula += ` + ${bonus.damageExpression} [${damageType}]`;
                    total += bonusResult.total;
                    rolls = [...rolls, ...bonusResult.rolls];
                }
            }

            // Apply Great Weapon Master Heavy Weapon Mastery damage bonus (melee_heavy_weapon_hit)
            const gwmBonuses = isMeleeOrUnarmed ? playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'melee_heavy_weapon_hit'
            ) : [];
            if (gwmBonuses.length > 0) {
                const weaponProperties = attack.properties || [];
                if (weaponProperties.includes('Heavy')) {
                    for (const bonus of gwmBonuses) {
                        let dmgType = bonus.damageType || attack.damageType || 'same_as_weapon';
                        if (dmgType === 'same_as_weapon') {
                            dmgType = attack.damageType || 'Slashing';
                        }
                        const bonusResult = rollExpression(bonus.damageExpression);
                        if (bonusResult) {
                            formula += ` + ${bonus.damageExpression} [${dmgType}]`;
                            total += bonusResult.total;
                            rolls = [...rolls, ...bonusResult.rolls];
                        }
                    }
                }
            }

            // Apply Frenzy damage bonus (reckless_attack_hit_while_raging)
            const frenzyBonuses = isMeleeOrUnarmed ? playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'reckless_attack_hit_while_raging'
            ) : [];
            if (frenzyBonuses.length > 0) {
                const playerName = playerStats.name;
                const usedRound = getRuntimeValue(playerName, '_frenzyUsedRound', campaignName);
                const currentRound = getCurrentCombatRound();
                if (usedRound !== currentRound) {
                    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
                    const isReckless = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'advantage_attacks_disadvantage_against');
                    const isRaging = Array.isArray(activeBuffs) && activeBuffs.some(b => b.damageBonusExpression);
                    const isStrengthBased = (attack.abilityName || '').toLowerCase() === 'strength';
                    if (isReckless && isRaging && isStrengthBased) {
                        for (const bonus of frenzyBonuses) {
                            let expr = bonus.damageExpression || '';
                            const rageDamage = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]?.rage_damage ?? 2;
                            expr = expr.replace(/rage_damage/g, rageDamage);
                            const bonusResult = rollExpression(expr);
                            if (bonusResult) {
                                formula += ` + ${expr} [${bonus.damageType}]`;
                                total += bonusResult.total;
                                rolls = [...rolls, ...bonusResult.rolls];
                            }
                        }
                        setRuntimeValue(playerName, '_frenzyUsedRound', currentRound, campaignName);
                    }
                }
            }

            // Apply Divine Fury damage bonus (first_hit_while_raging)
            const divineFuryBonuses = isMeleeOrUnarmed ? playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'first_hit_while_raging'
            ) : [];
            if (divineFuryBonuses.length > 0) {
                const playerName = playerStats.name;
                const usedRound = getRuntimeValue(playerName, '_divineFuryUsedRound', campaignName);
                const currentRound = getCurrentCombatRound();
                if (usedRound !== currentRound) {
                    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
                    const isRaging = Array.isArray(activeBuffs) && activeBuffs.some(b => b.damageBonusExpression);
                    if (isRaging) {
                        const bonus = divineFuryBonuses[0];
                        let expr = bonus.damageExpression || '';
                        const barbHalf = Math.floor(playerStats.level / 2);
                        expr = expr.replace(/barbarian_level\s*\/\s*2/gi, String(barbHalf))
                            .replace(/barbarian_level/gi, String(playerStats.level));
                        const bonusResult = rollExpression(expr);
                        if (bonusResult) {
                            const damageType = bonus.damageType || '';
                            if (damageType.includes(' or ')) {
                                pendingDamageRef.current = {
                                    attack, formula, total, rolls, modifier,
                                    bonusExpr: expr,
                                    bonusTotal: bonusResult.total,
                                    bonusRolls: bonusResult.rolls,
                                };
                                setDivineFuryChoice(damageType);
                                return;
                            } else {
                                formula += ` + ${expr} [${damageType}]`;
                                total += bonusResult.total;
                                rolls = [...rolls, ...bonusResult.rolls];
                            }
                        }
                        setRuntimeValue(playerName, '_divineFuryUsedRound', currentRound, campaignName);
                    }
                }
            }

            // Apply attack_rider automations (e.g. Brutal Strike)
            const hitRiders = playerStats.automation.actions.filter(
                a => a.type === 'attack_rider' && a.damageExpression && a.trigger === 'strength_attack_hit_after_reckless'
            );
            for (const rider of hitRiders) {
                const riderResult = rollExpression(rider.damageExpression);
                if (riderResult) {
                    formula += ` + ${rider.damageExpression} [${rider.damageType || 'same_as_weapon'}]`;
                    total += riderResult.total;
                    rolls = [...rolls, ...riderResult.rolls];
                }
            }
        }

        // Apply weapon_attack_hit damage bonus automations (e.g. Divine Strike, Primal Strike)
        if (playerStats.automation?.actions) {
            const allAutomation = [
                ...(playerStats.automation.actions || []),
                ...(playerStats.automation.passives || []),
            ];
            const weaponHitBonuses = playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && (a.trigger === 'weapon_attack_hit' || a.trigger === 'weapon_or_beast_form_attack_hit')
            );
            // Deduplicate: skip features that are upgraded by a higher-level feature
            const upgradedNames = new Set(allAutomation.filter(b => b.upgrades).map(b => b.upgrades));
            const filteredBonuses = weaponHitBonuses.filter(b => !upgradedNames.has(b.name));
            for (const bonus of filteredBonuses) {
                const optionKey = `_${bonus.name.replace(/\s+/g, '_')}_option`;
                const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
                const selected = chosenOption || bonus.options?.[0] || '';
                if (bonus.options?.length > 0) {
                    const isStrikeOption = selected.toLowerCase().includes('strike');
                    if (!isStrikeOption) continue;
                }
                const usedKey = `_${bonus.name.replace(/\s+/g, '_')}_usedRound`;
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                const currentRound = getCurrentCombatRound();
                if (bonus.oncePerTurn && usedRound === currentRound) continue;
                // Check uses-based recharge (e.g., Dread Ambush: uses = WIS modifier, long rest)
                if (bonus.uses_expression && bonus.recharge) {
                    const usesKey = `_${bonus.name.replace(/\s+/g, '_')}_uses`;
                    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? bonus.usesMax);
                    if (currentUses <= 0) continue;
                }
                const bonusResult = rollExpression(bonus.damageExpression);
                if (bonusResult) {
                    const damageType = bonus.damageType || '';
                    if (damageType.includes(' or ')) {
                        const types = damageType.split(/\s+or\s+/).flatMap(t => t.split(/\s+/)).filter(Boolean);
                        pendingDamageRef.current = {
                            attack, formula, total, rolls, modifier,
                            bonusExpr: bonus.damageExpression,
                            bonusTotal: bonusResult.total,
                            bonusRolls: bonusResult.rolls,
                            oncePerTurnKey: usedKey,
                        };
                        setDamageTypeChoice({
                            title: `${bonus.name} — Damage Type`,
                            types,
                        });
                        return;
                    } else {
                        formula += ` + ${bonus.damageExpression} [${damageType}]`;
                        total += bonusResult.total;
                        rolls = [...rolls, ...bonusResult.rolls];
                    }
                }
                if (bonus.oncePerTurn) {
                    setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                }
                // Decrement uses for uses-based features
                if (bonus.uses_expression && bonus.recharge) {
                    const usesKey = `_${bonus.name.replace(/\s+/g, '_')}_uses`;
                    const currentUses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? bonus.usesMax);
                    if (currentUses > 0) {
                        setRuntimeValue(playerStats.name, usesKey, currentUses - 1, campaignName);
                    }
                }
            }
        }

        // Apply natural_20_attack_roll damage bonus (e.g., Boon of Irresistible Offense - Overwhelming Strike)
        if (isNatural20 && playerStats.automation?.actions) {
            const natural20Bonuses = playerStats.automation.actions.filter(
                a => a.type === 'damage_bonus' && a.trigger === 'natural_20_attack_roll'
            );
            for (const bonus of natural20Bonuses) {
                const usedKey = `_${bonus.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (usedRound === currentRound) continue;
                let extraDamageExpr = bonus.extraDamageExpression || '';
                if (extraDamageExpr === 'increased_ability_score') {
                    const abilityName = bonus.abilityIncreased || 'Strength';
                    const ability = playerStats.abilities?.find(a => a.name === abilityName);
                    extraDamageExpr = ability?.bonus || 0;
                }
                if (extraDamageExpr) {
                    const extraDamageType = bonus.extraDamageType === 'same_as_attack' ? (attack.damageType || '') : (bonus.extraDamageType || bonus.damageType || '');
                    const extraResult = rollExpression(String(extraDamageExpr));
                    if (extraResult) {
                        formula += ` + ${extraDamageExpr} [${extraDamageType || 'same_as_attack'}]`;
                        total += extraResult.total;
                        rolls = [...rolls, ...extraResult.rolls];
                    }
                }
                setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
            }
        }

        // Apply Celestial Revelation extra damage (once per turn, based on active transformation)
        if (playerStats.automation?.passives) {
            const celestialRiders = playerStats.automation.passives.filter(
                a => a.type === 'attack_rider' && a.damageExpression && a.trigger === 'hit'
            );
            const activeBuffs = getActiveBuffs(playerStats.name, campaignName);
            const transformationNames = ['Heavenly Wings', 'Inner Radiance', 'Necrotic Shroud'];
            const activeTransformation = activeBuffs.find(b => transformationNames.includes(b.name));
            if (activeTransformation) {
                const transformationRider = celestialRiders.find(r => r.name === activeTransformation.name);
                if (transformationRider) {
                    const usedKey = `_${transformationRider.name.replace(/\s+/g, '_')}_usedRound`;
                    const currentRound = getCurrentCombatRound();
                    const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                    if (!transformationRider.oncePerTurn || usedRound !== currentRound) {
                        const bonusResult = rollExpression(transformationRider.damageExpression);
                        if (bonusResult) {
                            formula += ` + ${transformationRider.damageExpression} [${transformationRider.damageType || ''}]`;
                            total += bonusResult.total;
                            rolls = [...rolls, ...bonusResult.rolls];
                        }
                        if (transformationRider.oncePerTurn) {
                            setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                        }
                    }
                }
            }
        }

        // Apply Assassinate first_round_sneak_attack_hit damage bonus (Rogue Assassin level 3)
        if (playerStats.automation?.actions) {
            const assassinateBonus = playerStats.automation.actions.find(
                a => a.type === 'damage_bonus' && a.trigger === 'first_round_sneak_attack_hit'
            );
            if (assassinateBonus) {
                const cs = await getCombatContext(campaignName);
                const currentRound = getCurrentCombatRound();
                if (cs && currentRound === 1) {
                    const playerCreature = cs.creatures?.find(c => c.name === playerStats.name);
                    if (!playerCreature || !playerCreature.hasActed) {
                        const bonusResult = rollExpression(assassinateBonus.damageExpression);
                        if (bonusResult) {
                            const damageType = assassinateBonus.damageType || 'Sneak Attack';
                            formula += ` + ${assassinateBonus.damageExpression} [${damageType}]`;
                            total += bonusResult.total;
                            rolls = [...rolls, ...bonusResult.rolls];
                        }
                    }
                }
            }

            // Apply Stealth Attack cost deduction (Supreme Sneak)
            const stealthAttackCost = getRuntimeValue(playerStats.name, 'stealthAttackCost', campaignName);
            if (stealthAttackCost && stealthAttackCost > 0) {
                const sneakAttack = playerStats.class?.class_levels?.[playerStats.level - 1]?.sneak_attack_num_d6 || 0;
                const sneakAttackDice = sneakAttack || 0;
                if (sneakAttackDice >= stealthAttackCost) {
                    const costDice = stealthAttackCost;
                    const currentDice = sneakAttackDice - costDice;
                    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
                    if (classLevel) {
                        classLevel.sneak_attack_num_d6 = currentDice;
                    }
                    await setRuntimeValue(playerStats.name, 'stealthAttackCost', 0, campaignName);
                }
            }

        }

        // Rend Mind (Soulknife level 17) — WIS save or Stunned on Psychic Blade sneak attack hit
        const isPsychicBlade = attack.name?.includes('Psychic Blade');
        const targetName = ctx?.targetName || null;
        if (effectiveSneakDice > 0 && isPsychicBlade && targetName) {
            const passives = playerStats.automation?.passives || [];
            const rendMind = passives.find(
                a => a.type === 'attack_rider' && a.trigger === 'psychic_blade_sneak_attack_hit' && a.saveType
            );
            if (rendMind) {
                const rendMindUsedKey = '_RendMind_Used';
                let rendMindActive = getRuntimeValue(playerStats.name, rendMindUsedKey, campaignName);
                if (rendMindActive) {
                    const lastLongRest = getRuntimeValue(playerStats.name, '_LastLongRest', campaignName);
                    const currentLongRest = getRuntimeValue(playerStats.name, '_CurrentLongRest', campaignName);
                    if (lastLongRest !== currentLongRest) {
                        await setRuntimeValue(playerStats.name, rendMindUsedKey, false, campaignName);
                        rendMindActive = false;
                    }
                }
                if (!rendMindActive) {
                    const dexAbility = playerStats.abilities?.find(a => a.name === 'Dexterity');
                    const dexMod = dexAbility?.bonus || 0;
                    const prof = playerStats.proficiency || 0;
                    const saveDc = 8 + dexMod + prof;
                    const { promise } = createSaveListener(campaignName, {
                        targetName,
                        saveType: 'WIS',
                        saveDc,
                    });
                    await setRuntimeValue(playerStats.name, rendMindUsedKey, true, campaignName);
                    const saveResult = await promise;
                    if (!saveResult.success) {
                        const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
                        if (!conditions.some(c => String(c).toLowerCase() === 'stunned')) {
                            await setRuntimeValue(targetName, 'activeConditions', [...conditions, 'stunned'], campaignName);
                        }
                    }
                    addEntry(campaignName, {
                        type: 'ability_use',
                        characterName: playerStats.name,
                        abilityName: 'Rend Mind',
                        description: `Rend Mind triggered on ${targetName} — ${saveResult?.success ? 'succeeded' : 'failed'} WIS save (DC ${saveDc})${saveResult?.success ? '' : ' — Stunned condition applied'}`,
                        targetName,
                    }).catch(() => {});
                }
            }
        }

        // Apply Charger feat: Charge Attack (d8 damage or push 10ft, once per turn)
        if (playerStats.automation?.passives) {
            const chargerAttack = playerStats.automation.passives.find(
                a => a.type === 'attack_rider' && a.trigger === 'melee_hit_after_10ft_charge' && a.chooseOne
            );
            if (chargerAttack) {
                const usedKey = `_${chargerAttack.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (!usedRound || usedRound !== currentRound) {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    const targetName = target?.name || null;
                    if (targetName && chargerAttack.options?.length > 0) {
                        const option = chargerAttack.options[0];
                        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                        const newEffect = {
                            target: targetName,
                            source: chargerAttack.name,
                            option: option.name,
                            effect: option.effect,
                            value: option.value || null,
                            sizeLimit: option.sizeLimit || null,
                            noOpportunityAttacks: option.noOpportunityAttacks || false,
                            duration: 'until_start_of_next_turn',
                        };
                        const updatedEffects = [...storedEffects, newEffect];
                        setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                        setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                    }
                }
            }
        }

        // Apply Shield Master: Shield Bash (push or prone on melee hit with shield equipped, once per turn)
        if (playerStats.automation?.passives) {
            const shieldBashAttack = playerStats.automation.passives.find(
                a => a.type === 'attack_rider' && a.trigger === 'melee_hit_with_shield_equipped' && a.options?.length > 0
            );
            if (shieldBashAttack) {
                const hasShield = playerStats.inventory?.equipped?.some(itemName => {
                    const { baseName } = parseMagicItemName(itemName);
                    const item = playerStats.equipment?.find(e => e.name === baseName);
                    return item && item.equipment_category === 'Shield';
                });
                if (hasShield) {
                    const usedKey = `_${shieldBashAttack.name.replace(/\s+/g, '_')}_usedRound`;
                    const currentRound = getCurrentCombatRound();
                    const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                    if (!usedRound || usedRound !== currentRound) {
                        const cs = await getCombatContext(campaignName);
                        const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                        const targetName = target?.name || null;
                        if (targetName && shieldBashAttack.options?.length > 0) {
                            const option = shieldBashAttack.options[0];
                            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                            const newEffect = {
                                target: targetName,
                                source: shieldBashAttack.name,
                                option: option.name,
                                effect: option.effect,
                                value: option.value || null,
                                sizeLimit: option.sizeLimit || null,
                                noOpportunityAttacks: option.noOpportunityAttacks || false,
                                duration: 'until_start_of_next_turn',
                                saveType: option.saveType || null,
                                saveDc: option.saveDc || null,
                                saveAbility: option.saveAbility || null,
                                condition: option.condition || null,
                                repeatingSave: !!option.repeatingSave,
                            };
                            const updatedEffects = [...storedEffects, newEffect];
                            setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                            setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                        }
                    }
                }
            }
        }

        // Apply Hunter's Prey: Colossus Slayer (extra 1d8 to creature below max HP, once per turn)
        const hunterPreyChoice = getRuntimeValue(playerStats.name, "_Hunter's_Prey_choice", campaignName);
        if (hunterPreyChoice === 'Colossus Slayer') {
            const cs = await getCombatContext(campaignName);
            const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
            const targetName = target?.name || null;
            if (target && targetName) {
                const currentHp = target.currentHp;
                const maxHp = target.maxHp;
                if (currentHp != null && maxHp != null && currentHp < maxHp) {
                    const usedKey = '_Hunters_Prey_Colossus_UsedRound';
                    const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                    const currentRound = getCurrentCombatRound();
                    if (usedRound !== currentRound) {
                        const colossusResult = rollExpression('1d8');
                        if (colossusResult) {
                            formula += ` + 1d8 [extra]`;
                            total += colossusResult.total;
                            rolls = [...rolls, ...colossusResult.rolls];
                            setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                        }
                    }
                }
            }
        }

        // Apply Superior Hunter's Prey: spread Hunter's Mark extra damage to a different creature within 30 feet
        const hasSuperiorHunterPrey = (playerStats.automation?.passives || []).some(
            p => p.type === 'superior_hunter_prey'
        );
        if (hasSuperiorHunterPrey) {
            const cs = await getCombatContext(campaignName);
            if (cs) {
                const attacker = cs.creatures?.find(c => c.name === playerStats.name);
                const isHmTarget = attacker?.concentration?.spell === "Hunter's Mark";
                if (isHmTarget) {
                    const superiorUsedKey = '_Superior_Hunters_Prey_UsedRound';
                    const superiorUsedRound = getRuntimeValue(playerStats.name, superiorUsedKey, campaignName);
                    const currentRound = getCurrentCombatRound();
                    if (superiorUsedRound !== currentRound) {
                        const superiorResult = rollExpression('1d6');
                        if (superiorResult) {
                            const spreadFormula = `1d6 [Superior Hunters Prey]`;
                            const spreadDamageType = 'Force';
                            const primaryTargetName = cs ? getTargetFromAttacker(cs, playerStats.name)?.name : null;

                            // Find a different creature within 30 feet of the first creature
                            const spreadTargets = cs.creatures?.filter(c =>
                                c.name !== primaryTargetName &&
                                c.type === 'npc'
                            ) || [];

                            if (spreadTargets.length > 0) {
                                // Apply to the first eligible target
                                const spreadTarget = spreadTargets[0];
                                const combatSummary = await loadCombatSummary(campaignName);
                                const spreadApplyResult = combatSummary
                                    ? applyDamageToTarget(combatSummary, spreadTarget.name, superiorResult.total, [spreadDamageType], campaignName, null, false, playerStats.name)
                                    : null;

                                // Log the spread damage
                                addEntry(campaignName, {
                                    type: 'roll',
                                    characterName: playerStats.name,
                                    rollType: 'damage',
                                    name: "Superior Hunter's Prey",
                                    formula: spreadFormula,
                                    rolls: superiorResult.rolls,
                                    total: superiorResult.total,
                                    modifier: 0,
                                    damageType: spreadDamageType,
                                    targetName: spreadTarget.name,
                                    finalDamage: spreadApplyResult?.finalDamage,
                                }).catch((e) => { console.error("[useAttackDamageResolution] Error:", e); });

                                // Update popup to include spread damage info
                                if (spreadApplyResult) {
                                    setPopupHtml(prev => ({
                                        ...prev,
                                        spreadTargetName: spreadTarget.name,
                                        spreadFinalDamage: spreadApplyResult.finalDamage,
                                        spreadTargetCurrentHp: spreadApplyResult.newHp,
                                        spreadTargetMaxHp: spreadTarget.type === 'player'
                                            ? (getRuntimeValue(spreadTarget.name, 'hitPoints') ?? 0)
                                            : spreadTarget.maxHp,
                                    }));
                                }

                                setRuntimeValue(playerStats.name, superiorUsedKey, currentRound, campaignName);
                            }
                        }
                    }
                }
            }
        }

        // Apply attack_rider automations with weapon_attack_hit trigger (e.g. Eldritch Strike)
        // These features are routed to passives by the collector, not actions
        const eldritchStrikes = [
            ...(playerStats.automation?.actions || []),
            ...(playerStats.automation?.passives || []),
        ].filter(
            a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && !a.damageExpression && a.name !== "Stalker's Flurry"
        );
        for (const rider of eldritchStrikes) {
            const usedKey = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
            const currentRound = getCurrentCombatRound();
            const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
            if (rider.oncePerTurn && usedRound === currentRound) continue;

            const cs = await getCombatContext(campaignName);
            const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
            const targetName = target?.name || null;

            if (targetName && rider.options?.length > 0) {
                const option = rider.options[0];
                const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                const newEffect = {
                    target: targetName,
                    source: rider.name,
                    option: option.name,
                    effect: option.effect,
                    value: option.value || null,
                    noOpportunityAttacks: option.noOpportunityAttacks || false,
                    duration: 'until_start_of_next_turn',
                };
                const updatedEffects = [...storedEffects, newEffect];
                setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

                if (rider.oncePerTurn) {
                    setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                }

                await addEntry(campaignName, {
                    type: 'ability_use',
                    characterName: playerStats.name,
                    abilityName: rider.name,
                    description: `${playerStats.name} used ${rider.name} on ${targetName}, imposing Disadvantage on the target's next saving throw.`,
                    targetName: targetName,
                }).catch((e) => { console.error("[useAttackDamageResolution] Error:", e); });
            }
        }

        // Apply Stalker's Flurry attack_rider (Sudden Strike / Mass Fear)
        const flurryPassives = [
            ...(playerStats.automation?.passives || []),
        ];
        if (flurryPassives.length > 0) {
            const stalkerFlurry = flurryPassives.find(
                a => a.type === 'attack_rider' && a.trigger === 'weapon_attack_hit' && a.chooseOne && a.options?.length > 0 && a.name === "Stalker's Flurry"
            );
            if (stalkerFlurry) {
                const usedKey = `_${stalkerFlurry.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (stalkerFlurry.oncePerTurn && usedRound === currentRound) {
                    // Already used this round
                } else {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    const targetName = target?.name || null;

                    if (targetName) {
                        const optionKey = `_${stalkerFlurry.name.replace(/\s+/g, '_')}_option`;
                        const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
                        if (!chosenOption) {
                            // Present choice modal
                            setAttackRiderModal({
                                action: stalkerFlurry,
                                playerStats,
                                campaignName,
                                targetName,
                            });
                            return;
                        } else {
                            // Apply chosen option
                            const option = stalkerFlurry.options.find(o => o.name === chosenOption);
                            if (option) {
                                if (option.effect === 'sudden_strike') {
                                    setRuntimeValue(playerStats.name, 'pendingSuddenStrike', true, campaignName);
                                } else if (option.effect === 'mass_fear') {
                                    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                                    const newEffect = {
                                        target: targetName,
                                        source: stalkerFlurry.name,
                                        option: option.name,
                                        effect: 'mass_fear',
                                        saveType: option.saveType || 'WIS',
                                        saveDc: option.saveDc || 'ability',
                                        saveAbility: option.saveAbility || 'WIS',
                                        condition: option.condition || 'frightened',
                                        duration: option.duration || 'until_start_of_next_turn',
                                        range: option.range || '10_ft',
                                    };
                                    const updatedEffects = [...storedEffects, newEffect];
                                    setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                                }
                            }
                            if (stalkerFlurry.oncePerTurn) {
                                setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                            }
                        }
                    }
                }
            }
        }

        // Apply Crusher feat: Push (once per turn, bludgeoning hit) and Enhanced Critical (bludgeoning crit → advantage against target)
        const crusherDamageType = (attack.damageType || '').toLowerCase();
        const isCrusherBludgeoning = crusherDamageType === 'bludgeoning';
        if (playerStats.automation?.passives) {
            const crusherPush = playerStats.automation.passives.find(
                a => a.type === 'attack_rider' && a.trigger === 'bludgeoning_damage_hit' && a.oncePerTurn
            );
            if (crusherPush) {
                const crusherUsedKey = `_${crusherPush.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const crusherUsedRound = getRuntimeValue(playerStats.name, crusherUsedKey, campaignName);
                const shouldPush = isCrusherBludgeoning && (!crusherUsedRound || crusherUsedRound !== currentRound);

                if (shouldPush) {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    const targetName = target?.name || null;
                    if (targetName && crusherPush.options?.length > 0) {
                        const option = crusherPush.options[0];
                        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                        const newEffect = {
                            target: targetName,
                            source: crusherPush.name,
                            option: option.name,
                            effect: option.effect,
                            value: option.value || null,
                            sizeLimit: option.sizeLimit || null,
                            noOpportunityAttacks: option.noOpportunityAttacks || false,
                            duration: 'until_start_of_next_turn',
                        };
                        const updatedEffects = [...storedEffects, newEffect];
                        setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                        setRuntimeValue(playerStats.name, crusherUsedKey, currentRound, campaignName);
                    }
                }
            }

            // Enhanced Critical: when you score a Critical Hit with Bludgeoning damage,
            // attack rolls against that creature have Advantage until start of your next turn
            if (wasCrit && isCrusherBludgeoning) {
                const crusherCrit = playerStats.automation.passives.find(
                    a => a.type === 'conditional_advantage' && a.trigger === 'critical_hit_bludgeoning'
                );
                if (crusherCrit) {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    const targetName = target?.name || null;
                    if (targetName) {
                        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                        const newEffect = {
                            target: targetName,
                            source: crusherCrit.name,
                            effect: 'crusher_enhanced_critical',
                            duration: 'until_start_of_next_turn',
                        };
                        const updatedEffects = [...storedEffects, newEffect];
                        setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                    }
                }
            }
        }

        // Apply Slasher feat: Hamstring (speed reduction on slashing hit, once per turn) and Enhanced Critical (disadvantage on slashing crit)
        const slasherDamageType = (attack.damageType || '').toLowerCase();
        const isSlasherSlashing = slasherDamageType === 'slashing';
        if (playerStats.automation?.passives) {
            const slasherHamstring = playerStats.automation.passives.find(
                a => a.type === 'attack_rider' && a.trigger === 'slashing_damage_hit' && a.oncePerTurn
            );
            if (slasherHamstring) {
                const slasherUsedKey = `_${slasherHamstring.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const slasherUsedRound = getRuntimeValue(playerStats.name, slasherUsedKey, campaignName);
                const shouldHamstring = isSlasherSlashing && (!slasherUsedRound || slasherUsedRound !== currentRound);

                if (shouldHamstring) {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    const targetName = target?.name || null;
                    if (targetName && slasherHamstring.options?.length > 0) {
                        const option = slasherHamstring.options[0];
                        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                        const newEffect = {
                            target: targetName,
                            source: slasherHamstring.name,
                            option: option.name,
                            effect: option.effect,
                            value: option.value || 10,
                            duration: 'until_start_of_next_turn',
                        };
                        const updatedEffects = [...storedEffects, newEffect];
                        setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                        setRuntimeValue(playerStats.name, slasherUsedKey, currentRound, campaignName);
                    }
                }
            }

            // Enhanced Critical: when you score a Critical Hit with Slashing damage,
            // the target has Disadvantage on attack rolls until start of your next turn
            if (wasCrit && isSlasherSlashing) {
                const slasherCrit = playerStats.automation.passives.find(
                    a => a.type === 'conditional_advantage' && a.trigger === 'critical_hit_slashing'
                );
                if (slasherCrit) {
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    const targetName = target?.name || null;
                    if (targetName) {
                        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                        const newEffect = {
                            target: targetName,
                            source: slasherCrit.name,
                            effect: 'disadvantage_next_attack',
                            duration: 'until_start_of_next_turn',
                        };
                        const updatedEffects = [...storedEffects, newEffect];
                        setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);
                    }
                }
            }
        }

        // Apply Piercer feat: Puncture (reroll one damage die on piercing hit, once per turn)
        const piercerDamageType = (attack.damageType || '').toLowerCase();
        const isPiercerPiercing = piercerDamageType === 'piercing';
        if (playerStats.automation?.passives && isPiercerPiercing) {
            const piercerPuncture = playerStats.automation.passives.find(
                a => a.type === 'attack_rider' && a.trigger === 'piercing_damage_hit' && a.oncePerTurn
            );
            if (piercerPuncture) {
                const piercerUsedKey = `_${piercerPuncture.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const piercerUsedRound = getRuntimeValue(playerStats.name, piercerUsedKey, campaignName);
                if (!piercerUsedRound || piercerUsedRound !== currentRound) {
                    const rerollCount = piercerPuncture.rerollCount || 1;
                    const rerolled = [];
                    for (let i = 0; i < Math.min(rerollCount, rolls.length); i++) {
                        const rerolledVal = Math.floor(Math.random() * 6) + 1;
                        // Find which die to reroll (pick the largest for best result)
                        if (rolls.length > 0) {
                            let maxIdx = 0;
                            for (let j = 1; j < rolls.length; j++) {
                                if (rolls[j] > rolls[maxIdx]) maxIdx = j;
                            }
                            const original = rolls[maxIdx];
                            rolls[maxIdx] = rerolledVal;
                            const diff = rerolledVal - original;
                            total += diff;
                            rerolled.push({ original, rerolled: rerolledVal });
                        }
                    }
                    if (rerolled.length > 0) {
                        formula += ` [Piercer Reroll]`;
                        setRuntimeValue(playerStats.name, piercerUsedKey, currentRound, campaignName);
                    }
                }
            }

            // Enhanced Critical: when you score a Critical Hit with Piercing damage,
            // roll one additional damage die
            if (wasCrit) {
                const piercerCrit = playerStats.automation.passives.find(
                    a => a.type === 'damage_bonus' && a.trigger === 'critical_hit_piercing'
                );
                if (piercerCrit) {
                    const weaponDieType = piercerCrit.diceType || 'weapon_die';
                    if (weaponDieType === 'weapon_die' && attack.damage) {
                        const dieMatch = attack.damage.match(/(\d+)d(\d+)/);
                        if (dieMatch) {
                            const numDice = parseInt(dieMatch[1], 10);
                            const dieSize = parseInt(dieMatch[2], 10);
                            if (numDice > 0 && dieSize > 0) {
                                const extraDieSize = dieSize;
                                const extraDieRoll = Math.floor(Math.random() * extraDieSize) + 1;
                                formula += ` + 1 [${attack.damageType}]`;
                                total += extraDieRoll;
                                rolls = [...rolls, extraDieRoll];
                            }
                        }
                    }
                }
            }
        }

        // Apply Savage Attacker feat: roll weapon damage dice twice, use either total (once per turn)
        const hasSavageAttacker = playerStats.automation?.passives?.some(
            p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn'
        );
        if (hasSavageAttacker && attack.damage) {
            const savageAttackerFeature = playerStats.automation.passives.find(
                p => p.type === 'passive_rule' && p.effect === 'reroll_damage_once_per_turn'
            );
            const savageUsedKey = `_${savageAttackerFeature?.name?.replace(/\s+/g, '_') || 'SavageAttacker'}_usedRound`;
            const currentRound = getCurrentCombatRound();
            const savageUsedRound = getRuntimeValue(playerStats.name, savageUsedKey, campaignName);
            if (!savageUsedRound || savageUsedRound !== currentRound) {
                const diceMatch = attack.damage.match(/(\d+)d(\d+)/);
                if (diceMatch && rolls.length > 0) {
                    const numDice = parseInt(diceMatch[1], 10);
                    const dieSize = parseInt(diceMatch[2], 10);
                    if (numDice > 0 && dieSize > 0 && numDice === rolls.length) {
                        // Roll damage dice twice and compare totals
                        const firstTotal = rolls.reduce((sum, r) => sum + r, 0);
                        const secondRolls = [];
                        for (let i = 0; i < numDice; i++) {
                            secondRolls.push(Math.floor(Math.random() * dieSize) + 1);
                        }
                        const secondTotal = secondRolls.reduce((sum, r) => sum + r, 0);
                        if (secondTotal > firstTotal) {
                            const diff = secondTotal - firstTotal;
                            total += diff;
                            rolls = secondRolls;
                            formula += ` [Savage Attacker]`;
                        }
                        setRuntimeValue(playerStats.name, savageUsedKey, currentRound, campaignName);
                    }
                }
            }
        }

        // Tavern Brawler: Force reroll 1s on unarmed strike damage dice (must use new roll)
        if (attack.weaponType === 'unarmed' && playerStats.automation?.passives && attack.damage) {
            const tavernBrawlerReroll = (playerStats.automation.passives || []).find(p => p.effect === 'tavern_brawler_reroll_ones');
            if (tavernBrawlerReroll) {
                const diceMatch = attack.damage.match(/(\d+)d(\d+)/);
                if (diceMatch && rolls.length > 0) {
                    const dieSize = parseInt(diceMatch[2], 10);
                    let rerolled = false;
                    for (let i = 0; i < rolls.length; i++) {
                        if (rolls[i] === 1) {
                            const rerolledVal = Math.floor(Math.random() * dieSize) + 1;
                            total += rerolledVal - 1;
                            rolls[i] = rerolledVal;
                            rerolled = true;
                        }
                    }
                    if (rerolled) {
                        formula += ' [Tavern Brawler]';
                    }
                }
            }
        }

        if (playerStats.automation?.actions) {
            const isCantrip = attack.baseLevel === 0 || playerStats.spellAbilities?.spells?.some(s => s.name === attack.name && s.level === 0);
            if (isCantrip) {
                const cantripBonuses = playerStats.automation.actions.filter(
                    a => a.type === 'damage_bonus' && a.options?.length > 0
                );
                // Deduplicate: skip features that are upgraded by a higher-level feature
                const allAutomation = [
                    ...(playerStats.automation.actions || []),
                    ...(playerStats.automation.passives || []),
                ];
                const upgradedNames = new Set(allAutomation.filter(b => b.upgrades).map(b => b.upgrades));
                const filteredBonuses = cantripBonuses.filter(b => !upgradedNames.has(b.name));
                for (const bonus of filteredBonuses) {
                    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
                    const wisMod = Math.max(0, wis?.bonus || 0);
                    if (wisMod > 0) {
                        formula += ` + ${wisMod} [Cantrip]`;
                        total += wisMod;
                    }
                    const tempHp = evaluateAutoExpression(bonus.tempHpExpression, playerStats);
                    if (tempHp && !isNaN(tempHp)) {
                        const cs = await getCombatContext(campaignName);
                        const allies = cs?.creatures?.filter(c =>
                            c.type === 'player' || c.type === 'npc' || c.type === 'monster'
                        ) || [];
                        if (setSecondaryTargetModal && allies.length > 0) {
                            const targets = allies.map(c => ({
                                name: c.name,
                                currentHp: c.currentHp,
                                maxHp: c.maxHp,
                                size: c.size,
                                type: c.type,
                            }));
                              setSecondaryTargetModal({
                                  title: 'Improved Blessed Strikes — Potent Spellcasting',
                                  targets,
                                  confirmLabel: 'Grant Temp HP',
                                  onTargetSelected: async (targetName) => {
                                      const existing = getRuntimeValue(targetName, 'tempHp', campaignName) || 0;
                                      setRuntimeValue(targetName, 'tempHp', Math.max(existing, tempHp), campaignName);
                                      postLogEntry(campaignName, {
                                          type: 'roll',
                                          characterName: playerStats.name,
                                          rollType: 'temp-hp',
                                          name: 'Potent Spellcasting',
                                          targetName,
                                          note: `Gained ${tempHp} temporary hit points from Potent Spellcasting`,
                                          total: tempHp,
                                      });
                                      setSecondaryTargetModal(null);
                                  },
                                  onSkip: () => {
                                      const existing = getRuntimeValue(playerStats.name, 'tempHp', campaignName) || 0;
                                      setRuntimeValue(playerStats.name, 'tempHp', Math.max(existing, tempHp), campaignName);
                                      postLogEntry(campaignName, {
                                          type: 'roll',
                                          characterName: playerStats.name,
                                          rollType: 'temp-hp',
                                          name: 'Potent Spellcasting',
                                          targetName: playerStats.name,
                                          note: `Gained ${tempHp} temporary hit points from Potent Spellcasting`,
                                          total: tempHp,
                                      });
                                      setSecondaryTargetModal(null);
                                  },
                                  featureDescription: `Grant ${tempHp} temporary hit points to a creature within 60 feet.`,
                                  description: 'Choose a creature to grant temporary hit points from Potent Spellcasting.',
                              });
                            return;
                        } else {
                            const existing = getRuntimeValue(playerStats.name, 'tempHp', campaignName) || 0;
                            setRuntimeValue(playerStats.name, 'tempHp', Math.max(existing, tempHp), campaignName);
                        }
                    }
                }
            }
        }

        // Tavern Brawler: Push target 5 ft on unarmed strike hit (once per turn)
        if (attack.weaponType === 'unarmed' && playerStats.automation?.passives) {
            const tavernBrawlerPush = (playerStats.automation.passives || []).find(p => p.effect === 'tavern_brawler_push');
            if (tavernBrawlerPush) {
                const currentRound = getCurrentCombatRound();
                const usedKey = '_Tavern_Brawler_Push_UsedRound';
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (!usedRound || usedRound !== currentRound) {
                    setRuntimeValue(playerStats.name, usedKey, currentRound, campaignName);
                    const cs = await getCombatContext(campaignName);
                    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
                    const targetName = target?.name || null;
                    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
                    const newEffect = {
                        target: targetName,
                        source: 'Tavern Brawler',
                        effect: 'push',
                        value: 5,
                        duration: 'until_end_of_turn',
                    };
                    setRuntimeValue(campaignName, 'targetEffects', [...storedEffects, newEffect], campaignName);
                }
            }
        }

        // Apply Sacred Weapon damage type modification for melee attacks
        if ((attack.weaponType === 'melee' || attack.weaponType === 'unarmed') && playerStats.automation?.passives) {
            const sacredWeaponBuff = (playerStats.automation.passives || []).find(p => p.name === 'Sacred Weapon' && p.effect === 'sacred_weapon');
            if (sacredWeaponBuff) {
                const storedBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName) || [];
                const swBuff = storedBuffs.find(b => b.name === 'Sacred Weapon' && b.effect === 'sacred_weapon');
                if (swBuff?.damageTypeChoice) {
                    attack.damageType = swBuff.damageTypeChoice;
                }
            }
        }

        // Apply damage_type_modifier automations for Unarmed Strike (e.g. Empowered Strikes)
        if (attack.weaponType === 'unarmed' && playerStats.automation?.passives) {
            const damageTypeModifiers = playerStats.automation.passives.filter(
                a => a.type === 'damage_type_modifier' && a.trigger === 'unarmed_strike_hit'
            );
            for (const modifier of damageTypeModifiers) {
                const usedKey = `_${modifier.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (modifier.oncePerTurn && usedRound === currentRound) continue;

                const storedType = getRuntimeValue(playerStats.name, 'empoweredStrikesDamageType', campaignName);
                if (storedType) {
                    attack.damageType = storedType;
                    setRuntimeValue(playerStats.name, 'empoweredStrikesDamageType', null, campaignName);
                    break;
                }

                if (modifier.options?.length > 0) {
                    pendingDamageRef.current = { attack, formula, total, rolls, modifier, _damageTypeModifier: modifier };
                    setDamageTypeChoice({
                        title: `${modifier.name} — Damage Type`,
                        types: modifier.options.map(o => o.damageType),
                    });
                    return;
                }
            }

            // Apply attack_rider automations for Unarmed Strike (e.g. Unarmed Fighting Enhanced Unarmed Strike)
            const attackRiders = playerStats.automation.passives.filter(
                a => a.type === 'attack_rider' && a.trigger === 'unarmed_strike_hit' && a.chooseOne && a.options?.length > 0
            );
            for (const rider of attackRiders) {
                const usedKey = `_${rider.name.replace(/\s+/g, '_')}_usedRound`;
                const currentRound = getCurrentCombatRound();
                const usedRound = getRuntimeValue(playerStats.name, usedKey, campaignName);
                if (rider.oncePerTurn && usedRound === currentRound) continue;

                const storedOption = getRuntimeValue(playerStats.name, `_${rider.name.replace(/\s+/g, '_')}_selectedOption`, campaignName);
                if (storedOption) {
                    const chosenOption = rider.options.find(o => o.name === storedOption);
                    if (chosenOption && chosenOption.effect === 'damage_bonus') {
                        const riderResult = rollExpression(chosenOption.damageExpression);
                        if (riderResult) {
                            formula += ` + ${chosenOption.damageExpression} [${chosenOption.damageType || 'same_as_weapon'}]`;
                            total += riderResult.total;
                            rolls = [...rolls, ...riderResult.rolls];
                        }
                        setRuntimeValue(playerStats.name, `_${rider.name.replace(/\s+/g, '_')}_selectedOption`, null, campaignName);
                        continue;
                    }
                }

                if (rider.options?.length > 0) {
                    pendingDamageRef.current = { attack, formula, total, rolls, rider, _attackRider: rider };
                    setDamageTypeChoice({
                        title: `${rider.name} — Enhanced Unarmed Strike`,
                        types: rider.options.map(o => o.name),
                        _attackRider: rider,
                    });
                    return;
                }
            }
        }

        proceedWithDamage(attack, formula, total, rolls, modifier);
    };

    const handleAttackRiderManeuverUse = async (maneuver, attack, popupHtmlData, currentFormula, currentTotal, currentRolls) => {
        const maneuverName = maneuver?.name || maneuver;
        const attackInfo = {
            weaponType: attack.weaponType,
            isUnarmedStrike: attack.weaponType === 'unarmed',
            targetName: popupHtmlData?.targetName || null,
        };
        const action = { automation: {} };
        const result = await executeAttackRiderManeuverService(action, playerStats, campaignName, maneuverName, attackInfo);

        let updatedFormula = currentFormula;
        let updatedTotal = currentTotal;
        let updatedRolls = [...currentRolls];

        if (popupHtmlData?.isMiss && popupHtml) {
            if (maneuver && maneuver.effect === 'attack_roll_bonus') {
                const dieRoll = rollExpression(maneuver.dieExpression || 'superiority_die');
                const dieValue = dieRoll?.total || evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);
                const origD20 = (popupHtml.rolls?.[0] != null && popupHtml.rolls[0] !== 20) ? popupHtml.rolls[0] : (popupHtml.rolls?.[0] || 0);
                const origBonus = popupHtml.bonus || 0;
                const origTotal = origD20 + origBonus;
                const newTotal = origTotal + dieValue;
                const targetAC = popupHtml.targetAc || 10;
                const newHit = newTotal >= targetAC;
                const isNatural20 = origD20 === 20;
                const wasCrit = popupHtml.isCrit;

                const updatedPopup = {
                    ...popupHtml,
                    total: newTotal,
                    hit: newHit,
                    isCrit: isNatural20 || wasCrit,
                    isNatural20: isNatural20,
                    superiorityDieAdded: dieValue,
                    originalTotal: origTotal,
                    originalD20: origD20,
                };

                const dieDesc = `Precision Attack: Added ${dieValue} to the attack roll (${origD20} + ${origBonus} + ${dieValue} = ${newTotal}). ${newHit ? 'The attack now hits!' : 'The attack still misses.'}`;

                setAttackRiderManeuverPrompt(null);
                setPopupHtml(updatedPopup);

                return {
                    formula: updatedFormula,
                    total: updatedTotal,
                    rolls: updatedRolls,
                    isMissResult: true,
                    hit: newHit,
                    description: dieDesc,
                };
            }
        } else {
            if (result?.type === 'popup') {
                if (maneuver?.damageBonus) {
                    const dieRoll = rollExpression(maneuver.dieExpression || 'superiority_die');
                    const dieValue = dieRoll?.total || evaluateAutoExpression(maneuver.dieExpression || 'superiority_die', playerStats);
                    const dmgType = attack.damageType || 'same_as_weapon';
                    updatedFormula += ` + ${dieValue} [${dmgType}]`;
                    updatedTotal += dieValue;
                    updatedRolls = [...updatedRolls, dieValue];
                }
            }

            setAttackRiderManeuverPrompt(null);
            if (result?.type === 'popup') {
                setPopupHtml(result.payload);
            }
            if (result?.type === 'modal' && result.modalName === 'sweepingAttackTarget') {
                setSweepingAttackTargetModal(result.payload);
            }
        }

        return { formula: updatedFormula, total: updatedTotal, rolls: updatedRolls };
    };

    const handleAttackRiderManeuverSkip = () => {
        setAttackRiderManeuverPrompt(null);
    };

    return { resolveAttackDamage, proceedWithDamage, handleAttackRiderManeuverUse, handleAttackRiderManeuverSkip };
}

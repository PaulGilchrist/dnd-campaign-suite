import { onSpellSelected as onDivineInterventionSpellSelected } from '../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'
import { getClassFeatures } from '../../services/character/classFeatures.js'

const MONK_KI_FEATURES = ['Flurry of Blows', 'Patient Defense', 'Step of the Wind', 'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind', 'Hand of Healing', 'Stunning Strike'];

async function gateStunningStrike({ action, auto, playerName, campaignName, getRuntimeValue, addEntry, setPopupHtml }) {
    if (!(action.name === 'Stunning Strike' && auto?.trigger === 'monk_weapon_or_unarmed_hit')) {
        return { armed: false, round: 1, blocked: false };
    }
    const lastAttack = getRuntimeValue('campaign', 'lastAttack', campaignName);
    const combat = await getCombatContext(campaignName);
    const stunningStrikeRound = combat?.round || 1;
    const denyStunningStrike = (reason) => {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: action.name,
            description: `${action.name} blocked — ${reason}`,
        }).catch((e) => { console.error("[useCharActionsAutomation:log-error]", e); });
        setPopupHtml(`<b>${action.name}</b><br/>${reason}`);
    };
    const used = getRuntimeValue(playerName, '_StunningStrike_usedRound', campaignName);
    if (used && stunningStrikeRound <= (used.round ?? stunningStrikeRound)) {
        denyStunningStrike('Once per turn — already used this turn.');
        return { armed: false, round: stunningStrikeRound, blocked: true };
    }
    if (!lastAttack || lastAttack.attackerName !== playerName) {
        denyStunningStrike('Last attack was not made by you.');
        return { armed: false, round: stunningStrikeRound, blocked: true };
    }
    if (lastAttack.weaponType !== 'melee' || lastAttack.isAutoMiss === true) {
        denyStunningStrike('Requires a melee weapon attack.');
        return { armed: false, round: stunningStrikeRound, blocked: true };
    }
    if (lastAttack.hit !== true) {
        denyStunningStrike('Last melee attack did not hit.');
        return { armed: false, round: stunningStrikeRound, blocked: true };
    }
    return { armed: true, round: stunningStrikeRound, blocked: false };
}

const FOCUS_COST_SKIP_FEATURES = ['Hand of Healing', 'Flurry of Blows', 'Heightened Flurry of Blows'];

function shouldSkipFocusPointCost(action, hasFlurryHealingHarm, cloakActive) {
    // Skip FP cost for Hand of Healing / Flurry of Blows with Flurry of Healing and Harm,
    // or for Flurry of Blows when Cloak of Shadows (Shadow Flurry) is active.
    if (hasFlurryHealingHarm && FOCUS_COST_SKIP_FEATURES.includes(action.name)) return true;
    return cloakActive && action.name !== 'Hand of Healing' && FOCUS_COST_SKIP_FEATURES.includes(action.name);
}

function resolveCurrentFocusPoints(playerStats, campaignName, getRuntimeValue) {
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxFP = classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
    const storedFP = getRuntimeValue(playerStats.name, 'focusPoints', campaignName);
    return storedFP != null ? Number(storedFP) : (playerStats._trackedResources?.focusPoints?.current ?? maxFP);
}

async function markStunningStrikeUsed({ playerStats, playerName, campaignName, action, stunningStrikeRound, setRuntimeValue, addEntry, getRuntimeValue }) {
    await setRuntimeValue(playerStats.name, '_StunningStrike_usedRound', { round: stunningStrikeRound, activeCreature: playerName }, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name} — expended 1 ${playerStats.rules === '2024' ? 'Focus Point' : 'ki point'} to attempt to stun ${getRuntimeValue('campaign', 'lastAttack', campaignName)?.targetName || 'target'}.`,
    }).catch((e) => { console.error("[useCharActionsAutomation:log-error]", e); });
}

async function spendMonkFocusPoint({ action, auto, playerStats, playerName, campaignName, cloakActive, hasFlurryHealingHarm, stunningStrikeArmed, stunningStrikeRound, getRuntimeValue, setRuntimeValue, setPopupHtml, addEntry }) {
    // Spend 1 focus point for monk Ki features before dispatching
    // Skip pre-spend for 2024 patient_defense: patientDefenseHandler is the sole FP
    // writer (focus mode spends 1 FP, plain Disengage spends none) — pre-spending here
    // double-charged and blocked the plain-Disengage fallback (CLA-247)
    // Skip pre-spend for step_of_the_wind too: stepOfTheWindHandler is the sole FP
    // writer for both rulesets (gates FP>=1, spends once, writes the Disengage te) —
    // pre-spending here double-charged 2 FP per click (CLA-333)
    if (!(MONK_KI_FEATURES.includes(action.name) && auto?.type !== 'patient_defense' && auto?.type !== 'step_of_the_wind')) {
        return true;
    }
    if (shouldSkipFocusPointCost(action, hasFlurryHealingHarm, cloakActive)) return true;
    const currentFP = resolveCurrentFocusPoints(playerStats, campaignName, getRuntimeValue);
    if (currentFP <= 0) {
        setPopupHtml(`<b>${action.name}</b><br/>No ${playerStats.rules === '2024' ? "Focus Points" : 'ki points'} remaining.`);
        return false;
    }
    await setRuntimeValue(playerStats.name, 'focusPoints', currentFP - 1, campaignName);
    window.dispatchEvent(new CustomEvent('focus-points-updated'));
    if (stunningStrikeArmed) {
        await markStunningStrikeUsed({ playerStats, playerName, campaignName, action, stunningStrikeRound, setRuntimeValue, addEntry, getRuntimeValue });
    }
    return true;
}

function gateFeatureOptionChoice({ auto, action, playerStats, campaignName, getRuntimeValue, setModalState }) {
    // If feature has options that need choosing (e.g. Blessed Strikes), present choice
    if (auto?.type === 'damage_bonus' && auto?.options?.length > 0) {
        const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
        const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
        if (!chosenOption) {
            setModalState({ featureChoice: { action, options: auto.options, optionKey } });
            return true;
        }
    }
    // Defensive Tactics: present choice between Escape the Horde and Multiattack Defense
    if (auto?.type === 'defensive_tactics') {
        const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
        const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
        if (!chosenOption) {
            setModalState({ featureChoice: { action, options: ['Escape the Horde', 'Multiattack Defense'], optionKey } });
            return true;
        }
    }
    return false;
}

// Check trigger conditions for gated actions
async function gateTriggerRequirement({ auto, action, playerStats, campaignName, getRuntimeValue, setRuntimeValue, setPopupHtml }) {
    if (auto?.trigger && auto.trigger !== '' && auto.trigger === 'after_casting_action_spell') {
        const lastCast = getRuntimeValue(playerStats.name, 'lastActionSpellCast', campaignName);
        if (!lastCast) {
            setPopupHtml(`<b>${action.name}</b><br/>You must cast a spell with a casting time of an action first.`);
            return false;
        }
        await setRuntimeValue(playerStats.name, 'lastActionSpellCast', 0, campaignName);
    }
    return true;
}

function dispatchRollResult(payload, rollDamage) {
    if (payload.rollType !== 'damage') return;
    rollDamage(
        payload.name,
        payload.formula,
        payload.total,
        payload.rolls,
        payload.modifier,
        payload.contextConfig || {}
    );
}

function dispatchAttackRollResult(payload, rollAttack) {
    const { attack, targetName } = payload;
    const autoDamageFormula = attack?.autoDamageFormula || null;
    const autoDamageName = attack?.autoDamageName || attack?.name;
    const damageType = attack?.damageType || 'Slashing';
    rollAttack(attack.name, attack.hitBonus, { targetName, forcedMode: undefined, isOpportunityAttack: false, autoDamageFormula, autoDamageName, damageType });
}

function finalizeAutomationOutcome(result, auto, addEntry, campaignName, onBuffsChange) {
    if (result.logEntries) {
        result.logEntries.forEach(entry => addEntry(campaignName, entry).catch((e) => { console.error("[useCharActionsAutomation:log-error]", e); }));
    }
    if (result.type === 'popup' && (auto?.type === 'temp_buff' || auto?.type === 'combat_stance')) {
        if (onBuffsChange) onBuffsChange();
    }
}

function applyCastTriggerResult(tr, spell, setModalState, setPopupHtml) {
    if (tr.type === 'modal') {
        if (tr.modalName === 'wildMagicSurge') {
            setModalState({ wildMagicSurgeModal: tr.payload });
        }
    } else if (tr.type === 'popup') {
        const name = tr.payload?.name || spell.name || 'Automation';
        const description = tr.payload?.description || '';
        setPopupHtml({ type: 'automation_info', name, description });
    }
}

function buildCastHealPopup(healResult, spell) {
    const bonusHealDetail = healResult.bonusDetails?.length > 0
        ? healResult.bonusDetails.map(d => `${d.amount} ${d.name}`).join(', ')
        : '';
    const rawTotal = healResult.rawTotal ?? healResult.healAmount;
    return {
        type: 'heal',
        name: spell.name,
        formula: healResult.formula,
        rolls: healResult.rolls || [],
        total: rawTotal,
        targetName: healResult.targetName,
        finalHeal: healResult.healAmount,
        bonusHeal: healResult.bonusHeal || 0,
        bonusHealDetail,
        healingRerollOriginalRolls: healResult.healingRerollOriginalRolls || null,
        healingRerollDisplayRolls: healResult.healingRerollDisplayRolls || null,
    };
}

export default function useCharActionsAutomation({
    cannotAct,
    playerStats,
    campaignName,
    mapName,
    characters,
    getRuntimeValue,
    setRuntimeValue,
    setPopupHtml,
    setModalState,
    modalState,
    rollDamage,
    rollAttack,
    executeHandler,
    addEntry,
    onBuffsChange,
}) {
    async function handleAutomationAction(action) {
        const HAS_FLURRY_HEALING_HARM = playerStats.specialActions?.some(f => f.name === "Flurry of Healing and Harm");

        const simpleModal = (stateKey) => (payload) => setModalState({ [stateKey]: payload });

        const modalMap = {
            healingPool: simpleModal('healingPoolModal'),
            handOfHealing: simpleModal('handOfHealingModal'),
            fontOfMagic: () => setModalState({ fontOfMagicModal: true }),
            resourcePool: simpleModal('resourcePoolModal'),
            wildCompanion: simpleModal('wildCompanionModal'),
            setCondition: simpleModal('setConditionModal'),
            blindnessDeafness: simpleModal('blindnessDeafnessModal'),
            eyebiteEffect: simpleModal('eyebiteEffectModal'),
            attackRider: simpleModal('attackRiderModal'),
            openHandTechnique: simpleModal('openHandTechniqueModal'),
            shieldBash: simpleModal('shieldBashModal'),
            quiveringPalm: simpleModal('quiveringPalmModal'),
            combatStance: simpleModal('combatStanceModal'),
            teleport: simpleModal('teleportModal'),
            healingIllusion: simpleModal('healingIllusionModal'),
            invokeDuplicity: simpleModal('invokeDuplicityModal'),
            saveAttackHeal: simpleModal('saveAttackHealModal'),
            saveAttackAoe: simpleModal('saveAttackAoeModal'),
            // CLA-384: warpingImplosion chooser was unregistered — modal result silently dropped
            warpingImplosion: simpleModal('warpingImplosionModal'),
            aoeCondition: simpleModal('aoeConditionModal'),
            elementalAttunement: simpleModal('elementalAttunementModal'),
            elementalBurst: simpleModal('elementalBurstModal'),
            divineSpark: simpleModal('divineSparkModal'),
            divineIntervention: (payload) => setModalState({ divineInterventionAction: action, divineInterventionModal: payload }),
            moonlightStepResource: simpleModal('moonlightStepResourceModal'),
            moonlightStepFallback: simpleModal('moonlightStepFallbackModal'),
            starryFormConstellation: simpleModal('starryFormConstellationModal'),
            twinklingConstellation: simpleModal('twinklingConstellationModal'),
            arcaneCharge: simpleModal('arcaneChargeModal'),
            // CLA-379: warBondSummon chooser was unregistered — modal result silently dropped
            warBondSummon: simpleModal('warBondSummonModal'),
            warMagicCantrip: simpleModal('warMagicCantripModal'),
            warMagicSpell: simpleModal('warMagicSpellModal'),
            sacredWeaponDamageType: simpleModal('sacredWeaponModal'),
            primalCompanionBonusActionCommand: simpleModal('primalCompanionBonusActionModal'),
            primalCompanionSummon: simpleModal('primalCompanionSummonModal'),
            mistyWanderer: simpleModal('mistyWandererModal'),
            feyReinforcements: simpleModal('feyReinforcementsModal'),
            stepsOfTheFeyTaunt: simpleModal('stepsOfTheFeyTauntModal'),
            telekineticMovement: simpleModal('telekineticMovementModal'),
            bonusActionChoice: simpleModal('bonusActionChoiceModal'),
            stealthAttack: simpleModal('stealthAttackModal'),
            revelationInFlesh: simpleModal('revelationInFleshModal'),
            bastionOfLaw: simpleModal('bastionOfLawModal'),
            elementalAffinity: (payload) => {
                const affAction = payload?.action;
                const affTypes = payload?.damageTypes || ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];
                setModalState({ elementalAffinityModal: { action: affAction, playerStats, campaignName, damageTypes: affTypes, existingType: payload?.existingType } });
            },
            fiendishResilience: (payload) => {
                const frAction = payload?.action;
                const frTypes = payload?.damageTypes || ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
                setModalState({ fiendishResilienceModal: { action: frAction, playerStats, campaignName, damageTypes: frTypes, existingType: payload?.existingType } });
            },
            dragonCompanion: simpleModal('dragonCompanionModal'),
            wildMagicSurge: simpleModal('wildMagicSurgeModal'),
            weaponMasteryChoice: simpleModal('weaponMasteryChoiceModal'),
            weaponKindMastery: simpleModal('weaponKindMasteryModal'),
            bendFateChoice: simpleModal('bendFateModal'),
            thirdEye: simpleModal('thirdEyeModal'),
            soulstitchSpells: simpleModal('soulstitchSpellsModal'),
            illusoryReality: simpleModal('illusoryRealityModal'),
            celestialRevelation: simpleModal('celestialRevelationModal'),
            celestialResilienceModal: (payload) => setModalState({ celestialResilienceModal: { ...payload, playerStats, campaignName } }),
            elfishLineage: simpleModal('elfishLineageModal'),
            gnomishLineage: simpleModal('gnomishLineageModal'),
            fiendishLegacy: simpleModal('fiendishLegacyModal'),
            giantAncestry: simpleModal('giantAncestryModal'),
            breathWeaponShape: (payload) => setModalState({ breathWeaponShapeModal: { action: payload.action, playerStats, campaignName, options: payload.options } }),
            hypnoticPatternShake: (payload) => setModalState({ hypnoticPatternShakeModal: payload }),
            combatSuperiority: simpleModal('combatSuperiorityModal'),
            sweepingAttackTarget: simpleModal('sweepingAttackTargetModal'),
            baitAndSwitchChoice: simpleModal('baitAndSwitchChoiceModal'),
            // MN-016: Rally bonus-action row returned {type:'modal', modalName:'rallyChoice'}
            // with no map entry — die was spent and the picker silently dropped.
            rallyChoice: simpleModal('rallyChoiceModal'),
            bulwarkOfForceTarget: simpleModal('bulwarkOfForceModal'),
            zealousPresenceTarget: simpleModal('zealousPresenceModal'),
            clockworkCavalcade: simpleModal('clockworkCavalcadeModal'),
            naturesSanctuaryCreatures: simpleModal('naturesSanctuaryCreaturesModal'),
            coronaEnemySelection: simpleModal('coronaEnemySelectionModal'),
            radianceOfDawn: simpleModal('radianceOfDawnModal'),
            mantleOfInspirationTarget: simpleModal('mantleOfInspirationTarget'),
            vitalityOfTheTreeTarget: simpleModal('vitalityOfTheTreeTarget'),
            tricksterBlessing: simpleModal('tricksterBlessingModal'),
            bardicInspirationTarget: simpleModal('bardicInspirationTargetModal'),
            inspiringMovementAlly: simpleModal('inspiringMovementAllyModal'),
            arcaneWardRestore: simpleModal('arcaneWardRestoreModal'),
            oceanicGiftTarget: simpleModal('oceanicGiftTargetModal'),
            psychicWhispersTarget: simpleModal('psychicWhispersModal'),
            telepathicSpeech: (payload) => {
                const { action: speechAction, creatureTargets } = payload;
                setModalState({ secondaryTargetModal: {
                    title: speechAction.name || 'Telepathic Speech',
                    icon: 'fa-brain',
                    targets: creatureTargets,
                    confirmLabel: 'Establish Link',
                    confirmIcon: 'fa-brain',
                    description: 'Choose one creature within 30 feet to communicate with telepathically.',
                    featureDescription: `Range: ${Math.max(1, playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 1)} mile(s) | Duration: ${playerStats.level} minute(s)`,
                    onTargetSelected: async (_targetName) => {
                        setModalState({ secondaryTargetModal: null });
                    },
                    onSkip: () => {
                        setModalState({ secondaryTargetModal: null });
                    },
                }});
            },
            flurryOfBlows: simpleModal('flurryOfBlowsModal'),
            elementalEpitome: simpleModal('epitomeModal'),
            destructiveStride: simpleModal('destructiveStrideModal'),
            destructiveStrideTarget: simpleModal('destructiveStrideTargetModal'),
            animateDead: simpleModal('animateDeadModal'),
            createUndead: simpleModal('createUndeadModal'),
            summonSpirit: simpleModal('summonSpiritModal'),
        };

        if (cannotAct) return;

        const playerName = playerStats.name;
        const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
        const cloakActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'cloak_of_shadows');

        const auto = action.automation;

        // CLA-342: Stunning Strike fires only when your own melee weapon/unarmed
        // attack HIT, once per turn — refuse before any Focus Point/ki is spent
        // (mirrors the verified quiveringPalmHandler lastAttack hit gates).
        const ssGate = await gateStunningStrike({ action, auto, playerName, campaignName, getRuntimeValue, addEntry, setPopupHtml });
        if (ssGate.blocked) return;
        const stunningStrikeArmed = ssGate.armed;
        const stunningStrikeRound = ssGate.round;

        if (gateFeatureOptionChoice({ auto, action, playerStats, campaignName, getRuntimeValue, setModalState })) return;

        const fpProceed = await spendMonkFocusPoint({ action, auto, playerStats, playerName, campaignName, cloakActive, hasFlurryHealingHarm: HAS_FLURRY_HEALING_HARM, stunningStrikeArmed, stunningStrikeRound, getRuntimeValue, setRuntimeValue, setPopupHtml, addEntry });
        if (!fpProceed) return;

        const triggerProceed = await gateTriggerRequirement({ auto, action, playerStats, campaignName, getRuntimeValue, setRuntimeValue, setPopupHtml });
        if (!triggerProceed) return;

        const result = await executeHandler(action, playerStats, campaignName, mapName, characters);
        if (!result) return;

        switch (result.type) {
            case 'popup':
                setPopupHtml(result.payload);
                break;
            case 'modal': {
                const handler = modalMap[result.modalName];
                if (handler) {
                    handler(result.payload);
                }
                break;
            }
            case 'roll':
                dispatchRollResult(result.payload, rollDamage);
                break;
            case 'attack_roll':
                dispatchAttackRollResult(result.payload, rollAttack);
                break;
            case 'notify_buffs_changed':
                if (onBuffsChange) onBuffsChange();
                break;
        }

        finalizeAutomationOutcome(result, auto, addEntry, campaignName, onBuffsChange);
    }

    async function handleDivineInterventionCast(selectedSpell) {
        setModalState({ divineInterventionModal: null, divineInterventionAction: null });
        const action = getRuntimeValue('charActions', 'divineInterventionAction', campaignName) || modalState?.divineInterventionAction;
        if (!action) return;

        const result = await onDivineInterventionSpellSelected(action, playerStats, campaignName, selectedSpell);
        if (!result) return;

        if (result.type === 'spell_selected') {
            const spell = result.spell;
            const getTargetInfoFn = async () => {
                const cs = await getCombatContext(campaignName);
                return cs ? getTargetFromAttacker(cs, playerStats.name) : null;
            };
            executeSpellCast(spell, {}, {
                rollAttack,
                rollDamage,
                playerStats,
                getTargetInfo: getTargetInfoFn,
                campaignName,
                mapName,
                characters,
            }).then((healResult) => {
                if (healResult?.triggerResult) {
                    applyCastTriggerResult(healResult.triggerResult, spell, setModalState, setPopupHtml);
                }
                if (healResult && healResult.healAmount > 0) {
                    setPopupHtml(buildCastHealPopup(healResult, spell));
                }
            }).catch((e) => { console.error('[CharActions] executeSpellCast error:', e); });

            setPopupHtml({
                type: 'automation_info',
                name: result.name,
                description: `Divine Intervention cast ${spell.name}. Divine Intervention recharges ${result.rechargeMessage}`,
            });
        }
    }

    return {
        handleAutomationAction,
        handleDivineInterventionCast,
    };
}

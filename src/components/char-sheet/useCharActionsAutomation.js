import { onSpellSelected as onDivineInterventionSpellSelected } from '../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js'
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js'
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'
import { getClassFeatures } from '../../services/character/classFeatures.js'

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
        const MONK_KI_FEATURES = ['Flurry of Blows', 'Patient Defense', 'Step of the Wind', 'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind', 'Hand of Healing', 'Stunning Strike'];
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
            warMagicCantrip: simpleModal('warMagicCantripModal'),
            warMagicSpell: simpleModal('warMagicSpellModal'),
            sacredWeaponDamageType: simpleModal('sacredWeaponModal'),
            primalCompanionBonusActionCommand: simpleModal('primalCompanionBonusActionModal'),
            primalCompanionSummon: simpleModal('primalCompanionSummonModal'),
            mistyWanderer: simpleModal('mistyWandererModal'),
            feyReinforcements: simpleModal('feyReinforcementsModal'),
            stepsOfTheFeyTaunt: simpleModal('stepsOfTheFeyTauntModal'),
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

        // If feature has options that need choosing (e.g. Blessed Strikes), present choice
        if (auto?.type === 'damage_bonus' && auto?.options?.length > 0) {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setModalState({ featureChoice: { action, options: auto.options, optionKey } });
                return;
            }
        }

        // Defensive Tactics: present choice between Escape the Horde and Multiattack Defense
        if (auto?.type === 'defensive_tactics') {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setModalState({ featureChoice: { action, options: ['Escape the Horde', 'Multiattack Defense'], optionKey } });
                return;
            }
        }

        // Spend 1 focus point for monk Ki features before dispatching
        // Skip FP cost for Hand of Healing and Flurry of Blows when Flurry of Healing and Harm is active
        // Skip FP cost for Flurry of Blows when Cloak of Shadows (Shadow Flurry) is active
        // Skip pre-spend for 2024 patient_defense: patientDefenseHandler is the sole FP
        // writer (focus mode spends 1 FP, plain Disengage spends none) — pre-spending here
        // double-charged and blocked the plain-Disengage fallback (CLA-247)
        // Skip pre-spend for step_of_the_wind too: stepOfTheWindHandler is the sole FP
        // writer for both rulesets (gates FP>=1, spends once, writes the Disengage te) —
        // pre-spending here double-charged 2 FP per click (CLA-333)
        if (MONK_KI_FEATURES.includes(action.name) && auto?.type !== 'patient_defense' && auto?.type !== 'step_of_the_wind') {
            const skipFP = (HAS_FLURRY_HEALING_HARM && (action.name === 'Hand of Healing' || action.name === 'Flurry of Blows' || action.name === 'Heightened Flurry of Blows'))
                || (cloakActive && (action.name === 'Flurry of Blows' || action.name === 'Heightened Flurry of Blows'));
            if (!skipFP) {
                const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
                const maxFP = classLevel?.focus_points || getClassFeatures(playerStats)?.maxFocusPoints || 0;
                const storedFP = getRuntimeValue(playerStats.name, 'focusPoints', campaignName);
                const currentFP = storedFP != null ? Number(storedFP) : (playerStats._trackedResources?.focusPoints?.current ?? maxFP);
                if (currentFP <= 0) {
                    setPopupHtml(`<b>${action.name}</b><br/>No ${playerStats.rules === '2024' ? "Focus Points" : 'ki points'} remaining.`);
                    return;
                }
                await setRuntimeValue(playerStats.name, 'focusPoints', currentFP - 1, campaignName);
                window.dispatchEvent(new CustomEvent('focus-points-updated'));
            }
        }

        // Check trigger conditions for gated actions
        if (auto?.trigger && auto.trigger !== '') {
            if (auto.trigger === 'after_casting_action_spell') {
                const lastCast = getRuntimeValue(playerStats.name, 'lastActionSpellCast', campaignName);
                if (!lastCast) {
                    setPopupHtml(`<b>${action.name}</b><br/>You must cast a spell with a casting time of an action first.`);
                    return;
                }
                await setRuntimeValue(playerStats.name, 'lastActionSpellCast', 0, campaignName);
            }
        }

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
                if (result.payload.rollType === 'damage') {
                    rollDamage(
                        result.payload.name,
                        result.payload.formula,
                        result.payload.total,
                        result.payload.rolls,
                        result.payload.modifier,
                        result.payload.contextConfig || {}
                    );
                }
                break;
            case 'attack_roll':
                {
                    const { attack, targetName } = result.payload;
                    const autoDamageFormula = attack?.autoDamageFormula || null;
                    const autoDamageName = attack?.autoDamageName || attack?.name;
                    const damageType = attack?.damageType || 'Slashing';
                    rollAttack(attack.name, attack.hitBonus, { targetName, forcedMode: undefined, isOpportunityAttack: false, autoDamageFormula, autoDamageName, damageType });
                }
                break;
            case 'notify_buffs_changed':
                if (onBuffsChange) onBuffsChange();
                break;
        }

        if (result.logEntries) {
            result.logEntries.forEach(entry => addEntry(campaignName, entry).catch((e) => { console.error("[useCharActionsAutomation:log-error]", e); }));
        }

        if (result.type === 'popup' && (auto?.type === 'temp_buff' || auto?.type === 'combat_stance')) {
            if (onBuffsChange) onBuffsChange();
        }
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
                    const tr = healResult.triggerResult;
                    if (tr.type === 'modal') {
                        if (tr.modalName === 'wildMagicSurge') {
                            setModalState({ wildMagicSurgeModal: tr.payload });
                        }
                    } else if (tr.type === 'popup') {
                        const payload = tr.payload;
                        const name = payload?.name || spell.name || 'Automation';
                        const description = payload?.description || '';
                        setPopupHtml({
                            type: 'automation_info',
                            name,
                            description,
                        });
                    }
                }
                if (healResult && healResult.healAmount > 0) {
                    const bonusHealDetail = healResult.bonusDetails?.length > 0
                        ? healResult.bonusDetails.map(d => `${d.amount} ${d.name}`).join(', ')
                        : '';
                    const rawTotal = healResult.rawTotal ?? healResult.healAmount;
                    setPopupHtml({
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
                    });
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

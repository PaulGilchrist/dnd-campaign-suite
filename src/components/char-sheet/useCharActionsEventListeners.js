import { useEffect } from 'react'
import { getCombatContext } from '../../services/rules/combat/damageUtils.js'
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js'
import { addEntry } from '../../services/ui/logService.js'

export default function useCharActionsEventListeners({
    setPopupHtml,
    setModalState,
    rollDamage,
    playerName,
    campaignName,
    popupHtml,
    setRuntimeValue,
}) {
    // Handle damage type choice popup (e.g. Blessed Strikes: Necrotic or Radiant)
    useEffect(() => {
        const handleHealingPopup = (e) => {
            const { targetName, healingName, rollInfo, maximizeHealingDice, popupText } = e.detail || {};
            const diceRoll = rollInfo ? ` [${rollInfo}]` : '';
            const maximizeNote = maximizeHealingDice ? ' (maximized)' : '';
            setPopupHtml(`<b>${healingName}</b> on ${targetName}${diceRoll}${maximizeNote}<br/><br/>${popupText}`);
        };
        const handleDamagePopup = (e) => {
            const { targetName, spellName, popupText, rollInfo } = e.detail || {};
            const diceRoll = rollInfo ? ` [${rollInfo}]` : '';
            setPopupHtml(`<b>${spellName}</b> on ${targetName}${diceRoll}<br/><br/>${popupText}`);
        };
        const handleInspiringSmite = (e) => {
            setModalState({ inspiringSmiteModal: e.detail });
        };
        window.addEventListener('healing-popup', handleHealingPopup);
        window.addEventListener('damage-popup', handleDamagePopup);
        window.addEventListener('inspiring-smite-pending', handleInspiringSmite);
        return () => {
            window.removeEventListener('healing-popup', handleHealingPopup);
            window.removeEventListener('damage-popup', handleDamagePopup);
            window.removeEventListener('inspiring-smite-pending', handleInspiringSmite);
        };
    }, [setPopupHtml, setModalState]);

    useEffect(() => {
        if (popupHtml?.type === 'damage_type_choice') {
            const handleChoice = (chosenType) => {
                const { bonusFormula, bonusRolls, bonusTotal, usedKey, currentRound, targetName, attackerName, name } = popupHtml;
                const context = {
                    damageType: chosenType,
                    targetName,
                    attackerName,
                };
                rollDamage({ name: name, formula: bonusFormula, total: bonusTotal, rolls: bonusRolls, modifier: 0, context: context });
                if (usedKey) {
                    setRuntimeValue(playerName, usedKey, currentRound, campaignName);
                }
                setPopupHtml(null);
            };
            const handleSkip = () => {
                setPopupHtml(null);
            };
            window.addEventListener('damage-type-choice', (e) => {
                handleChoice(e.detail.chosenType);
            });
            window.addEventListener('damage-type-skip', handleSkip);
        }
    }, [popupHtml, playerName, campaignName, rollDamage, setPopupHtml, setRuntimeValue]);

    // soulstitch-modal-show listener
    useEffect(() => {
        const handler = (event) => {
            setModalState({ soulstitchSpellsModal: event.detail });
        };
        window.addEventListener('soulstitch-modal-show', handler);
        return () => window.removeEventListener('soulstitch-modal-show', handler);
    }, [setModalState]);

    // potent-spellcasting-temp-hp listener
    useEffect(() => {
        const handler = async (event) => {
            const { title, tempHp, campaignName: evtCampaignName, attackerName, confirmLabel: evtConfirmLabel } = event.detail;
            const cs = await getCombatContext(evtCampaignName);
            const allAllies = cs?.creatures?.filter(c =>
                c.type === 'player' || c.type === 'npc' || c.type === 'monster'
            ) || [];
            const allyTargets = allAllies.map(c => ({
                name: c.name,
                currentHp: c.currentHp,
                maxHp: c.maxHp,
                size: c.size,
                type: c.type,
            }));
            setModalState({ secondaryTargetModal: {
                title,
                targets: allyTargets,
                confirmLabel: evtConfirmLabel || 'Grant Temp HP',
                onTargetSelected: async (targetName) => {
                    setTempHp(targetName, tempHp, evtCampaignName);
                    addEntry(evtCampaignName, {
                        type: 'roll',
                        characterName: attackerName,
                        rollType: 'temp-hp',
                        name: 'Potent Spellcasting',
                        targetName,
                        note: `Gained ${tempHp} temporary hit points from Potent Spellcasting`,
                        total: tempHp,
                    }).catch((e) => { console.error("[CharActions] Error:", e); });
                    setModalState({ secondaryTargetModal: null });
                },
                onSkip: () => {
                    setTempHp(attackerName, tempHp, evtCampaignName);
                    addEntry(evtCampaignName, {
                        type: 'roll',
                        characterName: attackerName,
                        rollType: 'temp-hp',
                        name: 'Potent Spellcasting',
                        targetName: attackerName,
                        note: `Gained ${tempHp} temporary hit points from Potent Spellcasting`,
                        total: tempHp,
                    });
                    setModalState({ secondaryTargetModal: null });
                },
                featureDescription: `Grant ${tempHp} temporary hit points to a creature within 60 feet.`,
                description: 'Choose a creature to grant temporary hit points from Potent Spellcasting.',
            }});
        };
        window.addEventListener('potent-spellcasting-temp-hp', handler);
        return () => window.removeEventListener('potent-spellcasting-temp-hp', handler);
    }, [setModalState]);

    // sweeping-attack-modal-show listener
    useEffect(() => {
        const handler = (event) => {
            setModalState({ sweepingAttackTargetModal: event.detail });
        };
        window.addEventListener('sweeping-attack-modal-show', handler);
        return () => window.removeEventListener('sweeping-attack-modal-show', handler);
    }, [setModalState]);

    // bait-and-switch-modal-show listener
    useEffect(() => {
        const handler = (event) => {
            setModalState({ baitAndSwitchChoiceModal: event.detail });
        };
        window.addEventListener('bait-and-switch-modal-show', handler);
        return () => window.removeEventListener('bait-and-switch-modal-show', handler);
    }, [setModalState]);

    // commander-strike-modal-show listener
    useEffect(() => {
        const handler = (event) => {
            setModalState({ commanderStrikeChoiceModal: event.detail });
        };
        window.addEventListener('commander-strike-modal-show', handler);
        return () => window.removeEventListener('commander-strike-modal-show', handler);
    }, [setModalState]);

    // rally-choice-modal-show listener
    useEffect(() => {
        const handler = (event) => {
            setModalState({ rallyChoiceModal: event.detail });
        };
        window.addEventListener('rally-choice-modal-show', handler);
        return () => window.removeEventListener('rally-choice-modal-show', handler);
    }, [setModalState]);
}

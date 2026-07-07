import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollD20 } from '../../dice/diceRoller.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { isHolyAuraActive, getHolyAuraTargets } from '../../automation/handlers/buffs/holyAuraHandler.js';

export function checkHolyAuraDamage(creature, attackerName, combatSummary, campaignName, wardDamage) {
    if (attackerName && attackerName !== creature.name && wardDamage > 0) {
        const casterName = attackerName;
        if (isHolyAuraActive(casterName, campaignName)) {
            const holyAuraTargets = getHolyAuraTargets(casterName, campaignName);
            const isTargetProtected = holyAuraTargets.includes(creature.name) || holyAuraTargets.length === 0;
            if (isTargetProtected) {
                const attackerCreature = combatSummary.creatures.find(c => c.name === attackerName);
                if (attackerCreature) {
                    const attackerType = (attackerCreature.type || '').toLowerCase();
                    const attackerTemplate = (() => { const raw = attackerCreature.template; if (raw == null || !Array.isArray(raw)) { console.error('[applyDamage] attacker template is not an array'); throw new Error('attacker template must be an array'); } return raw; })().map(t => t.toLowerCase());
                    const isFiendOrUndead = attackerType === 'fiend' || attackerType === 'undead' ||
                        attackerTemplate.includes('fiend') || attackerTemplate.includes('undead');
                    if (isFiendOrUndead) {
                        const conSaveDc = getRuntimeValue(casterName, 'holyAuraSaveDc', campaignName);
                        if (conSaveDc) {
                            const saveRoll = rollD20();
                            const conBonus = attackerCreature.ability_score_modifiers?.CON ?? attackerCreature.ability_score_modifiers?.constitution ?? 0;
                            const saveTotal = saveRoll + conBonus;
                            if (saveTotal < conSaveDc) {
                                const rawAttackerConditions = getRuntimeValue(attackerName, 'activeConditions');
                                const attackerConditions = rawAttackerConditions || [];
                                const existingBlinded = attackerConditions.find(c => String(c).toLowerCase() === 'blinded');
                                if (!existingBlinded) {
                                    setRuntimeValue(attackerName, 'activeConditions', [...attackerConditions, 'blinded'], campaignName);
                                    postLogEntry(campaignName, {
                                        type: 'condition',
                                        action: 'added',
                                        characterName: attackerName,
                                        condition: 'Blinded',
                                        reason: 'Holy Aura (Fiend/Undead melee hit)',
                                        timestamp: Date.now(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

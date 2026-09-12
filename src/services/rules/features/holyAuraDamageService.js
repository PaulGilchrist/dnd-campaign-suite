import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollD20 } from '../../dice/diceRoller.js';
import { addEntry } from '../../ui/logService.js';
import { getHolyAuraTargets } from '../../automation/handlers/buffs/holyAuraHandler.js';
import { addCondition } from '../../combat/conditions/conditionSaveService.js';
import { loadCombatSummary } from '../../encounters/combatData.js';

function resolveAttackerFiendOrUndead(combatSummary, attackerName) {
    const attackerCreature = combatSummary.creatures.find(c => c.name === attackerName);
    if (!attackerCreature) return null;
    const attackerType = (attackerCreature.monsterType || '').toLowerCase();
    const attackerTemplate = (attackerCreature.template || []).map(t => t.toLowerCase());
    const isFiendOrUndead = attackerType === 'fiend' || attackerType === 'undead' ||
        attackerTemplate.includes('fiend') || attackerTemplate.includes('undead');
    return isFiendOrUndead ? attackerCreature : null;
}

export async function checkHolyAuraDamage(creature, attackerName, combatSummary, campaignName, wardDamage) {
    if (attackerName && attackerName !== creature.name && wardDamage > 0) {
        const targetEffects = (getRuntimeValue('campaign', 'targetEffects') || []).filter(
            te => te.effect === 'holy_aura' && te.target === creature.name
        );
        if (targetEffects.length === 0) return null;
        const casterName = targetEffects[0].source;
        const holyAuraTargets = getHolyAuraTargets(casterName, campaignName);
        const isTargetProtected = holyAuraTargets.includes(creature.name);
        if (!isTargetProtected) return null;
        const attackerCreature = resolveAttackerFiendOrUndead(combatSummary, attackerName);
        if (!attackerCreature) return null;
        const conSaveDc = getRuntimeValue(casterName, 'holyAuraSaveDc', campaignName);
        if (!conSaveDc) return null;
        const saveRoll = rollD20();
        const conBonus = attackerCreature.ability_score_modifiers?.CON ?? attackerCreature.ability_score_modifiers?.constitution ?? 0;
        const saveTotal = saveRoll + conBonus;
        addEntry(campaignName, {
            type: 'save_result',
            characterName: attackerName,
            roll: saveRoll,
            modifier: conBonus,
            total: saveTotal,
            success: saveTotal >= conSaveDc,
            description: `Holy Aura CON save vs DC ${conSaveDc}`,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[holyAura] Error logging save:", e); });
        const saveResult = { roll: saveRoll, modifier: conBonus, total: saveTotal, success: saveTotal >= conSaveDc, dc: conSaveDc };
        if (saveTotal < conSaveDc) {
            const cs = await loadCombatSummary(campaignName);
            const conditionDef = { key: 'blinded', label: 'Blinded' };
            addCondition({ combatSummary: cs, creatureName: attackerName, conditionDef, dc: conSaveDc, ability: 'CON', getRuntimeValue, setRuntimeValue, campaignName, playerStats: attackerCreature });
            addEntry(campaignName, {
                type: 'condition',
                action: 'added',
                characterName: attackerName,
                condition: 'Blinded',
                reason: 'Holy Aura (Fiend/Undead melee hit)',
                timestamp: Date.now(),
            }).catch((e) => { console.error("[holyAura] Error:", e); });
        }
        return saveResult;
    }
    return null;
}

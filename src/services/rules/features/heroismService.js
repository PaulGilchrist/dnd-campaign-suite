import { setRuntimeValue, getRuntimeValue } from '../../hooks/useRuntimeState.js';
import { addExpiration } from '../effects/expirations.js';
import { evaluateAutoExpression } from '../../combat/automationExpressions.js';

const HEROISM_BUFF_NAME = 'Heroism';

export async function triggerHeroism(spell, metaCtx, playerStats, campaignName, _mapName) {
    const targetName = metaCtx?.targetName || playerStats.name;

    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    const existingHeroismIndex = activeBuffs.findIndex(b => b.name === HEROISM_BUFF_NAME);
    if (existingHeroismIndex >= 0) {
        activeBuffs.splice(existingHeroismIndex, 1);
    }

    const tempHpExpression = spell.automation?.tempHpExpression || 'spellcasting_ability_modifier';
    const tempHpAmount = evaluateAutoExpression(tempHpExpression, playerStats) || 0;

    const buff = {
        name: HEROISM_BUFF_NAME,
        effect: 'heroism',
        duration: spell.automation?.duration || 'Concentration, up to 1 minute',
        sourceCharacter: playerStats.name,
        tempHpAmount: tempHpAmount,
        conditionImmunity: ['Frightened'],
    };

    activeBuffs.push(buff);
    setRuntimeValue(targetName, 'activeBuffs', activeBuffs, campaignName);

    const targetStats = { ...playerStats, name: targetName };
    const turnStartEffects = targetStats.turnStartEffects || [];
    const heroismTurnEffect = {
        type: 'heroism_temp_hp',
        name: HEROISM_BUFF_NAME,
        tempHpAmount: tempHpAmount,
    };
    if (!turnStartEffects.some(e => e.type === 'heroism_temp_hp')) {
        targetStats.turnStartEffects = [...turnStartEffects, heroismTurnEffect];
        setRuntimeValue(targetName, 'turnStartEffects', targetStats.turnStartEffects, campaignName);
    }

    addExpiration(playerStats.name, targetName, [
        { type: 'remove_heroism_buff', buffName: HEROISM_BUFF_NAME },
    ], campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Heroism',
            automationType: 'heroism',
            description: `<b>Heroism</b><br/>${targetName} is imbued with bravery. Immune to the Frightened condition. Gains ${tempHpAmount} Temporary Hit Points at the start of each of its turns. Concentration, up to 1 minute.`,
        },
    };
}

export function removeHeroismBuff(targetName, campaignName) {
    const stored = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    const filtered = activeBuffs.filter(b => b.name !== HEROISM_BUFF_NAME);
    if (filtered.length !== activeBuffs.length) {
        setRuntimeValue(targetName, 'activeBuffs', filtered, campaignName);
    }

    const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];
    const filteredEffects = effects.filter(te => !(te.effect === 'heroism' && te.source === HEROISM_BUFF_NAME));
    if (filteredEffects.length !== effects.length) {
        setRuntimeValue(campaignName, 'targetEffects', filteredEffects, campaignName);
    }
}

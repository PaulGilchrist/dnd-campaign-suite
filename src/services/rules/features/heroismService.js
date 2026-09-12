import { setRuntimeValue, getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../effects/expirations.js';
import { addEntry } from '../../../services/ui/logService.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { addConcentration } from '../../../services/combat/concentration/concentrationService.js';

const HEROISM_BUFF_NAME = 'Heroism';

export function handle(heroismAction, playerStats, campaignName, _mapName) {
    const spell = heroismAction.spell || {};

    const combatSummary = getCombatSummary(campaignName);
    const allCreatures = combatSummary?.creatures || [];
    const creatureTargets = allCreatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'heroism_target_selection',
            name: heroismAction.name || 'Heroism',
            creatureTargets,
            range: spell.range || 'Touch',
            duration: spell.automation?.duration || 'Concentration, up to 1 minute',
        },
    };
}

function addHeroismTurnStartEffect(targetName, playerStats, tempHpAmount, campaignName) {
    const targetStats = { ...playerStats, name: targetName };
    const turnStartEffects = targetStats.turnStartEffects || [];
    if (turnStartEffects.some(e => e.type === 'heroism_temp_hp')) return;
    targetStats.turnStartEffects = [...turnStartEffects, {
        type: 'heroism_temp_hp',
        name: HEROISM_BUFF_NAME,
        tempHpAmount: tempHpAmount,
    }];
    setRuntimeValue(targetName, 'turnStartEffects', targetStats.turnStartEffects, campaignName);
}

function syncHeroismTargetEffects(targetName, campaignName) {
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];
    const filteredEffects = effects.filter(te => !(te.effect === 'heroism' && te.source === HEROISM_BUFF_NAME && te.target === targetName));
    if (filteredEffects.length !== effects.length) {
        setRuntimeValue('campaign', 'targetEffects', filteredEffects, campaignName);
    }

    effects.push({
        target: targetName,
        effect: 'heroism',
        source: HEROISM_BUFF_NAME,
        duration: 'concentration',
    });
    effects.push({
        target: targetName,
        effect: 'wisdom_save_advantage',
        source: HEROISM_BUFF_NAME,
        duration: 'concentration',
    });
    setRuntimeValue('campaign', 'targetEffects', effects, campaignName);
}

async function applyHeroismToTarget(targetName, playerStats, campaignName, casterName, duration, tempHpAmount, combatSummary, dc) {
    const storedBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const buffs = Array.isArray(storedBuffs) ? storedBuffs : [];
    const existingHeroismIndex = buffs.findIndex(b => b.name === HEROISM_BUFF_NAME);
    if (existingHeroismIndex >= 0) {
        buffs.splice(existingHeroismIndex, 1);
    }

    buffs.push({
        name: HEROISM_BUFF_NAME,
        effect: 'heroism',
        duration,
        sourceCharacter: casterName,
        tempHpAmount: tempHpAmount,
        conditionImmunity: ['Frightened'],
    });
    setRuntimeValue(targetName, 'activeBuffs', buffs, campaignName);

    addHeroismTurnStartEffect(targetName, playerStats, tempHpAmount, campaignName);
    syncHeroismTargetEffects(targetName, campaignName);

    addExpiration(casterName, targetName, [
        { type: 'remove_heroism_buff', buffName: HEROISM_BUFF_NAME },
    ], campaignName);

    if (combatSummary) {
        addConcentration(combatSummary, casterName, 'Heroism', dc, targetName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: HEROISM_BUFF_NAME,
        description: `${casterName} cast ${HEROISM_BUFF_NAME} on ${targetName}. Target is immune to Frightened and gains ${tempHpAmount} temp HP per turn.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[heroism] Error logging:", e); });
}

function hasValidHeroismTargets(targetNames) {
    return Array.isArray(targetNames) && targetNames.length > 0;
}

function resolveHeroismTempHpAmount(spell, playerStats) {
    const spellcastingAbilityMod = playerStats.spellAbilities?.modifier || 0;
    const tempHpExpression = spell.automation?.tempHpExpression || 'spellcasting_ability_modifier';
    return tempHpExpression === 'spellcasting_ability_modifier' ? spellcastingAbilityMod : 0;
}

function heroismPopupDescription(targetNames, casterName, tempHpAmount) {
    if (targetNames.length === 1) {
        return `${targetNames[0]} gained Heroism from ${casterName}'s cast: immune to Frightened, ${tempHpAmount} temp HP at start of each turn.`;
    }
    return `${targetNames.length} targets gained Heroism: ${targetNames.join(', ')}.`;
}

export async function applyHeroism(heroismAction, playerStats, campaignName, _mapName, targetNames) {
    if (!hasValidHeroismTargets(targetNames)) {
        return null;
    }

    const spell = heroismAction.spell || {};
    const casterName = playerStats.name;
    const duration = spell.automation?.duration || 'Concentration, up to 1 minute';

    const tempHpAmount = resolveHeroismTempHpAmount(spell, playerStats);

    const combatSummary = getCombatSummary(campaignName);
    const dc = playerStats.spellAbilities?.saveDc || (8 + (playerStats.proficiency || 0));

    for (const targetName of targetNames) {
        await applyHeroismToTarget(targetName, playerStats, campaignName, casterName, duration, tempHpAmount, combatSummary, dc);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: heroismAction.name || 'Heroism',
            description: heroismPopupDescription(targetNames, casterName, tempHpAmount),
            automation: heroismAction.automation || {},
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

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? storedEffects : [];
    const filteredEffects = effects.filter(te => !(te.effect === 'heroism' && te.source === HEROISM_BUFF_NAME));
    if (filteredEffects.length !== effects.length) {
        setRuntimeValue('campaign', 'targetEffects', filteredEffects, campaignName);
    }
}

export function isHeroismActive(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];
    return activeBuffs.some(b => b.name === HEROISM_BUFF_NAME && b.effect === 'heroism');
}

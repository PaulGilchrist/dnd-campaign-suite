import { setTempHpOnKey } from '../buffs/tempHpService.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

function hasCreateThrallFeature(playerStats) {
    const allFeatures = [
        ...(playerStats?.class?.class_levels || []).flatMap(cl => (cl.features || [])),
        ...(playerStats?.class?.subclass?.class_levels || []).flatMap(cl => (cl.features || [])),
    ];
    return allFeatures.some(f => f.name === 'Create Thrall');
}

function computeThrallAbilityModifiers(abilities, level) {
    const mod = (name) => (abilities.find(a => a.name === name)?.bonus || 0) - Math.floor((level - 1) / 2);
    return {
        strength: mod('Strength'),
        dexterity: mod('Dexterity'),
        constitution: mod('Constitution'),
        intelligence: mod('Intelligence'),
        wisdom: mod('Wisdom'),
        charisma: mod('Charisma'),
    };
}

function evaluateThrallTempHp(expr) {
    try {
        const result = new Function(`"use strict"; return (${expr})`)();
        if (typeof result === 'number' && !isNaN(result)) {
            return Math.max(0, result);
        }
        return 0;
    } catch (_e) {
        // If expression evaluation fails, try rolling
        const dieRoll = rollExpression(expr);
        return dieRoll?.total || 0;
    }
}

function findAberrantCompanion(cs) {
    return cs.creatures.find(c =>
        c.name && (
            c.name.includes('Aberrant Spirit') ||
            c.name.includes('Aberration') ||
            c.name.toLowerCase().includes('aberration')
        )
    );
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Create Thrall';

    // Check if the feature is available (Warlock level 14+)
    if (!hasCreateThrallFeature(playerStats)) {
        return null;
    }

    // Resolve temp HP expression
    const tempHpExpression = auto.tempHpExpression || 'warlock level + CHA modifier';
    const level = playerStats.level || 1;
    const abilities = Array.isArray(playerStats.abilities) ? playerStats.abilities : [];
    const abilityModifiers = computeThrallAbilityModifiers(abilities, level);

    const expr = tempHpExpression
        .replace(/warlock level/gi, level)
        .replace(/warlock_level/gi, level)
        .replace(/level/gi, level)
        .replace(/CHA modifier/gi, abilityModifiers.charisma)
        .replace(/charisma modifier/gi, abilityModifiers.charisma);

    const tempHp = evaluateThrallTempHp(expr);

    if (tempHp <= 0) {
        return null;
    }

    // Find the summoned companion in combat context
    const cs = await getCombatContext(campaignName);
    if (!cs || !cs.creatures) {
        return null;
    }

    // Look for the Aberrant Spirit companion
    const companion = findAberrantCompanion(cs);

    if (!companion) {
        return null;
    }

    // Apply temp HP to the companion
    const tempHpKey = `_${companion.name.replace(/\s+/g, '_')}_tempHp`;
    setTempHpOnKey(companion.name, tempHpKey, tempHp, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName}: ${companion.name} gains ${tempHp} Temporary Hit Points.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[createThrallTempHp] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName}: ${companion.name} gains ${tempHp} Temporary Hit Points.`,
            automation: auto,
        },
    };
}

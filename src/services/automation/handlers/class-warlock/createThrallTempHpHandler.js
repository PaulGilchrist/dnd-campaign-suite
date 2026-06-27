import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Create Thrall';

    // Check if the feature is available (Warlock level 14+)
    const allFeatures = [
        ...(playerStats?.class?.class_levels || []).flatMap(cl => (cl.features || [])),
        ...(playerStats?.class?.subclass?.class_levels || []).flatMap(cl => (cl.features || [])),
    ];
    const hasCreateThrall = allFeatures.some(f => f.name === 'Create Thrall');
    if (!hasCreateThrall) {
        return null;
    }

    // Resolve temp HP expression
    const tempHpExpression = auto.tempHpExpression || 'warlock level + CHA modifier';
    const level = playerStats.level || 1;
    const abilities = Array.isArray(playerStats.abilities) ? playerStats.abilities : [];
    const abilityModifiers = {
        strength: (abilities.find(a => a.name === 'Strength')?.bonus || 0) - Math.floor((level - 1) / 2),
        dexterity: (abilities.find(a => a.name === 'Dexterity')?.bonus || 0) - Math.floor((level - 1) / 2),
        constitution: (abilities.find(a => a.name === 'Constitution')?.bonus || 0) - Math.floor((level - 1) / 2),
        intelligence: (abilities.find(a => a.name === 'Intelligence')?.bonus || 0) - Math.floor((level - 1) / 2),
        wisdom: (abilities.find(a => a.name === 'Wisdom')?.bonus || 0) - Math.floor((level - 1) / 2),
        charisma: (abilities.find(a => a.name === 'Charisma')?.bonus || 0) - Math.floor((level - 1) / 2),
    };

    let expr = tempHpExpression
        .replace(/warlock level/gi, level)
        .replace(/warlock_level/gi, level)
        .replace(/level/gi, level)
        .replace(/CHA modifier/gi, abilityModifiers.charisma)
        .replace(/charisma modifier/gi, abilityModifiers.charisma);

    let tempHp = 0;
    try {
        const result = new Function(`"use strict"; return (${expr})`)();
        if (typeof result === 'number' && !isNaN(result)) {
            tempHp = Math.max(0, result);
        }
    } catch (_e) {
        // If expression evaluation fails, try rolling
        const dieRoll = rollExpression(expr);
        tempHp = dieRoll?.total || 0;
    }

    if (tempHp <= 0) {
        return null;
    }

    // Find the summoned companion in combat context
    const cs = await getCombatContext(campaignName);
    if (!cs || !cs.creatures) {
        return null;
    }

    // Look for the Aberrant Spirit companion
    const companion = cs.creatures.find(c =>
        c.name && (
            c.name.includes('Aberrant Spirit') ||
            c.name.includes('Aberration') ||
            c.name.toLowerCase().includes('aberration')
        )
    );

    if (!companion) {
        return null;
    }

    // Apply temp HP to the companion
    const tempHpKey = `_${companion.name.replace(/\s+/g, '_')}_tempHp`;
    const currentTempHp = Number(getRuntimeValue(companion.name, tempHpKey, campaignName) ?? 0);
    const newTempHp = currentTempHp + tempHp;

    await setRuntimeValue(companion.name, tempHpKey, newTempHp, campaignName);

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

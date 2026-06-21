import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

export async function handle(action, playerStats, _campaignName) {
    const auto = action.automation;
    const spellList = playerStats?.spellAbilities?.spells || [];
    const actionCastingTimes = ['1 action', 'Action'];
    const eligibleSpells = [];
    const warnings = [];

    for (const spell of spellList) {
        if (spell.prepared !== 'Always' && spell.prepared !== 'Prepared') continue;
        if (!actionCastingTimes.includes(spell.casting_time)) continue;

        const isSingleTarget = !spell.area_of_effect && !(spell.automation?.maxTargets > 1);
        const spellData = {
            name: spell.name,
            level: spell.level || 0,
            casting_time: spell.casting_time,
            range: spell.range,
            isSingleTarget,
            hasAreaOfEffect: !!spell.area_of_effect,
            maxTargets: spell.automation?.maxTargets || 1,
            automation: spell.automation,
        };

        if (!isSingleTarget) {
            warnings.push(spell.name);
        }

        eligibleSpells.push(spellData);
    }

    const descriptionParts = [
        `<b>${action.name}:</b> Select a spell with a casting time of 1 action to cast as a reaction when a creature leaves your reach.`,
    ];

    if (eligibleSpells.length === 0) {
        descriptionParts.push('No spells with a casting time of 1 action are available.');
    } else {
        descriptionParts.push(`Available spells: ${eligibleSpells.map(s => s.name).join(', ')}.`);
    }

    if (warnings.length > 0) {
        descriptionParts.push(`<i>Warning: ${warnings.join(', ')} target more than one creature and may not be ideal for Reactive Spell.</i>`);
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: descriptionParts.join('<br><br>'),
            automation: auto,
            trigger: 'opportunity_attack_reaction',
            eligibleSpells,
            hasWarnings: warnings.length > 0,
        },
    };
}

export function applyWarCasterReaction(targetName, spellName, spellData, playerStats, campaignName) {
    const stored = getRuntimeValue(campaignName, 'warCasterReactions') || [];
    stored.push({
        targetName,
        spellName,
        spellData,
        characterName: playerStats.name,
        timestamp: Date.now(),
    });
    setRuntimeValue(campaignName, 'warCasterReactions', stored, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'War Caster - Reactive Spell',
        description: `War Caster Reactive Spell: Casting ${spellName} as a reaction on ${targetName}.`,
    }).catch(() => {});

    return { ok: true };
}

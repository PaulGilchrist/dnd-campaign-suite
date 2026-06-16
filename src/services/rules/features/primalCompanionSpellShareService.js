import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../automation/index.js';

const SPELL_SHARE_FEATURE_NAME = 'Share Spells';

export function getShareSpellsFeature(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.find(p => p.type === 'primal_companion_spell_share');
}

function isSelfTargetedSpell(spell) {
    const range = (spell.range || '').toLowerCase();
    return range === 'self' || range === 'self (5-foot radius)' || range === 'self (30-foot cone)' || range === 'self (60-foot cone)';
}

function isAreaEffectCasting(metaCtx) {
    return metaCtx?.multiTarget || metaCtx?.aoeTarget;
}

export function hasShareSpells(playerStats) {
    return !!getShareSpellsFeature(playerStats);
}

export async function triggerPrimalCompanionSpellShare(spell, metaCtx, playerStats, campaignName, mapName) {
    const shareFeature = getShareSpellsFeature(playerStats);
    if (!shareFeature) {
        return null;
    }

    if (!isSelfTargetedSpell(spell)) {
        return null;
    }

    if (spell.level === 0) {
        return null;
    }

    if (isAreaEffectCasting(metaCtx)) {
        return null;
    }

    const companionType = getRuntimeValue(playerStats.name, 'primalCompanionType', campaignName);
    if (!companionType) {
        return null;
    }

    const companionAlive = getRuntimeValue(playerStats.name, 'primalCompanionAlive', campaignName);
    if (companionAlive === false) {
        return null;
    }

    const action = {
        name: SPELL_SHARE_FEATURE_NAME,
        description: shareFeature.description || 'When you cast a spell targeting yourself, you can also affect your Primal Companion beast if within 30 feet.',
        automation: {
            type: 'primal_companion_spell_share',
            range: shareFeature.range || '30_ft',
            casting_time: shareFeature.casting_time || 'passive',
            companionType: companionType,
        },
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[primalCompanionSpellShare] Failed to execute spell share for ${spell.name}:`, e);
        return null;
    }
}

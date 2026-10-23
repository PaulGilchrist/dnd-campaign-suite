import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

function infoPopup(action, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            automationType: action.automation?.type,
            description,
            automation: action.automation,
        },
    };
}

function spellEffectKey(spellName) {
    return String(spellName || '').toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '_');
}

async function applyShareEffects(action, playerStats, campaignName) {
    const playerName = playerStats.name;
    const spell = action.spell;
    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);

    if (!companionType) {
        return infoPopup(action, 'No primal companion to share spell with.');
    }

    if (!spell) {
        return infoPopup(action, 'No spell cast to share.');
    }

    const companionName = `Primal Companion (${companionType})`;
    const rangeFt = rangeToFeet(action.automation?.range || '30_ft') ?? 30;
    const withinRange = await isWithinRange(playerName, companionName, rangeFt);
    if (!withinRange) {
        return infoPopup(action, `${companionName} is more than ${rangeFt} feet away. Spell not shared.`);
    }

    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const effects = Array.isArray(storedEffects) ? [...storedEffects] : [];
    const spellKey = spellEffectKey(spell.name);

    const casterEffects = effects.filter(
        te => te.target === playerName && te.source === playerName &&
            (te.effect === spellKey || te.effect.startsWith(`${spellKey}_`))
    );

    if (casterEffects.length === 0) {
        return null;
    }

    for (const te of casterEffects) {
        const sharedEffect = { ...te, target: companionName, sharedBy: 'Share Spells' };
        const existingIndex = effects.findIndex(
            e => e.target === companionName && e.effect === te.effect && e.source === playerName
        );
        if (existingIndex >= 0) {
            effects[existingIndex] = sharedEffect;
        } else {
            effects.push(sharedEffect);
        }
    }

    await setRuntimeValue('campaign', 'targetEffects', effects, campaignName);
    await setRuntimeValue(playerName, 'lastSpellShare', spell.name, campaignName);

    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'primal_companion_spell_share',
        name: 'Share Spells',
        spellName: spell.name,
        spellLevel: action.spellSlotLevel ?? spell.level ?? 0,
        targetName: companionName,
        description: `Share Spells: ${playerName} shares ${spell.name} with ${companionName}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[primalCompanionSpellShare] Error logging share:', e); });

    return infoPopup(action, `${spell.name} shared with ${companionName}.`);
}

export async function handle(action, playerStats, campaignName) {
    const playerName = playerStats.name;

    const companionType = getRuntimeValue(playerName, 'primalCompanionType', campaignName);
    if (!companionType) {
        return infoPopup(action, 'No primal companion summoned.');
    }

    const companionAlive = getRuntimeValue(playerName, 'primalCompanionAlive', campaignName);
    if (companionAlive !== true) {
        // Strict eligibility (fix#104 twin of #1396(c), mirroring primalCompanionSpellShareService.js:66):
        // 'primalCompanionAlive' is written true only at summon/restore (primalCompanionHandler.js:305/:533)
        // and never false, so the old `=== false` gate never armed — an unknown-alive companion (null/
        // undefined) kept this handler live and shared casts onto a possibly-dead companion. Anything not
        // explicitly true is NOT alive: decline with the handler-local infoPopup vocabulary
        // (sibling declines: 'No primal companion summoned.' at :91, applySpellShare at :109).
        return infoPopup(action, 'Primal companion is not alive.');
    }

    return applyShareEffects(action, playerStats, campaignName);
}

export async function applySpellShare(action, playerStats, campaignName, share) {
    if (!share) {
        return infoPopup(action, 'Spell not shared with primal companion.');
    }

    return applyShareEffects(action, playerStats, campaignName);
}

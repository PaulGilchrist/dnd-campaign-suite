import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

// FT-099: once-per-round reaction latch (CLA-345/CLA-371 family) — stamped at
// the cast commit in applyWarCasterReaction, cleared at round-wrap beside
// _Slow_Fall_usedRound in initiative.jsx + navigationHandlers.js.
const USED_ROUND_KEY = '_Reactive_Spell_usedRound';

function logRefusal(playerName, campaignName, reason) {
    addEntry(campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'reactive_spell_refused',
        name: 'Reactive Spell',
        description: `Reactive Spell: ${reason}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[reactionSpellHandler:refusal-log-error]', e); });
}

function refusal(action, playerName, campaignName, reason) {
    logRefusal(playerName, campaignName, reason);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${action.name} — ${reason}`,
            automation: action.automation,
        },
    };
}

function collectEligibleReactiveSpells(spellList) {
    const actionCastingTimes = ['1 action', 'Action'];
    const eligibleSpells = [];
    const warnings = [];

    for (const spell of spellList) {
        if (spell.prepared !== 'Always' && spell.prepared !== 'Prepared') continue;
        if (!actionCastingTimes.includes(spell.casting_time)) continue;

        const isSelfTarget = /^self\b/i.test(spell.range || '');
        const isSingleTarget = !spell.area_of_effect && !(spell.automation?.maxTargets > 1) && !isSelfTarget;

        if (!isSingleTarget) {
            warnings.push(spell.name);
            continue;
        }

        eligibleSpells.push({
            ...spell,
            level: spell.level || 0,
            isSingleTarget,
            hasAreaOfEffect: !!spell.area_of_effect,
            maxTargets: spell.automation?.maxTargets || 1,
        });
    }

    return { eligibleSpells, warnings };
}

export async function handle(action, playerStats, campaignName) {
    const auto = action?.automation;
    const playerName = playerStats?.name;

    // FT-099: once-per-round reaction gate at the row click — refuse before the
    // picker opens when this round's Reaction is already spent. Zero spend.
    const cs = await getCombatContext(campaignName);
    const currentRound = cs?.round || 1;
    const usedRound = Number(getRuntimeValue(playerName, USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        return refusal(action, playerName, campaignName, 'Once per round — Reactive Spell already used this round.');
    }

    // Reactive Spell fires at the creature leaving your reach — it needs a
    // target armed on your initiative card (no leaving-reach position producer
    // exists; this row is the GM-manual-adjacency affordance).
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    if (!target) {
        return refusal(action, playerName, campaignName, 'requires a target — set the Target dropdown on your initiative card first.');
    }

    const spellList = playerStats?.spellAbilities?.spells || [];
    const { eligibleSpells, warnings } = collectEligibleReactiveSpells(spellList);

    const descriptionParts = [
        `<b>${action.name}:</b> Select a spell with a casting time of 1 action to cast as a reaction when a creature leaves your reach.`,
    ];

    descriptionParts.push(eligibleSpells.length === 0
        ? 'No spells with a casting time of 1 action are available.'
        : `Available spells: ${eligibleSpells.map(s => s.name).join(', ')}.`);

    if (warnings.length > 0) {
        descriptionParts.push(`<i>Excluded: ${warnings.join(', ')} target more than one creature and cannot be cast with Reactive Spell.</i>`);
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

// FT-099: cast-commit leg. Latches the once-per-round Reaction (awaited, at
// the trigger, before the cast resolves — CLA-371), range-checks the spell at
// the leaving creature (isWithinRange), records the reaction, logs ability_use,
// and reports ok so the caller can route the spell through the real reaction
// cast machinery (gateMetamagic → prepareSpellCast pays the slot numerically).
// Refusals spend nothing.
export async function applyWarCasterReaction(targetName, spellName, spellData, playerStats, campaignName) {
    const playerName = playerStats.name;
    const currentRound = (await getCombatContext(campaignName))?.round || 1;
    const usedRound = Number(getRuntimeValue(playerName, USED_ROUND_KEY, campaignName) ?? 0);
    if (usedRound === currentRound) {
        logRefusal(playerName, campaignName, 'Once per round — Reactive Spell already used this round.');
        return { ok: false, refused: 'Once per round — Reactive Spell already used this round.' };
    }

    const rangeFt = rangeToFeet(spellData?.range);
    if (rangeFt != null) {
        const inRange = await isWithinRange(playerName, targetName, rangeFt);
        if (!inRange) {
            const reason = `${targetName} is out of range for ${spellName} (${spellData.range}).`;
            logRefusal(playerName, campaignName, reason);
            return { ok: false, refused: reason };
        }
    }

    // CLA-371 lesson: serialize the latch — awaited stamp at the trigger,
    // before resolution, so a second same-round click reads the stamped round.
    await setRuntimeValue(playerName, USED_ROUND_KEY, currentRound, campaignName);

    const stored = getRuntimeValue('campaign', 'warCasterReactions') || [];
    // CLA-368 lesson: never mutate the runtime array in place — build a new one.
    setRuntimeValue('campaign', 'warCasterReactions', [...stored, {
        targetName,
        spellName,
        spellData,
        characterName: playerName,
        timestamp: Date.now(),
    }], campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'War Caster - Reactive Spell',
        description: `War Caster Reactive Spell: Casting ${spellName} as a reaction on ${targetName}.`,
    }).catch((e) => { console.error('[reactionSpellHandler:log-error]', e); });

    return { ok: true };
}

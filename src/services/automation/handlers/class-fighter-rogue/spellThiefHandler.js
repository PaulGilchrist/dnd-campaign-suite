import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { createSaveListener, buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { findLastAttack, rollbackSpellEffects } from '../../common/damageRollback.js';
const SPELL_THIEF_BLOCK_KEY = 'spellThiefBlocked';
const SPELL_THIEF_STOLEN_KEY = 'spellThiefStolen';
const SPELL_THIEF_BLOCKED_LIST_KEY = '_spellThiefBlockedList';
const SPELL_THIEF_STOLEN_LIST_KEY = '_spellThiefStolenList';
const SPELL_THIEF_CASTER_BLOCK_KEY = '_spellThiefCasterBlock';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

// CLA-325: monster-card cast stamps carry the MONSTER action label ("3. Frost Ray"),
// not a spells.json name — strip the leading action number so block keys, the stolen
// list and the spellCalc2024 injection (which resolves against allSpells) all agree.
export function normalizeStolenSpellName(name) {
    return String(name || '').replace(/^\d+\.\s*/, '').trim();
}

function getBlockedSpellKey(casterName, spellName) {
    return `${SPELL_THIEF_BLOCK_KEY}_${casterName}_${spellName}`;
}

function getStolenSpellKey(casterName, spellName) {
    return `${SPELL_THIEF_STOLEN_KEY}_${casterName}_${spellName}`;
}

async function addBlockedSpell(thiefName, casterName, spellName, campaignName) {
    await setRuntimeValue(thiefName, getBlockedSpellKey(casterName, spellName), true, campaignName);
    const list = getRuntimeValue(thiefName, SPELL_THIEF_BLOCKED_LIST_KEY, campaignName);
    const entries = list ? JSON.parse(list) : [];
    if (!entries.some(e => e.casterName === casterName && e.spellName === spellName)) {
        entries.push({ casterName, spellName });
        await setRuntimeValue(thiefName, SPELL_THIEF_BLOCKED_LIST_KEY, JSON.stringify(entries), campaignName);
    }

    const casterList = getRuntimeValue(casterName, SPELL_THIEF_CASTER_BLOCK_KEY, campaignName);
    const casterEntries = casterList ? JSON.parse(casterList) : [];
    if (!casterEntries.some(e => e.thiefName === thiefName && e.spellName === spellName)) {
        casterEntries.push({ thiefName, spellName });
        await setRuntimeValue(casterName, SPELL_THIEF_CASTER_BLOCK_KEY, JSON.stringify(casterEntries), campaignName);
    }
}

async function addStolenSpell(playerName, casterName, spellName, campaignName) {
    await setRuntimeValue(playerName, getStolenSpellKey(casterName, spellName), true, campaignName);
    const list = getRuntimeValue(playerName, SPELL_THIEF_STOLEN_LIST_KEY, campaignName);
    const entries = list ? JSON.parse(list) : [];
    if (!entries.some(e => e.casterName === casterName && e.spellName === spellName)) {
        entries.push({ casterName, spellName });
        await setRuntimeValue(playerName, SPELL_THIEF_STOLEN_LIST_KEY, JSON.stringify(entries), campaignName);
    }
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Spell Thief';

    const usesKey = getRuntimeUsesKey(featureName);
    const storedUses = getRuntimeValue(playerName, usesKey);
    const currentUses = storedUses != null ? Number(storedUses) : 1;

    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has no uses remaining. Recharges after a Long Rest.`,
                automation: auto,
            },
        };
    }

    // CLA-325: trigger gate (mirrors the Counterspell reaction gate and the
    // CLA-315 Slow Fall refusal pattern) — the Reaction may only be taken
    // immediately after a SPELL cast by ANOTHER creature that targeted the thief.
    // Refusals spend nothing and log to the campaign log.
    const refuse = (reason) => {
        addEntry(campaignName, {
            type: 'automation',
            characterName: playerName,
            automationType: 'spell_thief_refused',
            name: featureName,
            description: reason,
            timestamp: Date.now(),
        }).catch((e) => { console.error("[spellThief] Error logging refusal:", e); });
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: reason,
                automation: auto,
            },
        };
    };

    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return refuse(`${featureName} requires an active combat. Select a creature in combat and try again.`);
    }

    const lastAttack = await findLastAttack(campaignName);
    const attackEvent = lastAttack.attackEvent;
    if (!attackEvent) {
        return refuse(`${featureName} — no recent spell cast to respond to.`);
    }

    // Spell-origin: PC spell pipeline stamps rollType 'spell-save'; monster-card
    // save attacks stamp isSpellDamage (CLA-324) or a saveType/saveDc pair.
    const spellOrigin = attackEvent.rollType === 'spell-save'
        || attackEvent.isSpellDamage === true
        || (attackEvent.saveDc != null && !!attackEvent.saveType);
    if (!spellOrigin) {
        return refuse(`${featureName} — the most recent attack was not a spell cast. No spell to steal.`);
    }

    const casterName = action.casterName || attackEvent.attackerName || null;
    if (!casterName) {
        return refuse(`${featureName} — could not identify the spellcaster.`);
    }
    if (casterName === playerName) {
        return refuse(`${featureName} responds to another creature's spell — you cannot steal from yourself.`);
    }

    const targetsThief = attackEvent.targetName === playerName
        || (attackEvent.affectedTargets || []).includes(playerName);
    if (!targetsThief) {
        return refuse(`${featureName} — the most recent spell did not target you.`);
    }

    const casterCreature = cs.creatures ? cs.creatures.find(c => c.name === casterName) : null;
    if (!casterCreature) {
        return refuse(`${featureName} — ${casterName} is not in combat.`);
    }

    const spellName = normalizeStolenSpellName(action.spellName || attackEvent.attackName || attackEvent.damageName || 'unknown spell');

    const saveDc = buildSaveDc(auto, playerStats);

    const { promise } = createSaveListener(campaignName, {
        targetName: casterName,
        saveType: auto.saveType || 'INT',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — ${casterName} must make INT save (DC ${saveDc}) or lose the spell.`,
    }).catch((e) => { console.error("[spellThief] Error:", e); });

    const saveResult = await promise;
    const success = saveResult.success;

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    addEntry(campaignName, {
        type: 'roll',
        name: featureName,
        characterName: playerName,
        rollType: 'save-damage',
        targetName: casterName,
        saveDc,
        saveType: auto.saveType || 'INT',
        saveResult: success ? 'success' : 'failure',
        total: saveResult.total ?? 0,
        rolls: [saveResult.roll ?? 0],
        bonus: saveResult.saveBonus ?? 0,
        formula: `1d20${saveResult.saveBonus !== 0 ? '+' + saveResult.saveBonus : ''}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[spellThief] Error:", e); });

    let negationNote = '';
    if (!success) {
        // CLA-325: "negate spell" — retroactively roll back the cast's damage,
        // conditions and target effects via the verified Counterspell consumer
        // (rollbackSpellEffects works off the monster-card / spell-save lastAttack
        // stamps, same retroactive-negation model as Shield / Illusory Self).
        const rolledBack = await rollbackSpellEffects(attackEvent, campaignName, featureName, cs);

        if (rolledBack.damageHealed > 0 || rolledBack.conditionsRemoved.length > 0 || rolledBack.effectsRemoved > 0) {
            negationNote = ` ${rolledBack.damageHealed} HP restored, ${rolledBack.conditionsRemoved.length} condition(s) and ${rolledBack.effectsRemoved} effect(s) rolled back.`;
            addEntry(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: featureName,
                description: `${featureName} negated '${spellName}' — ${rolledBack.damageHealed} HP restored, ${rolledBack.conditionsRemoved.length} condition(s) removed, ${rolledBack.effectsRemoved} target effect(s) cleared.`,
            }).catch((e) => { console.error("[spellThief] Error:", e); });
        }

        await addBlockedSpell(playerName, casterName, spellName, campaignName);
        await addStolenSpell(playerName, casterName, spellName, campaignName);

        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${casterName} failed INT save (DC ${saveDc}). Spell negated.${negationNote} ${playerName} steals ${spellName} for 8 hours. ${casterName} cannot cast ${spellName} for 8 hours.`,
        }).catch((e) => { console.error("[spellThief] Error:", e); });

        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    } else {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${casterName} succeeded on INT save (DC ${saveDc}). ${featureName} has no effect.`,
        }).catch((e) => { console.error("[spellThief] Error:", e); });
    }

    const resultDescription = success
        ? `${casterName} succeeded on INT save (DC ${saveDc}). ${featureName} has no effect.`
        : `${casterName} failed INT save (DC ${saveDc}). Spell negated.${negationNote} ${playerName} steals ${spellName} for 8 hours.`;

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: resultDescription,
            automation: auto,
        },
    };
}

export function isBlockedBySpellThief(playerName, casterName, spellName, campaignName) {
    const blockedKey = getBlockedSpellKey(casterName, spellName);
    const blocked = getRuntimeValue(playerName, blockedKey, campaignName);
    return blocked === true;
}

export function hasStolenSpell(playerName, casterName, spellName, campaignName) {
    const stolenKey = getStolenSpellKey(casterName, spellName);
    const stolen = getRuntimeValue(playerName, stolenKey, campaignName);
    return stolen === true;
}

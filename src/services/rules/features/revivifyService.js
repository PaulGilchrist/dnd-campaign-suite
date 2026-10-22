import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { consumeMaterial } from '../spells/materialComponents.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { isCreatureDead } from '../../shared/hpModifier.js';

function refusalPopup(spell, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            // fix#76 'Unknown' name canon: a refusal popup is the audit of WHY
            // nothing happened — it must never throw on its own name field.
            name: spell?.name ?? 'Unknown',
            automationType: 'revivify',
            description,
        },
    };
}

// #1407(a)/(b) validate-before-consume frame (fix#22 house order; fix#5 parseHp
// law — refuse, never stamp undefined, never fabricate 0). Resolves everything the
// post-consume audit needs while the diamond is still carried: returns
// { description } to refuse WITHOUT consuming, or { oldHp, maxHp } to proceed.
// Read order pinned by the edge census: caster guard -> oldHp -> maxHp.
function validateBeforeConsume(spellName, casterName, playerStats, targetCreature, targetName) {
    if (!casterName) {
        const consoleMsg = `[revivify] Caster name missing (playerStats=${String(playerStats)}) — refused, no diamond consumed`;
        console.error(consoleMsg);
        return { description: `${spellName} cannot run: the caster is unknown. No diamond was consumed.` };
    }

    // Canonical HP frame: players runtime-canonical (pitfall 37), monsters
    // summary-canonical (CLA-303) — same source pair as hpModifier.js:28-30.
    // The precedence-safe chain is explicit here: the old trigger ternary
    // `applied ? applied.maxHp : (targetCreature.maxHp ?? 0)` let the TRUTHY
    // arm ship undefined because `?? 0` only guarded the (dead) else arm.
    const isPlayer = targetCreature.type === 'player';
    const oldHp = isPlayer ? (getRuntimeValue(targetName, 'currentHitPoints') ?? 0) : (targetCreature.currentHp ?? 0);
    const maxHp = isPlayer ? (getRuntimeValue(targetName, 'hitPoints') ?? targetCreature.maxHp) : targetCreature.maxHp;
    if (maxHp == null) {
        console.error(`[revivify] Cannot determine maxHp for ${targetName} (summary.maxHp=${String(targetCreature.maxHp)}, isPlayer=${isPlayer}) — refused, no diamond consumed`);
        return { description: `Could not determine max HP for ${targetName}. ${spellName} was refused and no diamond was consumed.` };
    }

    return { oldHp, maxHp };
}

export async function triggerRevivify(spell, metaCtx, playerStats, campaignName, targetName) {
    // #1409(d): refusal/popup text derives the spell name from the payload, never
    // a hardcoded literal. Census: the only route keys are 'revivify'/'Revivify'
    // (useSimpleSpellHandlers.js:341, useComplexSpellHandlers.js:198), so with a
    // disk-stamped spell the interpolated bytes are identical to the old literal;
    // custom lane names (SP-100 homebrew variants) now name the actual feature.
    const spellName = spell?.name ?? 'Unknown';
    const casterName = playerStats?.name ?? null;

    // Canonical combatSummary source (change-data) — the /combat-summary key is
    // never written and always returned {value:null}, so the old fetch saw no creatures.
    const combatSummary = await getCombatContext(campaignName);
    const targetCreature = combatSummary?.creatures?.find(c => c.name === targetName);

    if (!targetCreature) {
        console.error(`[revivify] Target ${targetName} not found in combat summary`);
        return refusalPopup(spell, `${targetName} is not present in combat. ${spellName} can only target a creature that has died within the last minute.`);
    }

    // Re-validate the dead-target gate BEFORE consuming the diamond or writing HP.
    if (!isCreatureDead(combatSummary, targetName)) {
        console.error(`[revivify] Living target refused: ${targetName}`);
        return refusalPopup(spell, `${targetName} is not dead. ${spellName} can only target a creature that has died within the last minute.`);
    }

    // #1407(a) validate-before-consume (fix#22 house order): every value the
    // post-consume audit log needs is resolved by validateBeforeConsume() HERE,
    // while the diamond is still carried. Post-consume code below has zero
    // fallible derefs, so a spent diamond can never outlive its log
    // (every-automation-logs).
    const frame = validateBeforeConsume(spellName, casterName, playerStats, targetCreature, targetName);
    if (frame.description) {
        return refusalPopup(spell, frame.description);
    }
    const { oldHp, maxHp } = frame;

    const consumed = await consumeMaterial(playerStats, 'Diamond (300 gp)', campaignName);
    if (!consumed) {
        return refusalPopup(spell, `${spellName} requires a diamond worth 300+ GP, which the spell consumes.`);
    }

    // Canonical heal path: runtime currentHitPoints/isDead/deathSaves for PCs,
    // combatSummary currentHp + persisted summary for monsters.
    // #1409(c) dead fallback ternaries removed (orphan-code rule): `applied`
    // cannot be falsy here. applyHealingToTarget returns null only when
    // modifyHitPoints misses (hpModifier.js:18-25), whose two guards are
    // `!combatSummary || !combatSummary.creatures` and find(c => c.name ===
    // targetName) — the SAME array and SAME predicate already proven truthy at
    // :62/:64 above (nothing mutates combatSummary.creatures between those
    // lines and this call; consumeMaterial touches only inventory + runtime +
    // PATCH). The heal-block path returns a truthy zero-heal row
    // (healingBlock.js:40). So the old `: 1` / `: 1` / `: (maxHp ?? 0)` else
    // arms were structurally unreachable.
    const applied = applyHealingToTarget(combatSummary, targetName, 1 - oldHp, campaignName);

    addEntry(campaignName, {
        type: 'hp_change',
        targetName,
        delta: applied.actualHeal,
        currentHp: applied.newHp,
        maxHp,
        isHealing: true,
        sourceName: casterName,
        note: spellName,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[revivify] Error logging heal:', e); });

    // applyHealingToTarget already dispatches 'combat-summary-updated' on a non-zero delta.

    return {
        type: 'popup',
        payload: {
            type: 'heal',
            name: spellName,
            targetName,
            finalHeal: applied.actualHeal,
            total: 1,
            formula: '1 HP (revived)',
            rolls: [],
            rawTotal: 1,
        },
    };
}

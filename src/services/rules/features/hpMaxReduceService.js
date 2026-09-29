import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../combat/applyDamage.js';
import { registerTargetEffect } from '../../combat/conditions/targetEffectDefinitions.js';
import storage from '../../ui/storage.js';

// MA-1489: Specter "Life Drain" HP-max consumers — standing ledger lookup +
// base-max resolution (§947 family: hpMaxReduction consumers were
// reset-only readers, this is the first producer). NPC/combatant victims
// resolve max from the canonical cs entry; PC victims from the runtime
// hitPoints base the greaterRestorationHandler restore math consumes
// (hitPoints + hpMaxReduction). Unresolvable = null — honest refusal,
// console.error, never fabricated (MA-1451 refuseAbilityDrain twin).
function findStandingHpMaxReduce(targetName) {
    return (getRuntimeValue('campaign', 'targetEffects') || [])
        .find(te => te.target === targetName && te.effect === 'hp_max_reduce');
}

function resolveHpMaxBase({ target, combatSummary, campaignName }) {
    if (target.type === 'player') {
        const raw = Number(getRuntimeValue(target.name, 'hitPoints', campaignName));
        return Number.isInteger(raw) && raw > 0 ? raw : null;
    }
    const csCreature = combatSummary?.creatures?.find(c => c.name === target.name);
    const raw = Number(csCreature?.maxHp ?? target?.maxHp);
    return Number.isInteger(raw) && raw > 0 ? raw : null;
}

function refuseHpMaxReduce({ attackName, target, attackerName, logEntry }) {
    console.error(`[MA-1489] max HP not resolvable for ${target.name} — HP max drain not applied`);
    logEntry({
        type: 'automation',
        automationType: 'hp_max_reduce_refused',
        characterName: attackerName,
        abilityName: attackName,
        targetName: target.name,
        description: `${attackerName} ${attackName} landed, but ${target.name}'s Hit Point maximum is not resolvable — drain recorded advisory only (GM-enforced).`,
        timestamp: Date.now(),
    });
}

// EB-NPC victims: cs maxHp is the canonical monster HP truth (§17) —
// mutate via the canonical storage.set combatSummary channel (applyDamage.
// persistAndLogDamageOutcome twin) and stamp every HP variant the entry
// carries (§296/§298 four-key discipline); currentHp clamps down only when
// it exceeds the NEW max, never below 0 (a zero/negative max rides the
// canonical lethal clamp below instead).
function npcHpMaxDrainWrite({ target, combatSummary, newMax, campaignName }) {
    const csCreature = combatSummary?.creatures?.find(c => c.name === target.name);
    if (!csCreature) return false;
    const clampedMax = Math.max(0, newMax);
    csCreature.maxHp = clampedMax;
    if ('maxHitPoints' in csCreature) csCreature.maxHitPoints = clampedMax;
    if (clampedMax > 0 && Number(csCreature.currentHp) > clampedMax) {
        csCreature.currentHp = clampedMax;
        if ('currentHitPoints' in csCreature) csCreature.currentHitPoints = clampedMax;
    }
    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    return true;
}

// PC victims: stamp the exact per-char key shape greaterRestorationHandler
// consumes (numeric hpMaxReduction accumulating the total, its restore is
// hitPoints + hpMaxReduction — byte-symmetric with the reduction below).
// §39 same-tick multi-key discipline: sequential awaits, one key at a time.
async function pcHpMaxDrainWrite({ target, damage, newMax, campaignName }) {
    const standingReduction = Number(getRuntimeValue(target.name, 'hpMaxReduction', campaignName) || 0);
    const currentHp = Number(getRuntimeValue(target.name, 'currentHitPoints', campaignName) || 0);
    await setRuntimeValue(target.name, 'hitPoints', Math.max(0, newMax), campaignName);
    await setRuntimeValue(target.name, 'currentHitPoints', Math.max(0, Math.min(currentHp, newMax)), campaignName);
    await setRuntimeValue(target.name, 'hpMaxReduction', standingReduction + damage, campaignName);
}

// RAW death-at-0: the max reaching 0 or below drops the victim via the
// canonical applyDamageToTarget lethal clamp (MA-1451 lethalStrengthDrop
// twin — currentHp captured BEFORE any drain-side clamp rides the call).
async function lethalHpMaxDrop({ target, combatSummary, characters, campaignName, attackerName, attackName, baseMax, reduced, logEntry }) {
    const csCreature = combatSummary?.creatures?.find(c => c.name === target.name);
    const currentHp = target.type === 'player'
        ? Number(getRuntimeValue(target.name, 'currentHitPoints', campaignName) ?? csCreature?.currentHp ?? 0)
        : Number(csCreature?.currentHp ?? 0);
    if (currentHp > 0) {
        await applyDamageToTarget(combatSummary, target.name, currentHp, ['Necrotic'], { campaignName, characters, ignoreResistance: true, attackerName });
    }
    logEntry({
        type: 'automation',
        automationType: 'hp_max_reduce_lethal',
        characterName: target.name,
        sourceName: attackerName,
        abilityName: attackName,
        description: `${target.name}'s Hit Point maximum was drained to 0 or below (base ${baseMax}, total reduced ${reduced}) by ${attackerName}'s ${attackName} — the target falls (Life Drain death clamp).`,
        timestamp: Date.now(),
    });
}

function logHpMaxReduceZero({ attackName, target, attackerName, logEntry }) {
    logEntry({
        type: 'automation',
        automationType: 'hp_max_reduce',
        characterName: attackerName,
        abilityName: attackName,
        targetName: target.name,
        description: `${attackerName}'s ${attackName} dealt 0 damage — ${target.name}'s Hit Point maximum is reduced by 0 (equal to damage taken). No change.`,
        timestamp: Date.now(),
    });
}

function buildHpMaxReduceNote({ target, damage, newMax }) {
    return `${target.name}'s Hit Point maximum decreased by ${damage} — ends on a long rest${target.type === 'player' ? ' (Greater Restoration can restore early)' : ''}; ${newMax <= 0 ? 'maximum reached 0 — death clamp fires' : 'dies if the maximum reaches 0'}.`;
}

// MA-1547: save-face detail entry — the RAW "Failure or Success:" rider pays
// BOTH faces, so every Draining Kiss resolution records its face + numerics
// under grep-able automationType hp_max_reduce (§216 ledger truth). Attack-lane
// producers never pass saveOutcome → this helper stays unscheduled for them.
function logSaveFaceHpMaxReduce({ saveOutcome, target, attackerName, attackName, amount, prevMax, newMax, logEntry }) {
    logEntry({
        type: 'automation',
        automationType: 'hp_max_reduce',
        characterName: target.name,
        sourceName: attackerName,
        abilityName: attackName,
        description: `${target.name} ${saveOutcome === 'success' ? 'succeeded' : 'failed'} the save against ${attackerName}'s ${attackName} and took ${amount} damage — Hit Point maximum reduced by ${amount} (equal to damage taken): ${prevMax} → ${newMax}. Ends only on greater restoration or a long rest (no combat clock — GM-enforced).`,
        timestamp: Date.now(),
    });
}

async function writeHpMaxDrain({ target, combatSummary, damage, newMax, campaignName }) {
    if (target.type === 'player') {
        await pcHpMaxDrainWrite({ target, damage, newMax, campaignName });
        return true;
    }
    return npcHpMaxDrainWrite({ target, combatSummary, newMax, campaignName });
}

// MA-1489 (Specter Life Drain, attack-hit lane) + MA-1547 (Succubus Draining
// Kiss, SAVE lane — §1096 save-path twin): the shared numeric HP-max-drain
// core. On every resolved application the victim's max HP decreases by the
// damage TAKEN, accumulating on the registered hp_max_reduce te ledger
// {baseMax, reduced, max} (single registerTargetEffect write, §39), with the
// old→new max logged. RAW rows state no end for the reduction — MA-1451 te
// convention: long-rest restore via restRules-longRest reading this ledger,
// Greater Restoration early-restore on PCs via hpMaxReduction; NO combat
// addExpiration clock. A zero-damage application reduces nothing but still
// logs (equal-to-damage is 0). saveOutcome ('success'|'failure', MA-1547):
// when provided the RAW "Failure or Success:" rider pays BOTH faces, and the
// drain log names the save face — omit it on the attack lane and every
// MA-1489 byte stays identical. Returns 'zero' | null (refused) | the
// post-drain ledger so producers can compose their own face detail.
export async function applyHpMaxReduce({ attackName, target, damage, combatSummary, characters, campaignName, attackerName, logEntry, saveOutcome = null }) {
    const amount = Number(damage) || 0;
    if (amount <= 0) {
        logHpMaxReduceZero({ attackName, target, attackerName, logEntry });
        return 'zero';
    }
    const existing = findStandingHpMaxReduce(target.name);
    const baseMax = Number.isInteger(existing?.baseMax) ? existing.baseMax : resolveHpMaxBase({ target, combatSummary, campaignName });
    if (!Number.isInteger(baseMax) || baseMax <= 0) {
        refuseHpMaxReduce({ attackName, target, attackerName, logEntry });
        return null;
    }
    const prevMax = Number.isInteger(existing?.max) ? existing.max : baseMax;
    const reduced = (Number(existing?.reduced) || 0) + amount;
    const newMax = baseMax - reduced;
    if (!await writeHpMaxDrain({ target, combatSummary, damage: amount, newMax, campaignName })) {
        refuseHpMaxReduce({ attackName, target, attackerName, logEntry });
        return null;
    }
    registerTargetEffect(campaignName, target.name, 'hp_max_reduce', attackerName, {
        baseMax, reduced, max: newMax, duration: 'until_long_rest',
    });
    logEntry({
        type: 'condition',
        action: 'applied',
        characterName: target.name,
        condition: 'Max HP Reduced',
        reason: `${attackName} — max HP ${prevMax} → ${newMax} (−${amount}, equal to damage taken)`,
        note: buildHpMaxReduceNote({ target, damage: amount, newMax }),
        timestamp: Date.now(),
    });
    if (saveOutcome) logSaveFaceHpMaxReduce({ saveOutcome, target, attackerName, attackName, amount, prevMax, newMax, logEntry });
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
    if (newMax > 0) return { baseMax, reduced, max: newMax };
    await lethalHpMaxDrop({ target, combatSummary, characters, campaignName, attackerName, attackName, baseMax, reduced, logEntry });
    return { baseMax, reduced, max: newMax };
}

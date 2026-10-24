import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { isDistanceInRange } from '../../rules/combat/rangeCheck.js';

function endWardingBond(targetName, casterName, campaignName, reason) {
    const rawTargetBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName);
    const targetBuffs = Array.isArray(rawTargetBuffs) ? rawTargetBuffs : [];
    // fix#352(e): fire-and-forget RETAINED (fix#349(d) ruling — no awaits
    // added); the CLASS owed loud-CATCH arms per the precedent bytes at
    // relentlessRageService.js:113-114 ('setRuntimeValue(...).catch((e) => {
    // console.error(...); })'). Wrapped in Promise.resolve because the real
    // store core answers creature-key writes with UNDEFINED (useRuntimeState
    // .js:97-98 valuesEqual 'return;' and the no-return fall-through at the
    // function's end) — bare .catch on undefined throws TypeError; the store
    // core is off-limits, so the arm lives here. Store-reject loud-vs-
    // stranded-store honesty per #1428.
    Promise.resolve(setRuntimeValue(targetName, 'activeBuffs', targetBuffs.filter(b => b.effect !== 'warding_bond'), campaignName))
        .catch((e) => { console.error('[wardingBond] target activeBuffs store reject:', e); });
    const rawCasterBuffs = getRuntimeValue(casterName, 'activeBuffs', campaignName);
    const casterBuffs = Array.isArray(rawCasterBuffs) ? rawCasterBuffs : [];
    Promise.resolve(setRuntimeValue(casterName, 'activeBuffs', casterBuffs.filter(b => b.effect !== 'warding_bond'), campaignName))
        .catch((e) => { console.error('[wardingBond] caster activeBuffs store reject:', e); });
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: 'Warding Bond',
        description: `Warding Bond ends — ${reason}.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[wardingBond] Break log error:', e); });
}

function shareWardingBondDamage({ casterName, casterCreature, casterIsPlayer, casterHp, wardDamage, creature, campaignName }) {
    // #1427(c) validation gate inside the bond's sole damage executor (fix#39 strict-
    // presence-before-coercion family + fix#5 refuse-shape: loud console.error, ZERO
    // write/log/state on BOTH legs — no half-baked state). RAW law, both rulesets
    // verbatim — public/data/spells.json 'Warding Bond': "each time it takes damage,
    // you take the same amount of damage" and public/data/2024/spells.json:14391 the
    // identical clause: the bond mirrors DAMAGE, and damage is >= 0. Non-finite input
    // (undefined/NaN/null/string) poisoned caster HP and the runtime store with NaN
    // (old :25/:40); negative input HEALED the caster UNCAPPED (:25 Math.max clamps
    // only at 0 — captured 5/-10 -> 15 on a maxHp-10 caster). Producer census: sole
    // production caller applyDamage.js:821 dispatches ONLY under the wardDamage > 0
    // gate at :900 — invalid input reaching this executor is an upstream programming
    // error, so REFUSE LOUD, never clamp-fold. (Caster reads in applyWardingBond
    // precede this gate by design — pure lookups, no writes.)
    if (!Number.isFinite(wardDamage)) {
        console.error(`[wardingBond] Invalid wardDamage (${String(wardDamage)}): non-finite input refused — no HP write, no log.`);
        return;
    }
    if (wardDamage < 0) {
        console.error(`[wardingBond] Invalid wardDamage (${wardDamage}): negative damage is not damage (RAW: bond shares damage, never heals) — no HP write, no log.`);
        return;
    }
    const sharedDamage = wardDamage;
    const oldHp = casterHp;
    // #1427(a): sharedDamage is finite and >= 0 here — applyWardingBond refuses
    // negative/NaN at the entry gate, so this mirror can never heal (old bytes
    // casterHp - sharedDamage on negative input ADDED HP uncapped by :31-33 maxHp).
    const newHp = Math.max(0, casterHp - sharedDamage);
    if (casterIsPlayer) {
        // fix#352(e): loud-CATCH arm (see endWardingBond :9-13 for rationale).
        Promise.resolve(setRuntimeValue(casterName, 'currentHitPoints', newHp, campaignName))
            .catch((e) => { console.error('[wardingBond] caster currentHitPoints store reject:', e); });
    } else {
        casterCreature.currentHp = newHp;
    }
    const casterMaxHp = casterIsPlayer
        ? getRuntimeValue(casterName, 'maxHitPoints', campaignName)
        : (casterCreature.maxHp || 10);
    const concentration = casterIsPlayer
        ? getRuntimeValue(casterName, 'concentration', campaignName)
        : casterCreature.concentration;
    const delta = -(oldHp - newHp);
    addEntry(campaignName, {
        type: 'hp_change',
        targetName: casterName,
        delta,
        currentHp: newHp,
        maxHp: casterMaxHp,
        // #1427(b) sign-convention compliance: delta is the SIGNED HP change
        // (damage lane emits negative) and the flag must match its sign — canonical
        // producer law CharHitPoints.jsx:35 `isHealing: delta > 0`; renderer decides
        // polarity from delta too (fix#49 home, LogHpHealingEntry.jsx:90-91
        // `isDamage = entry.delta < 0` / `isZero = entry.delta === 0` fourth arm).
        // Post-gate delta <= 0 always, so isHealing is structurally honest.
        isHealing: delta > 0,
        isUnconscious: newHp <= 0,
        abilityName: 'Warding Bond',
    }).catch((e) => { console.error("[wardingBond] Error:", e); });
    if (concentration && sharedDamage > 0) {
        const newDc = Math.max(10, Math.floor(sharedDamage / 2));
        if (casterIsPlayer) {
            // fix#349 #1425 store-first: clone-write + setRuntimeValue — the
            // canonical persist idiom, sibling sleetStormHandler.js:219-224
            // (read → Array-safe copy → mutate the COPY → setRuntimeValue
            // (casterName, key, copy, campaignName), fire-and-forget unawaited).
            // Pre-fix :79 mutated the store-reachable LIVE concentration object
            // with no write-back: no disk persist, no SSE broadcast — silent
            // drift between clients. NPC caster keeps the in-place combatSummary
            // mutation, canonical at its sibling applyDamage.js:903-911
            // (handleSummonVanishAndConcentrationDc: "Mutates combatSummary in
            // place — the combatSummaryChanged persist below writes"). Fire-and-
            // forget RETAINED (siblings unawaited; AGENTS.md: setRuntimeValue
            // need not be awaited). Race stated: another client reading the dc
            // before the POST flush + SSE echo sees the pre-damage dc — the
            // same optimistic-write window every unawaited setRuntimeValue lane
            // carries; fix#352(e) CLOSED the no-catch policy (#1428) on this
            // write with a loud-CATCH arm below — fire-and-forget RETAINED,
            // no await added (fix#349(d) ruling).
            Promise.resolve(setRuntimeValue(casterName, 'concentration', { ...concentration, dc: newDc }, campaignName))
                .catch((e) => { console.error('[wardingBond] caster concentration store reject:', e); });
        } else {
            concentration.dc = newDc;
        }
    }
    // RAW: the bond ends when the caster drops to 0 hit points.
    if (newHp <= 0) {
        endWardingBond(creature.name, casterName, campaignName, `${casterName} dropped to 0 hit points`);
    }
}

export function applyWardingBond(creature, combatSummary, campaignName, wardDamage) {
    const targetBondSource = getRuntimeValue(creature.name, 'activeBuffs', campaignName);
    const targetActiveBuffs = Array.isArray(targetBondSource) ? targetBondSource : [];
    const wardingBondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond');
    if (!wardingBondBuff || !wardingBondBuff.sourceCharacter || wardingBondBuff.sourceCharacter === creature.name) {
        return;
    }

    const casterName = wardingBondBuff.sourceCharacter;
    const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
    const targetCreature = combatSummary.creatures.find(c => c.name === creature.name);
    const distance = casterCreature && targetCreature ? getDistanceFeet(casterCreature.position, targetCreature.position) : null;
    // Separation beyond 60 ft ends the bond (gridless distance is lenient — null stays in range).
    if (distance != null && !isDistanceInRange(distance, 60)) {
        endWardingBond(creature.name, casterName, campaignName, `${creature.name} separated from ${casterName} by more than 60 feet`);
        return;
    }
    if (!isDistanceInRange(distance, 60)) {
        return;
    }

    const casterIsPlayer = !casterCreature || casterCreature.type === 'player' || typeof casterCreature.currentHp === 'undefined';
    const casterHp = casterIsPlayer
        ? getRuntimeValue(casterName, 'currentHitPoints', campaignName)
        : casterCreature.currentHp;
    if (casterHp > 0) {
        shareWardingBondDamage({ casterName, casterCreature, casterIsPlayer, casterHp, wardDamage, creature, combatSummary, campaignName });
    }
}

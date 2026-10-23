import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { addEntry } from '../../ui/logService.js';

function findBlessingInBonusActions(computed) {
    // fix#221 (ledger :1325) carrier #2 — 5e sheet shape. The 5e disk row
    // (public/data/classes.json:12416-12421) carries automation.casting_time
    // "1 bonus action", so featureCategorizationUtils.js CASTING_TIME_CATEGORY :20
    // routes it to bonusActions BEFORE the name-path specialActions default (:74/
    // :97) can ever see it. Absent bonusActions is a tolerated legacy shape
    // (#1188 legacy saves — the 2024 carrier below already resolved the row in
    // every pre-fix live shape); present-but-non-array is loud, mirroring the
    // #1188 specialActions refusal bytes.
    const bonusActions = computed.bonusActions;
    if (bonusActions == null) return null;
    if (!Array.isArray(bonusActions)) { console.error('[applyDamage] bonusActions is not an array'); throw new Error('bonusActions must be an array'); }
    return bonusActions.find(f => f.name === "Dark One's Blessing");
}

function resolveFiendBlessingFeature(computed) {
    // fix#221 (ledger :1325) dual-ruleset patron names: 5e disk names the warlock
    // subclass "Fiend" (public/data/classes.json:12272, index "fiend"; classRules.js:35
    // copies that disk name verbatim), 2024 disk names the major "Fiend Patron"
    // (public/data/2024/classes.json:12409). The old single literal 'Fiend Patron'
    // silently declined every 5e-shape sheet at this first guard — total feature loss
    // confirmed LIVE: checkDarkOnesBlessing is the ONLY consumer of this feature's
    // kill-trigger (grep 'reduce_creature_to_0_hp' src/ = zero code readers; the disk
    // trigger bytes are inert) and the bonusActions-click fallback dead-ends at
    // tempHpBuffHandler.js:49-61 ("No temp HP expression defined" — disk carries
    // buffExpression, the handler reads tempHpExpression; wiring report, not this lane).
    // major?.name mirrors the house dual-carrier idiom (restRules-celestialResilience.js:6).
    const patronNames = [computed.class?.subclass?.name, computed.class?.major?.name];
    const isFiendPatron = patronNames.includes('Fiend Patron') || patronNames.includes('Fiend');
    if (!isFiendPatron) return null;
    const rawFeatures = computed.specialActions;
    // #1188 label fixed: the read is specialActions, and that IS where the feature
    // lands (producer census): the 2024 Fiend Patron row (public/data/2024/classes.json
    // :12412-12422) carries no casting_time, so featureCategorizationUtils.js:90-97
    // routes it by name — and "Dark One's Blessing" is in NO actions/bonusActions/
    // reactions/characterAdvancement list (featureCategories.js:88/:211) → default
    // specialActions. The old 'characterAdvancement' label lied about the read.
    // fix#221 extends, never alters: specialActions stays the PRIMARY carrier —
    // every #198/#1188 byte pin stays hot; bonusActions is the 5e fallback carrier.
    if (rawFeatures == null || !Array.isArray(rawFeatures)) { console.error('[applyDamage] specialActions is not an array'); throw new Error('specialActions must be an array'); }
    const feature = rawFeatures.find(f => f.name === "Dark One's Blessing")
        || findBlessingInBonusActions(computed); // fix#221 carrier #2 (5e shape)
    if (!feature || !feature.automation) return null;
    return feature;
}

function resolveCharismaMod(computed) {
    const cha = computed.abilities?.find(a => a.name === 'Charisma');
    return cha?.bonus || 0;
}

function resolveWarlockLevel(computed) {
    // #1188 dead arms deleted (was :21-24): the old chain was
    // `find(cl => cl.level === computed.level)` then `cl ? cl.level : computed.level`.
    // PROOF OF DEADNESS: by the find predicate, whenever cl is non-null its level IS
    // computed.level, so BOTH ternary arms return numerically identical values — no
    // input shape (full 1-20 disk table HIT, sparse-slot MISS per the lane's
    // {level:3}-vs-level-5 fixture) could ever observe a difference; the lookup and
    // its throw-guard existed only to feed a discarded result. Domain intent
    // (public/data/2024/classes.json:12415): "Charisma modifier + Warlock level" —
    // the :6 subclass guard pins computed.class as a Fiend WARLOCK, and the suite is
    // single-class canonical (one computed.class row), so computed.level IS the
    // warlock level. Behavior delta for legacy saves absent class_levels: previously
    // THREW mid-kill (after HP landed, skipping outcome persist); now the blessing
    // grants correctly — strictly safer, census: no lane pinned the throw bytes.
    return computed.level;
}

function grantDarkOnesBlessing(charStats, creature, campaignName) {
    const charName = charStats.name;
    const computed = charStats?.computedStats || charStats;
    if (!computed) return;
    if (!resolveFiendBlessingFeature(computed)) return;

    const allies = getAllyList(charName);
    if (allies.includes(creature.name)) return;

    const amount = Math.max(1, resolveCharismaMod(computed) + resolveWarlockLevel(computed));
    const existingTempHp = Number(getRuntimeValue(charName, 'tempHp', campaignName) || 0);
    setRuntimeValue(charName, 'tempHp', Math.max(existingTempHp, amount), campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: charName,
        abilityName: "Dark One's Blessing",
        description: `${charName} gained ${amount} temporary hit points from Dark One's Blessing when ${creature.name} was reduced to 0 HP.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[darkOnesBlessing] Error logging:", e); });
}

export function checkDarkOnesBlessing({ characters, creature, finalDamage, wasAlive, isNowUnconscious, campaignName }) {
    // #1188 finalDamage>0 KEEP-WITH-PROOF: provably always true whenever the other
    // two operands hold — wasAlive+isNowUnconscious ⇒ damageAfterTempHp ≥ oldHp ≥ 1
    // (applyDamage.js:1065/1077-1078), and damageAfterTempHp ≤ finalDamage by the
    // monotone non-negative absorb chain (applyDamage.js:876-888, rawDamage ≥ 0 per
    // isUsableRawDamage :990-999). Kept as honest RAW expression ("reduced TO 0 HP"
    // owes damage) and defense-in-depth against future zero-damage admit gates
    // (fix#143 family); the immune-victim leg in applyDamage.darkOnesBlessing.test.js
    // is its zero-damage byte pin, not an operand falsifier (#1035).
    if (!(wasAlive && isNowUnconscious && finalDamage > 0)) return;
    for (const charStats of characters) {
        grantDarkOnesBlessing(charStats, creature, campaignName);
    }
}

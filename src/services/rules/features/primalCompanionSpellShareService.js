import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../automation/index.js';

const SPELL_SHARE_FEATURE_NAME = 'Share Spells';

// Internal-only lookup (#1396): getShareSpellsFeature/hasShareSpells were dead exports — repo-wide census
// found zero prod callers outside this file (useCustomHandlers.js and execution/index.js call ONLY the
// trigger below). The lookup contract stays smoke-tested through the trigger chokepoint.
function getShareSpellsFeature(playerStats) {
    const passives = (() => {
        // Apex guard (#204-class): `?.` on playerStats routes a nullish apex into the file's
        // OWN loud arm below — same refuse-loud posture as the #1396 unresolvable-slot
        // console.error+throw; consumers (.catch in useCustomHandlers/execution) log it.
        // Complements, never touches, the #104 self-range/cantrip/slot/alive hunks below.
        const x = playerStats?.automation?.passives;
        if (x == null) { console.error('[primalCompanionSpellShareService] Missing array:', x); throw new Error('Expected array, got ' + x); }
        return x;
    })();
    return passives.find(p => p.type === 'primal_companion_spell_share');
}

function isSelfTargetedSpell(spell) {
    // Disk canon census (#1396): the ONLY self-range token that ships is bare 'Self' —
    // public/data/spells.json 68/68 rows, public/data/2024/spells.json 94/94 rows. Zero rows carry
    // 'Self (5-foot radius)'/'Self (30-foot cone)'/'Self (60-foot cone)', so those three literals were
    // dead guards (never matched, never blocked). Exact-match the real disk bytes, lowercased; a
    // startsWith('self') widening would accept disk-zero shapes, so it is deliberately NOT used.
    return (spell.range || '').toLowerCase() === 'self';
}

function isAreaEffectCasting(metaCtx) {
    return metaCtx?.multiTarget || metaCtx?.aoeTarget;
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
        // Explicit disk cantrip (level 0 + 'Self'): Share Spells never shares cantrips.
        return null;
    }

    // Resolve the paid slot once (#1396): metaCtx.slotLevel wins; `||` (not `??`) keeps the
    // useCustomHandlers.js 'slotLevel: pending.spellLevel || 0' sentinel falling through to spell.level.
    // An unresolvable level is refused LOUDLY — no fabricated slotLevel:0 cantrip dispatch
    // (massSuggestionService.js console.error + throw idiom; every consumer .catches and logs).
    const castLevel = metaCtx?.slotLevel || spell.level;
    if (castLevel == null) {
        console.error(`[primalCompanionSpellShare] Missing spell slot level for ${spell.name}: metaCtx.slotLevel and spell.level are both absent — refusing to share.`);
        throw new Error('spell slot level is required for primal companion spell share');
    }

    if (isAreaEffectCasting(metaCtx)) {
        return null;
    }

    const companionType = getRuntimeValue(playerStats.name, 'primalCompanionType', campaignName);
    if (!companionType) {
        return null;
    }

    const companionAlive = getRuntimeValue(playerStats.name, 'primalCompanionAlive', campaignName);
    if (companionAlive !== true) {
        // Strict eligibility (#1396): 'primalCompanionAlive' is written true only at summon/restore
        // (primalCompanionHandler.js). Unknown (null/undefined) is NOT alive — refuse rather than
        // share a cast onto a possibly-dead companion.
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
        spell,
        spellSlotLevel: castLevel,
    };

    try {
        const result = await executeHandler(action, playerStats, campaignName, mapName);
        return result;
    } catch (e) {
        console.error(`[primalCompanionSpellShare] Failed to execute spell share for ${spell.name}:`, e);
        return null;
    }
}

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';
import storage from '../../ui/storage.js';

const SUMMONED_EFFECT = 'summoned';

export function isSpellSummon(creature) {
    return Boolean(creature && creature.summonSource === 'spell');
}

// SP-114: "The creature disappears when it drops to 0 Hit Points" — called by the
// damage pipeline (applyDamage) and the GM initiative-card HP setter the moment a
// spell-summoned cs combatant hits 0. Mutates combatSummary in place so the caller's
// own storage.set persists the filtered roster.
export function vanishSummonAtZeroHp(creature, combatSummary, campaignName) {
    if (!creature || !creature.summonedBy || !campaignName) return false;
    if (creature.summonSource !== 'spell') return false;

    const name = creature.name;
    const summonedBy = creature.summonedBy;

    let removed = false;
    if (combatSummary && Array.isArray(combatSummary.creatures)) {
        const idx = combatSummary.creatures.findIndex(c => c.name === name && c.summonedBy === summonedBy);
        if (idx >= 0) {
            combatSummary.creatures.splice(idx, 1);
            removed = true;
        }
    }

    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filtered = targetEffects.filter(
        te => !(te.effect === SUMMONED_EFFECT && te.target === name && te.source === summonedBy)
    );
    if (filtered.length !== targetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName);
    }

    if (removed) {
        storage.set('combatSummary', combatSummary, campaignName);
        setCombatSummaryCache(combatSummary, campaignName);
        window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        addEntry(campaignName, {
            type: 'summons',
            characterName: summonedBy,
            summonName: name,
            description: `${name} disappears at 0 Hit Points — Summon ends.`,
            summonedCreatures: [name],
            timestamp: Date.now(),
        }).catch((e) => { console.error('[summonedCreatureService:vanish-log-error]', e); });
    }
    return removed;
}

// SP-114: in-place filter for callers that persist their OWN combatSummary
// reference right after breaking concentration — without this the stale local
// roster (still containing the summons) resurrects the creatures on write-back.
export function stripSummonedFromCombatSummary(combatSummary, sourceName) {
    if (!combatSummary || !Array.isArray(combatSummary.creatures) || !sourceName) return false;
    const kept = combatSummary.creatures.filter(
        c => !(c.summonedBy === sourceName && (c.summonSource === 'spell' || c.summonSource === 'true_polymorph'))
    );
    const changed = kept.length !== combatSummary.creatures.length;
    if (changed) combatSummary.creatures = kept;
    return changed;
}

export function removeSummonedCreatures(sourceName, campaignName) {
    if (!sourceName || !campaignName) return;

    const combatSummary = getCombatSummary(campaignName);
    if (combatSummary && Array.isArray(combatSummary.creatures)) {
        const keptCreatures = combatSummary.creatures.filter(
            c => !(c.summonedBy === sourceName && (c.summonSource === 'spell' || c.summonSource === 'true_polymorph'))
        );
        if (keptCreatures.length !== combatSummary.creatures.length) {
            const updated = { ...combatSummary, creatures: keptCreatures };
            storage.set('combatSummary', updated, campaignName);
            setCombatSummaryCache(updated, campaignName);
            window.dispatchEvent(new CustomEvent('combat-summary-updated'));
        }
    }

    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filtered = targetEffects.filter(
        te => !(te.effect === SUMMONED_EFFECT && te.source === sourceName && (te.summonSource === 'spell' || te.summonSource === 'true_polymorph'))
    );
    if (filtered.length !== targetEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true);
    }
}

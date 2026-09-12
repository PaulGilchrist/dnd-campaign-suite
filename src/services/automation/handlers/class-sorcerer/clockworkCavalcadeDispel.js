import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

async function getSpellLevelByName(spellName) {
    const name = String(spellName || '').trim().toLowerCase();
    if (!name) return null;
    for (const version of ['2024', '5e']) {
        try {
            const spells = await loadSpells(version);
            const spell = spells.find(s => String(s.name || '').trim().toLowerCase() === name);
            if (spell && spell.level != null) return Number(spell.level);
        } catch (e) { console.error('[clockworkCavalcadeDispel] Error loading spells:', e); }
    }
    return null;
}

export async function resolveSpellLevel(effect) {
    if (effect?.spellLevel != null) return Number(effect.spellLevel);
    return getSpellLevelByName(effect?.spellName || effect?.name || effect?.label || effect?.condition);
}

export async function dispelSpellsOnTarget(targetName, campaignName) {
    const removed = { target: targetName, effects: [], buffs: [], conditions: [] };

    const allEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const kept = [];
    for (const te of allEffects) {
        if (te.target === targetName) {
            const level = await resolveSpellLevel(te);
            if (level != null && level <= 6) {
                removed.effects.push(te);
                continue;
            }
        }
        kept.push(te);
    }
    if (kept.length !== allEffects.length) {
        setRuntimeValue('campaign', 'targetEffects', kept, campaignName);
    }

    const buffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const keptBuffs = [];
    for (const buff of buffs) {
        const level = await getSpellLevelByName(buff?.spellName || buff?.name);
        if (level != null && level <= 6) {
            removed.buffs.push(buff);
            continue;
        }
        keptBuffs.push(buff);
    }
    if (keptBuffs.length !== buffs.length) {
        setRuntimeValue(targetName, 'activeBuffs', keptBuffs, campaignName);
    }

    const conditionKeys = new Set(
        removed.effects
            .map(te => te.condition)
            .filter(Boolean)
            .map(c => String(c).toLowerCase())
    );
    if (conditionKeys.size > 0) {
        removed.conditions = removeConditionsByKeys(targetName, campaignName, conditionKeys);
    }

    return removed;
}

function removeConditionsByKeys(targetName, campaignName, conditionKeys) {
    const conds = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const keptConds = conds.filter(c => !conditionKeys.has(String(c).toLowerCase()));
    if (keptConds.length === conds.length) return [];
    setRuntimeValue(targetName, 'activeConditions', keptConds, campaignName);
    const meta = getRuntimeValue(targetName, 'activeConditionMeta', campaignName) || {};
    const keptMeta = { ...meta };
    for (const key of conditionKeys) delete keptMeta[key];
    setRuntimeValue(targetName, 'activeConditionMeta', keptMeta, campaignName);
    return conds.filter(c => conditionKeys.has(String(c).toLowerCase()));
}

import { cloneDeep } from 'lodash';
import classRules from '../../character/classRules2024.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';

const HALF_CASTER_SLOTS = {
    1: { 1: 2 },
    2: { 1: 2 },
    3: { 1: 3 },
    4: { 1: 3 },
    5: { 1: 3 },
    6: { 1: 3 },
    7: { 1: 4, 2: 2 },
    8: { 1: 4, 2: 2 },
    9: { 1: 4, 2: 2 },
    10: { 1: 4, 2: 3 },
    11: { 1: 4, 2: 3 },
    12: { 1: 4, 2: 3 },
    13: { 1: 4, 2: 3, 3: 2 },
    14: { 1: 4, 2: 3, 3: 2 },
    15: { 1: 4, 2: 3, 3: 2 },
    16: { 1: 4, 2: 3, 3: 3 },
    17: { 1: 4, 2: 3, 3: 3 },
    18: { 1: 4, 2: 3, 3: 3 },
    19: { 1: 4, 2: 3, 3: 3 },
    20: { 1: 4, 2: 3, 3: 3, 4: 1 }
};

const SLOTLESS_CONTAINER = () => ({
    cantrips_known: 0,
    spells: [],
    spells_known: 0,
});

function addAlwaysPrepared(spellAbilities, spellName) {
    if (!spellAbilities.spells.find(s => s.name === spellName)) {
        spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
    }
}

// Player-chosen spell selections persisted to runtime state (class-feature Savants,
// Signature Spells) — always prepared unless already known.
function addRuntimeSelectionSpells(spellAbilities, playerName, runtimeKey, campaignName) {
    const selection = getRuntimeValue(playerName, runtimeKey, campaignName);
    if (!selection) return;
    const chosen = Array.isArray(selection) ? selection : [];
    for (const spellName of chosen) {
        addAlwaysPrepared(spellAbilities, spellName);
    }
}

// Free-cast spell rows granted by a passive, driven by a named spell list field
// (Phantasmal Creatures use alwaysPreparedSpells; Shadow Arts use freeCastSpells).
function addPassiveGrantedSpells(spellAbilities, playerStats, passiveType, spellsField) {
    const passive = playerStats.automation?.passives?.find(p => p.type === passiveType);
    const granted = passive?.[spellsField] || [];
    for (const spellName of granted) {
        addAlwaysPrepared(spellAbilities, spellName);
    }
}

// Compute modifier/to-hit/save DC from the current spellCastingAbility. Used for the
// initial calculation and again after lineage/feat overrides re-stamp the ability.
function computeCastingAbilityStats(spellAbilities, playerStats) {
    const abilityName = spellAbilities.spellCastingAbility?.length <= 3 ? utils.getAbilityLongName(spellAbilities.spellCastingAbility) : spellAbilities.spellCastingAbility;
    const spellAbility = playerStats.abilities.find(ability => ability.name === abilityName);
    if (!spellAbility) {
        spellAbilities.modifier = 0;
        spellAbilities.toHit = playerStats.proficiency;
        spellAbilities.saveDc = 8 + playerStats.proficiency;
    } else {
        spellAbilities.modifier = spellAbility.bonus;
        spellAbilities.toHit = spellAbility.bonus + playerStats.proficiency;
        spellAbilities.saveDc = 8 + spellAbility.bonus + playerStats.proficiency;
    }
}

// Fallback: if no spellcasting from class/major but character has spells from feats/races/etc
function buildFallbackSpellAbilities(playerStats, allSpells) {
    const highestSpellLevel = Math.max(...playerStats.spells.map(spellName => {
        const spellDetail = allSpells.find(s => s.name === spellName);
        return spellDetail ? spellDetail.level : 0;
    }));

    const spellAbilities = SLOTLESS_CONTAINER();

    const baseSlots = HALF_CASTER_SLOTS[playerStats.level] || {};
    for (const [level, count] of Object.entries(baseSlots)) {
        if (parseInt(level) <= highestSpellLevel) {
            spellAbilities[`spell_slots_level_${level}`] = count;
        }
    }

    return spellAbilities;
}

// Add subclass (major) spells as always prepared (2024 format: {name, level})
function addMajorSubclassSpells(spellAbilities, playerStats) {
    const majorName = playerStats.class.major?.name;
    const isCircleOfLand = majorName === 'Circle of the Land';
    const chosenLandType = isCircleOfLand
        ? (getRuntimeValue(playerStats.name, '_circleOfTheLandType') || '').toLowerCase()
        : null;

    playerStats.class.major.spells.forEach((subclassSpell) => {
        const spellName = subclassSpell.name || (subclassSpell.spell && subclassSpell.spell.name);
        if (!spellName) return;
        if (subclassSpell.level == null) {
            console.error('[spellCalc2024] getSpellAbilities: subclassSpell.level is missing for spell:', spellName)
            throw new Error('subclassSpell.level is required for subclass spells')
        }
        const spellLevel = subclassSpell.level

        if (isCircleOfLand) {
            if (chosenLandType && subclassSpell.landType !== chosenLandType) return;
            if (!chosenLandType) return;
        }

        if (playerStats.level >= spellLevel) {
            const knownSpell = spellAbilities.spells.find((s) => s.name === spellName);
            if (knownSpell) {
                knownSpell.prepared = 'Always';
            } else {
                spellAbilities.spells.push({
                    name: spellName,
                    prepared: 'Always'
                });
            }
        }
    });
}

// cantrip_spellcasting_ability: stamp (or introduce) a cantrip row with its own ability.
function applyCantripAbilityOverride(spellAbilities, feature) {
    const cantripEntry = spellAbilities.spells.find(s => s.name === feature.cantripName);
    if (cantripEntry) {
        if (feature.spellcastingAbility) {
            cantripEntry.spellCastingAbility = feature.spellcastingAbility;
        }
    } else if (feature.cantripName) {
        spellAbilities.spells.push({
            name: feature.cantripName,
            prepared: 'Always',
            ...(feature.spellcastingAbility ? { spellCastingAbility: feature.spellcastingAbility } : {})
        });
    }
}

// elfish_lineage / gnomish_lineage / fiendish_legacy: add the lineage's cantrip and
// level-spell grants and track them on the known counters.
function applyLineageFeatureSpells(spellAbilities, feature, playerSummary) {
    const raceName = playerSummary?.race?.name;
    const subraceName = playerSummary?.race?.subrace?.name;
    let lineageName = null;
    if (subraceName && raceName === 'Tiefling') {
        lineageName = subraceName.replace(' Tiefling', '');
    } else if (subraceName) {
        lineageName = subraceName;
    }
    if (!lineageName) return;
    const lineageData = feature.options?.find(o => o.name === lineageName);
    if (!lineageData) return;

    // Set spellcasting ability from lineage if specified
    if (lineageData.spellcastingAbility) {
        spellAbilities.spellCastingAbility = lineageData.spellcastingAbility;
    }
    // Track cantrips and level spells for counters
    let cantripCount = 0;
    let levelSpellCount = 0;

    // Add cantrip
    const cantripName = lineageData.cantrip;
    if (cantripName) {
        cantripCount++;
        addAlwaysPrepared(spellAbilities, cantripName);
    }
    // Add level 3 spell
    const level3Spell = lineageData.level3Spell;
    if (level3Spell) {
        levelSpellCount++;
        addAlwaysPrepared(spellAbilities, level3Spell);
    }
    // Add level 5 spell
    const level5Spell = lineageData.level5Spell;
    if (level5Spell) {
        levelSpellCount++;
        addAlwaysPrepared(spellAbilities, level5Spell);
    }

    spellAbilities.cantrips_known += cantripCount;
    spellAbilities.spells_known += levelSpellCount;
}

// passive_rule + always_prepared_spells: gated on the feature existing in the major's
// features or in level-gated base class features.
function applyAlwaysPreparedGrantSpells(spellAbilities, feature, playerStats) {
    const majorFeatures = playerStats.class?.major?.features || playerStats.class?.subclass?.features || [];
    const majorFeatureNames = majorFeatures.map(f => f.name);
    // CLA-392: base-class always_prepared grants (e.g. Bard lv20 Words of
    // Creation) live in class_levels[].features, never in class.major —
    // include level-gated base feature names so they auto-prepare too.
    const baseFeatureNames = (playerStats.class?.class_levels || [])
        .filter(cl => cl && cl.level <= playerStats.level)
        .flatMap(cl => (cl.features || []).map(f => f.name));
    if (!(majorFeatureNames.includes(feature.name) || baseFeatureNames.includes(feature.name))) return;

    feature.spells.forEach(spellName => {
        const knownSpell = spellAbilities.spells.find(s => s.name === spellName);
        if (!knownSpell) {
            const spellEntry = { name: spellName, prepared: 'Always' };
            // CLA-356: Telekinetic Master's always-prepared Telekinesis is a
            // slotless free cast — stamp the free-cast marker + Intelligence ability
            // so it survives the slot-level filter below on a slotless Fighter.
            if (feature.name === 'Telekinetic Master') {
                spellEntry._telekineticMasterFreeCast = true;
                spellEntry.spellCastingAbility = 'Intelligence';
            }
            spellAbilities.spells.push(spellEntry);
        } else if (feature.name === 'Telekinetic Master') {
            knownSpell._telekineticMasterFreeCast = true;
            knownSpell.spellCastingAbility = knownSpell.spellCastingAbility || 'Intelligence';
        }
    });
}

// free_spell / fey_reinforcements grants: add the granted spell rows (skip duplicates).
// CLA-356: Telekinetic Master (Psi Warrior lv18) — Telekinesis is a slotless free cast.
// The Fighter slotless fallback container only carries lv1 slots (Magic Missile), so the
// lv5 row would be silently dropped by the slot-level filter below. Stamp the free-cast
// marker + Intelligence casting ability (CLA-308 Shadow Arts carry pattern) so it survives
// and casts without a spell slot; authorization lives in spellPreparationService.
function applyFreeSpellGrant(spellAbilities, feature) {
    const spellNames = Array.isArray(feature.spell) ? feature.spell : [feature.spell];
    spellNames.forEach(spellName => {
        if (spellAbilities.spells.find(s => s.name === spellName)) return;
        const spellEntry = { name: spellName, prepared: 'Always' };
        if (feature.automation?.casting_time) {
            spellEntry.casting_time = feature.automation.casting_time;
        }
        if (feature.name === 'Telekinetic Master') {
            spellEntry._telekineticMasterFreeCast = true;
            spellEntry.spellCastingAbility = 'Intelligence';
        }
        spellAbilities.spells.push(spellEntry);
    });
}

// psionic_spells_list — CLA-272: tier-gate via major.spells[].level (char-unlock tiers
// 3/5/7/9) and skip names that fail to resolve in the spells DB, so an unresolvable or
// pre-tier spell can never render as a blank-level uncastable row.
function applyPsionicSpellsList(spellAbilities, feature, playerStats, allSpells) {
    const majorFeatures = playerStats.class?.major?.features || [];
    const majorFeatureNames = majorFeatures.map(f => f.name);
    if (!majorFeatureNames.includes(feature.name)) return;

    const tierBySpellName = new Map(
        (playerStats.class?.major?.spells || [])
            .map(s => ({ name: s.name || s.spell?.name, level: s.level }))
            .filter(s => s.name && s.level != null)
            .map(s => [s.name, s.level])
    );
    feature.psionicSpells.forEach(spellName => {
        const tier = tierBySpellName.get(spellName);
        if (tier != null && playerStats.level < tier) return;
        if (allSpells && !allSpells.find(s => s.name === spellName)) {
            console.error('[spellCalc2024] psionic_spells_list: spell name does not resolve in the spells DB, skipping:', spellName);
            return;
        }
        addAlwaysPrepared(spellAbilities, spellName);
    });
}

function applyAutomationFeature(spellAbilities, feature, playerStats, playerSummary, allSpells) {
    if (feature.type === 'cantrip_spellcasting_ability') {
        applyCantripAbilityOverride(spellAbilities, feature);
    }
    if (feature.type === 'minor_telekinesis_spell') {
        if (!spellAbilities.spells.find(s => s.name === feature.spell)) {
            spellAbilities.spells.push({
                name: feature.spell,
                prepared: 'Always',
            });
        }
    }
    if (feature.type === 'elfish_lineage' || feature.type === 'gnomish_lineage' || feature.type === 'fiendish_legacy') {
        applyLineageFeatureSpells(spellAbilities, feature, playerSummary);
    }
    if (feature.type === 'passive_rule' && feature.effect === 'always_prepared_spells' && feature.spells) {
        applyAlwaysPreparedGrantSpells(spellAbilities, feature, playerStats);
    }
    if ((feature.type === 'free_spell' || feature.type === 'fey_reinforcements') && feature.spell) {
        applyFreeSpellGrant(spellAbilities, feature);
    }
    if (feature.type === 'spell_breaker' && feature.alwaysPreparedSpells) {
        feature.alwaysPreparedSpells.forEach(spellName => addAlwaysPrepared(spellAbilities, spellName));
    }
    if (feature.type === 'psionic_spells_list' && feature.psionicSpells) {
        applyPsionicSpellsList(spellAbilities, feature, playerStats, allSpells);
    }
}

// Improved Illusions: grant Minor Illusion cantrip to Illusionist subclass (with the
// Bonus Action casting-time override when the row already exists).
function applyImprovedIllusions(spellAbilities, playerStats, allSpells) {
    const hasImprovedIllusions = playerStats.automation?.passives?.some(p => p.type === 'improved_illusions');
    if (!hasImprovedIllusions || !allSpells) return;
    const minorIllusion = spellAbilities.spells.find(s => s.name === 'Minor Illusion');
    if (!minorIllusion) {
        const minorIllusionDetail = allSpells.find(s => s.name === 'Minor Illusion');
        if (minorIllusionDetail) {
            spellAbilities.spells.push({ ...minorIllusionDetail, prepared: 'Always' });
        }
    } else if (minorIllusion.casting_time !== '1 action' && minorIllusion.casting_time !== 'Bonus Action') {
        // Override casting time to Bonus Action for Improved Illusions
        const minorIllusionDetail = allSpells.find(s => s.name === 'Minor Illusion');
        if (minorIllusionDetail) {
            const idx = spellAbilities.spells.findIndex(s => s.name === 'Minor Illusion');
            if (idx >= 0) {
                spellAbilities.spells[idx] = { ...minorIllusionDetail, prepared: 'Always', casting_time: '1 bonus action' };
            }
        }
    }
}

// Spell Thief: remove spells stolen by other characters. CLA-325: names are
// normalized (monster-card labels "3. Frost Ray" → "Frost Ray") so persisted
// entries from either era still match the rendered spell names.
function applySpellThiefLists(spellAbilities, playerName, allSpells, campaignName) {
    const casterBlockList = getRuntimeValue(playerName, '_spellThiefCasterBlock', campaignName);
    if (casterBlockList) {
        const entries = JSON.parse(casterBlockList);
        if (Array.isArray(entries) && entries.length > 0) {
            const blockedSpellNames = new Set(entries.map(e => String(e.spellName || '').replace(/^\d+\.\s*/, '').trim()).filter(Boolean));
            spellAbilities.spells = spellAbilities.spells.filter(spell => !blockedSpellNames.has(spell.name));
        }
    }

    // Spell Thief: add stolen spells from runtime state. CLA-325: inject FULL spell
    // data from allSpells (mirrors the Improved Illusions injection above) so the
    // stolen row opens a complete SpellDetailPopup and is CASTABLE, not display-only.
    // Unresolvable names (monster-only labels with no spells.json entry) stay a
    // display-only row and are flagged — no silent fallback.
    const stolenList = getRuntimeValue(playerName, '_spellThiefStolenList', campaignName);
    if (!stolenList) return;
    const entries = JSON.parse(stolenList);
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
        const rawName = entry?.spellName;
        if (!rawName) continue;
        const spellName = String(rawName).replace(/^\d+\.\s*/, '').trim();
        if (spellAbilities.spells.find(s => s.name === spellName)) continue;
        const stolenSpellDetail = allSpells ? allSpells.find(s => s.name === spellName) : null;
        if (stolenSpellDetail) {
            spellAbilities.spells.push({ ...stolenSpellDetail, prepared: 'Always' });
        } else {
            console.error(`[spellCalc2024] Spell Thief stolen spell '${spellName}' has no spells.json entry — row is display-only and cannot be cast.`);
            spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
        }
    }
}

// Ritual Adept (wizard class feature): the wizard's known ritual spells are already in their
// spell list, so do NOT inject every ritual spell in the game. FT-068 Ritual Master feat
// (chosenSpells) injects ONLY the player-chosen level 1 ritual spells, always prepared.
// Other ritual_spells features (e.g. the Ritual Caster feat) still grant the full ritual list.
function applyRitualSpellPassives(spellAbilities, playerStats, allSpells) {
    const ritualSpellsPassives = playerStats.automation.ritualSpells || [];
    if (ritualSpellsPassives.length === 0 || !allSpells) return;
    ritualSpellsPassives.forEach(ritualFeature => {
        if (ritualFeature.name === 'Ritual Adept') return;
        if (ritualFeature.chosenSpells) {
            const chosen = Array.isArray(playerStats.ritualMasterSpells) ? playerStats.ritualMasterSpells : [];
            if (chosen.length === 0) {
                console.error('[spellCalc2024] Ritual Master has no chosen ritual spells (ritualMasterSpells missing)');
            }
            chosen.forEach(spellName => addAlwaysPrepared(spellAbilities, spellName));
            return;
        }
        allSpells.forEach(spellDetail => {
            if (spellDetail.ritual && !spellAbilities.spells.find(s => s.name === spellDetail.name)) {
                spellAbilities.spells.push({ ...spellDetail, prepared: 'Always' });
            }
        });
    });
}

// CLA-234: Path of the Wild Heart — Animal Speaker (Beast Sense, Speak with Animals) and
// Nature Speaker (Commune with Nature) grant spells castable ONLY as Rituals, with Wisdom
// as the spellcasting ability ("Wisdom is your spellcasting ability for it"). Stamp the
// major's spell_casting_ability per-spell (CLA-212 carry pattern) plus _ritualOnly so the
// popup, the free-cast authorization (spellPreparationService.isFreeCastAuthorized) and
// cast resolution all honour it. Stamped BEFORE the slot-level filter so the rows survive
// even when the Barbarian slot table has no slot at this spell level.
function stampWildHeartRituals(spellAbilities, playerStats) {
    const wildHeartAbility = playerStats.class.major.spell_casting_ability;
    if (!wildHeartAbility) {
        console.error('[spellCalc2024] Path of the Wild Heart major is missing spell_casting_ability');
    }
    const wildHeartRitualFeatures = {
        'Commune with Nature': 'Nature Speaker',
        'Beast Sense': 'Animal Speaker',
        'Speak with Animals': 'Animal Speaker',
    };
    spellAbilities.spells.forEach(spell => {
        const ritualFeature = wildHeartRitualFeatures[spell.name];
        if (!ritualFeature) return;
        spell.casting_time = 'Ritual';
        spell._ritualOnly = true;
        spell._ritualFeature = ritualFeature;
        if (wildHeartAbility) {
            spell.spellCastingAbility = wildHeartAbility;
        }
    });
}

// CLA-308: Shadow Arts grants are slotless free casts (per-spell
// _Shadow_Arts_<Spell>_used counters in spellPreparationService) — stamp Wisdom as the
// casting ability (CLA-212/234 carry pattern) plus the free-cast marker so the popup,
// authorization and cast resolution honour it. Stamped BEFORE the slot-level filter below
// so the rows survive with no slot table at all.
function stampShadowArtsFreeCasts(spellAbilities, playerStats) {
    const shadowArtsPassive = playerStats.automation?.passives?.find(p => p.type === 'shadow_arts');
    if (!shadowArtsPassive) return;
    const shadowArtsAbility = shadowArtsPassive.saveAbility
        || playerStats.class?.major?.spell_casting_ability
        || playerStats.class?.spell_casting_ability;
    if (!shadowArtsAbility) {
        console.error('[spellCalc2024] Shadow Arts is missing a spellcasting ability');
    }
    const shadowArtsSpellNames = new Set(shadowArtsPassive.freeCastSpells || []);
    spellAbilities.spells.forEach(spell => {
        if (!shadowArtsSpellNames.has(spell.name)) return;
        spell._shadowArtsFreeCast = true;
        if (shadowArtsAbility) {
            spell.spellCastingAbility = shadowArtsAbility;
        }
    });
}

// FT-068: Ritual Master feat — the player-chosen level 1 ritual spells are always
// prepared and castable with spell slots, using the ability increased by the feat as
// their spellcasting ability (CLA-212/234 carry pattern). Stamp _ritualMasterRitual
// AFTER the detail remap so the flag survives; Quick Ritual (once per Long Rest,
// slot-free) is gated on this flag plus the _Ritual_Master_quickRitualUsed counter in
// spellPreparationService and is re-armed by restRules-longRest.
function stampRitualMasterRituals(spellAbilities, playerStats) {
    const ritualMasterPassive = (playerStats.automation?.ritualSpells || []).find(f => f.chosenSpells);
    if (!ritualMasterPassive) return;
    const ritualMasterAbility = ritualMasterPassive.spellCastingAbility;
    if (!ritualMasterAbility) {
        console.error('[spellCalc2024] Ritual Master is missing a spellcasting ability (featAbilityChoices unresolved)');
    }
    const ritualMasterChosen = Array.isArray(playerStats.ritualMasterSpells) ? playerStats.ritualMasterSpells : [];
    spellAbilities.spells.forEach(spell => {
        if (!ritualMasterChosen.includes(spell.name)) return;
        spell.prepared = 'Always';
        spell._ritualMasterRitual = true;
        if (ritualMasterAbility) {
            spell.spellCastingAbility = ritualMasterAbility;
        }
    });
}

// Resolve the character's spellcasting table: class_levels at the current level,
// then the highest major's table, then the major's own table — gated on required_major.
function resolveCharacterSpellcasting(playerStats) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    let spellcasting = classLevel?.spellcasting;

    if (!spellcasting) {
        spellcasting = classRules.getHighestMajorLevel(playerStats)?.spellcasting;
    }
    if (!spellcasting) {
        spellcasting = playerStats.class.major?.spellcasting;
    }
    if (!spellcasting) {
        return null;
    }

    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name;
    if (spellcasting.required_major && spellcasting.required_major !== majorName) {
        return null;
    }
    return { ...spellcasting };
}

// Divine Order: Thaumaturge (Cleric) / Primal Order: Magician (Druid) each grant one
// extra cantrip.
function applyOrderCantripGrants(spellAbilities, playerStats) {
    if (playerStats.class?.divineOrder === 'Thaumaturge' && playerStats.class?.name === 'Cleric') {
        spellAbilities = spellAbilities || {};
        spellAbilities.cantrips_known = (spellAbilities.cantrips_known || 0) + 1;
    }
    if (playerStats.class?.primalOrder === 'Magician' && playerStats.class?.name === 'Druid') {
        spellAbilities = spellAbilities || {};
        spellAbilities.cantrips_known = (spellAbilities.cantrips_known || 0) + 1;
    }
    return spellAbilities;
}

// Arcane Trickster: Mage Hand Legerdemain - adds Mage Hand to known spells and adds +3 cantrips known
function applyArcaneTricksterGrant(spellAbilities, playerStats) {
    if (playerStats.class?.major?.name !== 'Arcane Trickster') {
        return spellAbilities;
    }
    spellAbilities = spellAbilities || {};
    spellAbilities.spells = spellAbilities.spells || [];
    if (playerStats.spells) {
        const mageHandObj = { name: 'Mage Hand', prepared: '' };
        const existing = spellAbilities.spells.find(s => s.name === 'Mage Hand');
        if (!existing) {
            spellAbilities.spells.push(mageHandObj);
        }
        spellAbilities.cantrips_known += 3;
    }
    return spellAbilities;
}

// Create spellAbilities for non-spellcasting characters who gain spells from race/feat,
// Shadow Arts, or the Ritual Master feat — then the half-caster fallback.
//
// CLA-308: Shadow Arts (2024 Warrior of Shadow lv3 Monk) — slotless free casts of
// major.spells (Darkness, Darkvision, Pass Without Trace, Silence), once per Long
// Rest each. The Monk class has no spellcasting table, so spellAbilities stays null
// and the half-caster fallback below would wrongly grant lv17 slots (4×L1/3×L2/3×L3)
// if any spells were ever persisted. Create a SLOTLESS container here (lineage
// pattern above) BEFORE the fallback: no spell_slots_level_* keys, so the cast flow
// never expends slots; the free-cast gate lives in spellPreparationService.
//
// FT-068: Ritual Master feat — mirror the Shadow Arts container pattern so a holder
// with no class spellcasting table still gets the chosen ritual spell rows (castable
// slot-free via Quick Ritual; slot casting stays gated on actual slots).
function ensureSpellAbilitiesContainer(spellAbilities, playerStats, allSpells) {
    if (spellAbilities) {
        return spellAbilities;
    }

    const lineageTypes = ['elfish_lineage', 'gnomish_lineage', 'fiendish_legacy'];
    const hasLineageOrFeatSpells = playerStats.automation?.specialActions?.some(
        f => lineageTypes.includes(f.type)
    );
    if (hasLineageOrFeatSpells) {
        return SLOTLESS_CONTAINER();
    }

    const hasShadowArtsGrant = (playerStats.automation?.passives || []).some(
        f => f.type === 'shadow_arts'
    );
    if (hasShadowArtsGrant) {
        return SLOTLESS_CONTAINER();
    }

    const hasRitualMasterGrant = (playerStats.automation?.ritualSpells || []).some(
        f => f.chosenSpells
    );
    if (hasRitualMasterGrant) {
        return SLOTLESS_CONTAINER();
    }

    if (playerStats.spells && playerStats.spells.length > 0) {
        return buildFallbackSpellAbilities(playerStats, allSpells);
    }

    return null;
}

// All automation-driven spell grants: feature automation rows, runtime-chosen
// (Spell Mastery, Savants, Signature Spells), passive-granted rows, Mystic Arcanum,
// Improved Illusions, Spell Thief lists, and ritual spell passives.
function applyAutomationSpellGrants(spellAbilities, playerStats, playerSummary, allSpells) {
    const autoFeatures = [
        ...(playerStats.automation.actions || []),
        ...(playerStats.automation.bonusActions || []),
        ...(playerStats.automation.passives || []),
        ...(playerStats.automation.specialActions || []),
    ];
    autoFeatures.forEach(feature => applyAutomationFeature(spellAbilities, feature, playerStats, playerSummary, allSpells));

    // Spell Mastery: read runtime state for player-chosen spells
    const campaignName = playerSummary?.campaignName;
    const level1Spell = getRuntimeValue(playerStats.name, 'SpellMastery_level1', campaignName);
    const level2Spell = getRuntimeValue(playerStats.name, 'SpellMastery_level2', campaignName);
    if (level1Spell) addAlwaysPrepared(spellAbilities, level1Spell);
    if (level2Spell) addAlwaysPrepared(spellAbilities, level2Spell);

    // Class Savants: read runtime state for player-chosen spells of the school
    addRuntimeSelectionSpells(spellAbilities, playerStats.name, '_Abjuration_Savant_selection', campaignName);
    addRuntimeSelectionSpells(spellAbilities, playerStats.name, '_Divination_Savant_selection', campaignName);
    addRuntimeSelectionSpells(spellAbilities, playerStats.name, '_Illusion_Savant_selection', campaignName);
    addRuntimeSelectionSpells(spellAbilities, playerStats.name, '_Evocation_Savant_selection', campaignName);

    // Phantasmal Creatures: always prepare Summon Beast and Summon Fey
    addPassiveGrantedSpells(spellAbilities, playerStats, 'phantasmal_creatures', 'alwaysPreparedSpells');

    // CLA-308: Shadow Arts free-cast spells are always castable (major.spells are
    // already stamped above; this keeps the row set driven by the passive itself).
    addPassiveGrantedSpells(spellAbilities, playerStats, 'shadow_arts', 'freeCastSpells');

    // Signature Spells: read runtime state for player-chosen signature spells and always prepare them
    addRuntimeSelectionSpells(spellAbilities, playerStats.name, 'SignatureSpells_selection', campaignName);

    // Mystic Arcanum: add player-chosen Warlock arcanum spells as always prepared
    if (playerStats.class?.arcanums && Array.isArray(playerStats.class.arcanums) && allSpells) {
        playerStats.class.arcanums.forEach(spellName => {
            const spellDetail = allSpells.find(s => s.name === spellName);
            if (spellDetail && !spellAbilities.spells.find(s => s.name === spellName)) {
                spellAbilities.spells.push({ ...spellDetail, prepared: 'Always' });
            }
        });
    }

    // Improved Illusions: grant Minor Illusion cantrip to Illusionist subclass
    applyImprovedIllusions(spellAbilities, playerStats, allSpells);

    // Spell Thief: remove blocked spells and add stolen spells from runtime state
    applySpellThiefLists(spellAbilities, playerStats.name, allSpells, campaignName);

    // Ritual spell passives (Ritual Caster feat full list; Ritual Master chosen list)
    applyRitualSpellPassives(spellAbilities, playerStats, allSpells);
}

// CLA-218: Mage Hand Legerdemain (Arcane Trickster lv3 feature) —
// Mage Hand is cast as a Bonus Action and its spectral hand is Invisible.
function hasMageHandLegerdemain(playerStats) {
    return (playerStats.level || 0) >= 3
        && (playerStats.class?.major?.name === 'Arcane Trickster' || playerStats.class?.subclass?.name === 'Arcane Trickster');
}

// Remap a spell row onto its full spells-DB detail, carrying per-spell override
// stamps across so cast resolution honours them.
function remapSpellRow(spell, allSpells, mageHandLegerdemainActive) {
    const spellDetail = allSpells.find((spellDetail) => spellDetail.name === spell.name);
    if (!spellDetail) {
        return cloneDeep(spell);
    }
    const copy = cloneDeep(spellDetail);
    copy.prepared = spellDetail.level === 0 ? 'Always' : spell.prepared;
    // Carry per-spell casting-ability overrides (e.g. LightBearer CHA-for-Light)
    // across the detail remap so cast resolution honours them.
    if (spell.spellCastingAbility) {
        copy.spellCastingAbility = spell.spellCastingAbility;
    }
    // CLA-356: carry the slotless free-cast marker across the detail remap
    // so the lv5 Telekinetic Master row survives the slot-level filter below.
    if (spell._telekineticMasterFreeCast) {
        copy._telekineticMasterFreeCast = true;
    }
    if (mageHandLegerdemainActive && copy.name === 'Mage Hand') {
        // Bonus-action casting time + invisible hand markers (popup + cast path).
        copy.casting_time = 'Bonus Action';
        copy._mageHandLegerdemain = true;
        copy.description = [
            ...(Array.isArray(copy.description) ? copy.description : [copy.description]),
            '<p><em>Mage Hand Legerdemain: cast as a Bonus Action and make the spectral hand Invisible. You control it as a Bonus Action; while controlled, Dexterity (Sleight of Hand) checks through it have Advantage.</em></p>'
        ];
    }
    return copy;
}

// Slot-level row filter — cantrips, Mystic Arcanum (CLA-231), ritual-only grants
// (CLA-234), and Telekinetic Master free casts (CLA-356) are exempt; everything else
// needs a slot at or above its level.
function keepSpellRow(spell, spellAbilities, arcanumNames) {
    const spellLevel = spell.level !== undefined ? spell.level : 0;
    if (spellLevel === 0) return true;
    if (arcanumNames.has(spell.name)) return true;
    // CLA-234: ritual-only grants are castable without spell slots —
    // never drop them for lacking a slot at their level (Nature Speaker lv10
    // grants a lv5 spell while the Barbarian lv10 slot table has none).
    if (spell._ritualOnly) return true;
    // CLA-356: Telekinetic Master's Telekinesis is a slotless free cast — never
    // drop it for lacking a lv5 slot (Fighter has no spellcasting table).
    if (spell._telekineticMasterFreeCast) return true;
    let hasAnySlot = false;
    for (let i = 1; i <= 9; i++) {
        if ((spellAbilities[`spell_slots_level_${i}`] || 0) > 0) {
            hasAnySlot = true;
            break;
        }
    }
    if (!hasAnySlot) return true;
    for (let i = 9; i >= 1; i--) {
        if ((spellAbilities[`spell_slots_level_${i}`] || 0) > 0 && spellLevel <= i) {
            return true;
        }
    }
    return false;
}

export function getSpellAbilities(allSpells, playerStats, playerSummary) {
    let spellAbilities = resolveCharacterSpellcasting(playerStats);
    spellAbilities = applyOrderCantripGrants(spellAbilities, playerStats);
    spellAbilities = applyArcaneTricksterGrant(spellAbilities, playerStats);
    spellAbilities = ensureSpellAbilitiesContainer(spellAbilities, playerStats, allSpells);

    if (!spellAbilities) {
        return null;
    }

    if (playerStats.spells) {
        spellAbilities.spells = playerStats.spells.map(spell => { return { name: spell, prepared: '' } });
    } else {
        spellAbilities.spells = [];
    }

    const castingAbility = playerStats.class.spell_casting_ability
        || playerStats.class.major?.spell_casting_ability;
    if (castingAbility) {
        spellAbilities.spellCastingAbility = castingAbility;
    }

    computeCastingAbilityStats(spellAbilities, playerStats);

    // Wizards track prepared vs known (spellbook); every other 2024 class has all spells prepared.
    // Wizard spells default to prepared — the sheet can un-prepare, and unprepared rituals stay
    // castable per Ritual Adept.
    const isWizard = playerStats.class?.name === 'Wizard';
    spellAbilities.spells.forEach((spell) => {
        spell.prepared = isWizard ? 'Prepared' : 'Always';
    });

    if (playerStats.level > 2 && playerStats.class.major && playerStats.class.major.spells) {
        addMajorSubclassSpells(spellAbilities, playerStats);
    }

    if (playerStats.automation) {
        applyAutomationSpellGrants(spellAbilities, playerStats, playerSummary, allSpells);
    }

    // Recalculate spellcasting ability stats if lineage/feat set it after the initial calculation
    if (spellAbilities.spellCastingAbility) {
        computeCastingAbilityStats(spellAbilities, playerStats);
    }

    const mageHandLegerdemainActive = hasMageHandLegerdemain(playerStats);

    if (spellAbilities.spells.length > 0) {
        spellAbilities.spells = spellAbilities.spells.map(spell => remapSpellRow(spell, allSpells, mageHandLegerdemainActive));

        // CLA-234: Path of the Wild Heart ritual stamps (casting_time 'Ritual' +
        // _ritualOnly + Wisdom casting ability) happen BEFORE the slot-level filter
        // below, so the spells survive and cast slotless (see CLA-234).
        if (playerStats.class?.major?.name === 'Path of the Wild Heart') {
            stampWildHeartRituals(spellAbilities, playerStats);
        }

        // CLA-308: Shadow Arts free-cast stamps, BEFORE the slot-level filter.
        stampShadowArtsFreeCasts(spellAbilities, playerStats);

        // FT-068: Ritual Master feat stamps, AFTER the detail remap so the flag survives.
        stampRitualMasterRituals(spellAbilities, playerStats);

        // CLA-231: Mystic Arcanum spells are slotless free casts (tracked by
        // mysticArcanumLevel{6-9} counters) — exempt them from the "no spell slots
        // at this level" filter. Warlock Pact Magic slots cap at lv5, so without
        // this exemption every selected arcanum is silently dropped from the sheet.
        const arcanumNames = new Set(playerStats.class?.arcanums || []);

        spellAbilities.spells = spellAbilities.spells.filter(spell => keepSpellRow(spell, spellAbilities, arcanumNames));

        spellAbilities.spells.sort((a, b) => {
            if (a.level !== b.level) {
                return a.level - b.level;
            } else {
                return a.name.localeCompare(b.name);
            }
        });
    }

    // Path of the Wild Heart ritual overrides (casting_time 'Ritual' + _ritualOnly +
    // Wisdom casting ability) are stamped earlier in this function, BEFORE the
    // slot-level filter, so the spells survive and cast slotless (see CLA-234 block).

    // 2024 Wizards prepare a subset of their spellbook; track the limit so the sheet can toggle prepared status
    if (playerStats.class?.name === 'Wizard' && spellAbilities.prepared_spells != null) {
        spellAbilities.maxPreparedSpells = spellAbilities.prepared_spells;
    }

    return spellAbilities;
}

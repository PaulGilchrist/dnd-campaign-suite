import { cloneDeep } from 'lodash';
import classRules from '../../character/classRules.js';
import { getSpellMaxLevel } from '../../shared/spell-utils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// Half-caster spell slot table for the feat/race fallback (no class spellcasting).
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

// Stamp an existing spell row as always prepared, or push a new always-prepared row.
function stampAlwaysPrepared(spellAbilities, spellName) {
    const existing = spellAbilities.spells.find(spell => spell.name === spellName);
    if (existing) {
        existing.prepared = 'Always';
    } else {
        spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
    }
}

// Empty slotless container for race traits that introduce spellcasting.
function newSpellcastingContainer(spellCastingAbility) {
    return {
        cantrips_known: 0,
        spellCastingAbility,
        spells: [],
        spells_known: 0
    };
}

// Resolve class-level spellcasting, falling back to the highest subclass level, and
// apply the required_major/subclass gate. Returns spellcasting or null.
function resolveClassSpellcasting(playerStats) {
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    let spellcasting = classLevel?.spellcasting;
    if (!spellcasting) {
        spellcasting = classRules.getHighestSubclassLevel(playerStats)?.spellcasting;
    }
    // Check if spellcasting requires a specific major/subclass
    if (spellcasting?.required_major && spellcasting.required_major !== playerStats.class.major?.name && spellcasting.required_major !== playerStats.class.subclass?.name) {
        spellcasting = null;
    }
    return spellcasting || null;
}

// Build the prepared-spells list from playerStats.spells and apply subclass cantrip
// bonuses (Mage Hand Legerdemain, Lighting Cantrip, Acolyte of Nature).
function applyClassSpellListAndSubclassBonus(spellAbilities, playerStats) {
    if (!playerStats.spells) {
        spellAbilities.spells = [];
        return;
    }
    spellAbilities.spells = playerStats.spells.map(spell => { return { name: spell, prepared: '' }; });
    const subclassName = playerStats.class.subclass?.name;
    if (subclassName === 'Arcane Trickster') { // Mage Hand Legerdemain
        if (!spellAbilities.spells.find(s => s.name === 'Mage Hand')) {
            spellAbilities.spells.push({ name: 'Mage Hand', prepared: '' });
        }
        spellAbilities.cantrips_known += 3;
    } else if (subclassName === 'Light') { // Bonus Cantrip
        if (!spellAbilities.spells.find(s => s.name === 'Light')) {
            spellAbilities.spells.push({ name: 'Light', prepared: '' });
        }
        spellAbilities.cantrips_known += 1;
    } else if (subclassName === 'Nature') { // Acolyte of Nature
        spellAbilities.cantrips_known += 1;
    }
}

// Fallback: if no spellcasting from class/subclass but character has spells from feats/races/etc
function buildFallbackSpellAbilities(playerStats, allSpells) {
    const highestSpellLevel = Math.max(...playerStats.spells.map(spellName => {
        const spellDetail = allSpells.find(s => s.name === spellName);
        return spellDetail ? spellDetail.level : 0;
    }));

    const baseSlots = HALF_CASTER_SLOTS[playerStats.level] || {};
    const cappedSlots = {};
    for (const [level, count] of Object.entries(baseSlots)) {
        if (parseInt(level) <= highestSpellLevel) {
            cappedSlots[level] = count;
        }
    }

    const spellAbilities = {
        cantrips_known: 0,
        spells_known: 0,
        spells: [],
    };
    if (playerStats.class.spell_casting_ability) {
        spellAbilities.spellCastingAbility = playerStats.class.spell_casting_ability;
    }

    for (const [slotLevel, slotCount] of Object.entries(cappedSlots)) {
        spellAbilities[`spell_slots_level_${slotLevel}`] = slotCount;
    }
    return spellAbilities;
}

// Race traits that grant spellcasting or always-prepared spells. Returns the (possibly
// newly created) spellAbilities container.
function applyRaceSpellTraits(spellAbilities, playerStats) {
    if (playerStats.race.name === 'Tiefling') {
        if (!spellAbilities) {
            spellAbilities = newSpellcastingContainer('Charisma');
        }
        // Tieflings get the "Thaumaturgy" cantrip
        stampAlwaysPrepared(spellAbilities, 'Thaumaturgy');
        spellAbilities.cantrips_known += 1;
        // Tieflings get the hellish rebuke spell at level 3
        if (playerStats.level > 2) {
            stampAlwaysPrepared(spellAbilities, 'Hellish Rebuke');
            spellAbilities.spells_known += 1;
        }
    } else if (playerStats.race.subrace?.name === 'High Elf') {
        // High Elf gets one cantrip from the wizard spell list
        if (!spellAbilities) {
            spellAbilities = newSpellcastingContainer('Intelligence');
        }
        spellAbilities.cantrips_known += 1;
    } else if (playerStats.race.subrace?.name === 'Forest Gnome') {
        if (!spellAbilities) {
            spellAbilities = newSpellcastingContainer('Intelligence');
        }
        // Forest Gnome get the "Minor Illusion" cantrip
        stampAlwaysPrepared(spellAbilities, 'Minor Illusion');
        spellAbilities.cantrips_known += 1;
    }
    return spellAbilities;
}

// Compute modifier/to-hit/save DC from the current spellCastingAbility. Returns the
// resolved ability row (may be undefined — later class rules dereference it).
function computeCastingAbilityStats(spellAbilities, playerStats) {
    if (playerStats.class.spell_casting_ability) {
        spellAbilities.spellCastingAbility = playerStats.class.spell_casting_ability;
    }
    const spellAbility = playerStats.abilities.find(ability => ability.name === spellAbilities.spellCastingAbility);
    if (!spellAbility) {
        spellAbilities.modifier = 0;
        spellAbilities.toHit = playerStats.proficiency;
        spellAbilities.saveDc = 8 + playerStats.proficiency;
    } else {
        spellAbilities.modifier = spellAbility.bonus;
        spellAbilities.toHit = spellAbility.bonus + playerStats.proficiency;
        spellAbilities.saveDc = 8 + spellAbility.bonus + playerStats.proficiency;
    }
    return spellAbility;
}

// subclass specific adjustments
function applySubclassAdjustments(spellAbilities, playerStats) {
    if (!playerStats.class.subclass) return;
    switch (playerStats.class.subclass.name) {
        case 'Arcane Trickster':
            spellAbilities.schoolLimits = ['enchantment', 'illusion'];
            break;
        case 'Eldritch Knight':
            spellAbilities.schoolLimits = ['abjuration', 'evocation'];
            break;
        case 'Land':
            spellAbilities.cantrips_known += 1; // Bonus Cantrip
            break;
    }
}

// Druid/Paladin know every spell on their class list up to their casting level.
function addAllClassListSpells(spellAbilities, playerStats, allSpells) {
    spellAbilities.spells_known = null; // All spells known
    const spellMaxLevel = getSpellMaxLevel(spellAbilities);
    allSpells.forEach(spell => {
        if (spell.level != 0 && spell.level <= spellMaxLevel && spell.classes.includes(playerStats.class.name) && !spellAbilities.spells.find((s) => s.name === spell.name)) {
            spellAbilities.spells.push({
                name: spell.name,
                prepared: ''
            });
        }
    });
}

// Add any subclass spells to known spells and set them to always prepared
function addSubclassAlwaysPreparedSpells(spellAbilities, playerStats) {
    playerStats.class.subclass.spells.forEach((subclassSpell) => {
        const knownSpell = spellAbilities.spells.find((knownSpell) => knownSpell.name === subclassSpell.spell.name);
        if (knownSpell) {
            knownSpell.prepared = 'Always';
        } else {
            const meetsLevel = (playerStats.level >= subclassSpell.prerequisites[0].index.split('-')[1]);
            const meetsCircle = (playerStats.class.subclass.name != 'Land' || subclassSpell.prerequisites[1].name.endsWith(playerStats.class.subclass.circle));
            if (meetsLevel && meetsCircle) {
                if (spellAbilities.spells_known) spellAbilities.spells_known += 1;
                spellAbilities.spells.push({
                    name: subclassSpell.spell.name,
                    prepared: 'Always'
                });
            }
        }
    });
}

// Add always prepared spells from features (e.g., Beguiling Magic)
function addPassiveAlwaysPreparedSpells(spellAbilities, playerStats) {
    playerStats.automation.passives.forEach(passive => {
        if (passive.type !== 'passive_rule' || passive.effect !== 'always_prepared_spells' || !passive.spells) return;
        const majorFeatures = playerStats.class?.major?.features || [];
        const majorFeatureNames = majorFeatures.map(f => f.name);
        if (!majorFeatureNames.includes(passive.name)) return;
        passive.spells.forEach(spellName => {
            const knownSpell = spellAbilities.spells.find(s => s.name === spellName);
            if (knownSpell) {
                knownSpell.prepared = 'Always';
            } else {
                if (spellAbilities.spells_known) spellAbilities.spells_known += 1;
                spellAbilities.spells.push({
                    name: spellName,
                    prepared: 'Always'
                });
            }
        });
    });
}

// Add Mystic Arcanum spells (Warlock class.arcanums)
function addArcanumSpells(spellAbilities, playerStats, allSpells) {
    playerStats.class.arcanums.forEach(spellName => {
        const spellDetail = allSpells.find(s => s.name === spellName);
        const existing = spellAbilities.spells.find(s => s.name === spellName);
        if (existing) {
            existing.prepared = 'Always';
        } else if (spellDetail) {
            if (spellAbilities.spells_known) spellAbilities.spells_known += 1;
            spellAbilities.spells.push({
                ...spellDetail,
                prepared: 'Always'
            });
        }
    });
}

// Class prepared-spell limit rule; default classes have all spells prepared.
function applyClassPreparedRule(spellAbilities, playerStats, spellAbility) {
    switch (playerStats.class.name) {
        case 'Cleric':
        case 'Druid':
        case 'Wizard':
            spellAbilities.maxPreparedSpells = spellAbility.bonus + playerStats.level;
            break;
        case 'Paladin':
            spellAbilities.maxPreparedSpells = spellAbility.bonus + Math.floor(playerStats.level / 2);
            break;
        default:
            // Classes with all spells prepared = Bard, Eldritch Knight Fighter, Ranger, Arcane Trickster Rogue, Sorcerer, Warlock
            spellAbilities.spells.forEach((spell) => {
                spell.prepared = 'Always';
            });
    }
}

// Spell Thief: remove spells stolen by other characters, then add stolen spells from
// runtime state.
function applySpellThiefLists(spellAbilities, playerStats) {
    const casterBlockList = getRuntimeValue(playerStats.name, '_spellThiefCasterBlock');
    if (casterBlockList) {
        const entries = JSON.parse(casterBlockList);
        if (Array.isArray(entries) && entries.length > 0) {
            const blockedSpellNames = new Set(entries.map(e => e.spellName).filter(Boolean));
            spellAbilities.spells = spellAbilities.spells.filter(spell => !blockedSpellNames.has(spell.name));
        }
    }

    const stolenList = getRuntimeValue(playerStats.name, '_spellThiefStolenList');
    if (stolenList) {
        const entries = JSON.parse(stolenList);
        if (Array.isArray(entries)) {
            for (const entry of entries) {
                const spellName = entry?.spellName;
                if (spellName && !spellAbilities.spells.find(s => s.name === spellName)) {
                    if (spellAbilities.spells_known) spellAbilities.spells_known += 1;
                    spellAbilities.spells.push({ name: spellName, prepared: 'Always' });
                }
            }
        }
    }
}

// Expand spell rows to full spell details and sort by level then name.
function finalizeSpellList(spellAbilities, allSpells) {
    if (spellAbilities.spells.length === 0) return;
    spellAbilities.spells = spellAbilities.spells.map(spell => {
        let spellDetail = allSpells.find((spellDetail) => spellDetail.name === spell.name);
        if (spellDetail) {
            const copy = cloneDeep(spellDetail);
            copy.prepared = spellDetail.level === 0 ? 'Always' : spell.prepared;
            return copy;
        }
        return cloneDeep(spell);
    });
    // Sort by level (ascending) and then by name
    spellAbilities.spells.sort((a, b) => {
        if (a.level !== b.level) {
            return a.level - b.level;
        } else {
            return a.name.localeCompare(b.name);
        }
    });
}

// Context-dependent spell list additions: full Druid/Paladin class lists,
// subclass always-prepared spells, passive always-prepared spells, arcanums.
function addContextualSpellLists(spellAbilities, playerStats, allSpells) {
    if (playerStats.class.name === 'Druid' || playerStats.class.name === 'Paladin') {
        addAllClassListSpells(spellAbilities, playerStats, allSpells);
    }
    if (playerStats.level > 2 && playerStats.class.subclass && playerStats.class.subclass.spells) {
        addSubclassAlwaysPreparedSpells(spellAbilities, playerStats);
    }
    if (playerStats.automation?.passives) {
        addPassiveAlwaysPreparedSpells(spellAbilities, playerStats);
    }
    if (playerStats.class?.arcanums && Array.isArray(playerStats.class.arcanums) && allSpells) {
        addArcanumSpells(spellAbilities, playerStats, allSpells);
    }
}

export function getSpellAbilities(allSpells, playerStats) {
    // Dependencies: Abilities, Class
    let spellAbilities = null;
    const spellcasting = resolveClassSpellcasting(playerStats);
    if (spellcasting) {
        spellAbilities = { ...spellcasting };
    }
    if (spellAbilities) {
        applyClassSpellListAndSubclassBonus(spellAbilities, playerStats);
    }

    // Fallback: if no spellcasting from class/subclass but character has spells from feats/races/etc
    if (!spellAbilities && playerStats.spells && playerStats.spells.length > 0) {
        spellAbilities = buildFallbackSpellAbilities(playerStats, allSpells);
    }

    spellAbilities = applyRaceSpellTraits(spellAbilities, playerStats);

    if (spellAbilities) {
        const spellAbility = computeCastingAbilityStats(spellAbilities, playerStats);
        applySubclassAdjustments(spellAbilities, playerStats);
        addContextualSpellLists(spellAbilities, playerStats, allSpells);
        applyClassPreparedRule(spellAbilities, playerStats, spellAbility);
        applySpellThiefLists(spellAbilities, playerStats);
        finalizeSpellList(spellAbilities, allSpells);
    }
    return spellAbilities;
}

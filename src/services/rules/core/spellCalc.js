import { cloneDeep } from 'lodash';
import classRules from '../../character/classRules.js';
import { getSpellMaxLevel } from '../../shared/spell-utils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

export function getSpellAbilities(allSpells, playerStats) {
    // Dependencies: Abilities, Class
    let spellAbilities = null;
    const classLevel = playerStats.class?.class_levels?.[playerStats.level - 1];
    let spellcasting = classLevel?.spellcasting;
    if(!spellcasting) {
        spellcasting = classRules.getHighestSubclassLevel(playerStats)?.spellcasting;
       }
    if(spellcasting) {
           // Check if spellcasting requires a specific major/subclass
        if (spellcasting.required_major && spellcasting.required_major !== playerStats.class.major?.name && spellcasting.required_major !== playerStats.class.subclass?.name) {
            spellcasting = null;
           }
        if(spellcasting) {
            spellAbilities = {...spellcasting};
           }
       }
    if (spellAbilities) {
        if (playerStats.spells) {
            spellAbilities.spells = playerStats.spells.map(spell => {return { name: spell, prepared: ''};})
            if(playerStats.class.subclass && playerStats.class.subclass.name === 'Arcane Trickster') { // Mage Hand Legerdemain
                const mageHandObj = { name: 'Mage Hand', prepared: '' };
                const existing = spellAbilities.spells.find(s => s.name === 'Mage Hand');
                if (!existing) {
                    spellAbilities.spells.push(mageHandObj);
                }
                spellAbilities.cantrips_known += 3;                    
             } else if(playerStats.class.subclass && playerStats.class.subclass.name === 'Light') { // Bonus Cantrip
                const lightObj = { name: 'Light', prepared: '' };
                const existing = spellAbilities.spells.find(s => s.name === 'Light');
                if (!existing) {
                    spellAbilities.spells.push(lightObj);
                }
                spellAbilities.cantrips_known += 1;
             } else if(playerStats.class.subclass && playerStats.class.subclass.name === 'Nature') { // Acolyte of Nature
                spellAbilities.cantrips_known += 1;
             }
         } else {
            spellAbilities.spells = [];
         }
     }
    if (playerStats.race.name === 'Tiefling') {
        if (!spellAbilities) {
            spellAbilities = {
                cantrips_known: 0,
                spellCastingAbility: 'Charisma',
                spells: [],
                spells_known: 0
             }
         }
         // Tieflings get the "Thaumaturgy" cantrip
        const thaumaturgy = spellAbilities.spells.find(spell => spell.name === 'Thaumaturgy');
        if (thaumaturgy) {
            thaumaturgy.prepared = 'Always';
         } else {
            spellAbilities.spells.push({
                name: 'Thaumaturgy',
                prepared: 'Always'
             });
         }
        spellAbilities.cantrips_known += 1;
         // Tieflings get the hellish rebuke spell at level 3
        if (playerStats.level > 2) {
            const hellishRebuke = spellAbilities.spells.find(spell => spell.name === 'Hellish Rebuke');
            if (hellishRebuke) {
                hellishRebuke.prepared = 'Always';
             } else {
                spellAbilities.spells.push({
                    name: 'Hellish Rebuke',
                    prepared: 'Always'
                 });
             }
            spellAbilities.spells_known += 1;
         }
     } else if (playerStats.race.subrace && playerStats.race.subrace.name === 'High Elf') {
         // High Elf gets one cantrip from the wizard spell list
        if (!spellAbilities) {
            spellAbilities = {
                cantrips_known: 0,
                spellCastingAbility: 'Intelligence',
                spells: [],
                spells_known: 0
             }
         }
        spellAbilities.cantrips_known += 1;
     } else if (playerStats.race.subrace && playerStats.race.subrace.name === 'Forest Gnome') {
        if (!spellAbilities) {
            spellAbilities = {
                cantrips_known: 0,
                spellCastingAbility: 'Intelligence',
                spells: [],
                spells_known: 0
             }
         }
         // Forest Gnome get the "Minor Illusion" cantrip
        const minorIllusion = spellAbilities.spells.find(spell => spell.name === 'Minor Illusion');
        if (minorIllusion) {
            minorIllusion.prepared = 'Always';
         } else {
            spellAbilities.spells.push({
                name: 'Minor Illusion',
                prepared: 'Always'
             });
         }
        spellAbilities.cantrips_known += 1;
     }
    if (spellAbilities) {
        if (playerStats.class.spell_casting_ability) {
            spellAbilities.spellCastingAbility = playerStats.class.spell_casting_ability;
         }
        const spellAbility = playerStats.abilities.find(ability => ability.name === spellAbilities.spellCastingAbility);
        spellAbilities.modifier = spellAbility.bonus;
        spellAbilities.toHit = spellAbility.bonus + playerStats.proficiency;
        spellAbilities.saveDc = 8 + spellAbility.bonus + playerStats.proficiency;
         // subclass specific adjustments
        if(playerStats.class.subclass) {
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
        if(playerStats.class.name === 'Druid' || playerStats.class.name === 'Paladin') {
            spellAbilities.spells_known = null; // All spells known
            let spellMaxLevel = getSpellMaxLevel(spellAbilities);
            allSpells.forEach(spell => {
                if(spell.level != 0 && spell.level <= spellMaxLevel && spell.classes.includes(playerStats.class.name) && !spellAbilities.spells.find((s) => s.name === spell.name)) {
                    spellAbilities.spells.push({
                        name: spell.name,
                        prepared: ''
                     });
                 }
             });
         }
// Add any subclass spells to known spells and set them to always prepared
        if (playerStats.level > 2 && playerStats.class.subclass && playerStats.class.subclass.spells) {
            playerStats.class.subclass.spells.forEach((subclassSpell) => {
                const knownSpell = spellAbilities.spells.find((knownSpell) => knownSpell.name === subclassSpell.spell.name);
                if (knownSpell) {
                    knownSpell.prepared = 'Always';
                } else {
                    const meetsLevel = (playerStats.level >= subclassSpell.prerequisites[0].index.split('-')[1]);
                    const meetsCircle = (playerStats.class.subclass.name != 'Land' || subclassSpell.prerequisites[1].name.endsWith(playerStats.class.subclass.circle));
                    if (meetsLevel && meetsCircle) {
                        if(spellAbilities.spells_known) spellAbilities.spells_known += 1;
                        spellAbilities.spells.push({
                            name: subclassSpell.spell.name,
                            prepared: 'Always'
                        });
                    }
                }
            });
        }
        // Add always prepared spells from features (e.g., Beguiling Magic)
        if (playerStats.automation?.passives) {
            playerStats.automation.passives.forEach(passive => {
                if (passive.type === 'passive_rule' && passive.effect === 'always_prepared_spells' && passive.spells) {
                    const majorFeatures = playerStats.class?.major?.features || [];
                    const majorFeatureNames = majorFeatures.map(f => f.name);
                    if (majorFeatureNames.includes(passive.name)) {
                        passive.spells.forEach(spellName => {
                            const knownSpell = spellAbilities.spells.find(s => s.name === spellName);
                            if (knownSpell) {
                                knownSpell.prepared = 'Always';
                            } else {
                                if(spellAbilities.spells_known) spellAbilities.spells_known += 1;
                                spellAbilities.spells.push({
                                    name: spellName,
                                    prepared: 'Always'
                                });
                            }
                        });
                    }
                }
            });
        }
        // Add Mystic Arcanum spells (Warlock class.arcanums)
        if (playerStats.class?.arcanums && Array.isArray(playerStats.class.arcanums) && allSpells) {
            playerStats.class.arcanums.forEach(spellName => {
                const spellDetail = allSpells.find(s => s.name === spellName);
                const existing = spellAbilities.spells.find(s => s.name === spellName);
                if (existing) {
                    existing.prepared = 'Always';
                } else if (spellDetail) {
                    if(spellAbilities.spells_known) spellAbilities.spells_known += 1;
                    spellAbilities.spells.push({
                        ...spellDetail,
                        prepared: 'Always'
                    });
                }
            });
        }
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

           // Spell Thief: remove spells stolen by other characters
           const casterBlockList = getRuntimeValue(playerStats.name, '_spellThiefCasterBlock');
           if (casterBlockList) {
               const entries = JSON.parse(casterBlockList);
               if (Array.isArray(entries) && entries.length > 0) {
                   const blockedSpellNames = new Set(entries.map(e => e.spellName).filter(Boolean));
                   spellAbilities.spells = spellAbilities.spells.filter(spell => !blockedSpellNames.has(spell.name));
               }
           }

           // Spell Thief: add stolen spells from runtime state
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

          if (spellAbilities.spells.length > 0) {
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
     }
     return spellAbilities;
 }

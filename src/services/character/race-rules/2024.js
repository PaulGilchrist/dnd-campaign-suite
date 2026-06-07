import { cloneDeep } from 'lodash';
import * as featureCategories from '../featureCategories2024.js'
import { categorizeFeatures, mergeCategorizedFeatures } from '../featureCategorizationUtils.js'
import utils from '../../ui/utils.js';

const raceRules = {
    getImmunities: (playerSummary) => {
            // 2024 Rules: Simplified immunities based on racial traits
        let immunities = [];

            // Check traits for immunity effects
        if (playerSummary.race && playerSummary.race.traits) {
            playerSummary.race.traits.forEach(trait => {
                if (trait.description && trait.description.toLowerCase().includes('immunity')) {
                        // Extract immunity type from description
                    const match = trait.description.match(/immunity to ([^\s.]+)/i);
                    if (match) {
                        immunities.push(match[1]);
                        }
                    }
               });
            }

        if(playerSummary.immunities) {
            immunities = [...new Set([...immunities, ...playerSummary.immunities])];
            }

        return immunities.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
         },
    getRace: (allRaces, playerSummary) => {
        const race = cloneDeep(allRaces.find((race) => race.name === playerSummary.race.name));

                 // Handle case where race is not found in allRaces
            if (!race) {
                return playerSummary.race;
                 }

                 // Merge with player summary data
            if (playerSummary.race) {
                Object.assign(race, playerSummary.race);
                 }

            // Resolve subrace from JSON data to get full subrace fields (e.g. damage_resistance)
            if (race.subraces && playerSummary.race && playerSummary.race.subrace) {
                const foundSubrace = race.subraces.find((sr) => sr.name === playerSummary.race.subrace.name);
                if (foundSubrace) {
                    race.subrace = Object.assign(cloneDeep(foundSubrace), playerSummary.race.subrace);
                }
            }

            // 2024: Handle lineage selection if present
        if (playerSummary.race.lineage) {
            const lineage = playerSummary.race.lineage;
                // Apply lineage-specific traits
            if (race.traits) {
                race.traits.forEach(trait => {
                    if (trait.sub_traits) {
                        const selectedLineage = trait.sub_traits.find(st => st.name === lineage);
                        if (selectedLineage) {
                            trait.selectedLineage = selectedLineage;
                            }
                        }
                    });
                }
            }

            // Convert ability names if present
        if (race.ability_bonuses) {
                        race.ability_bonuses = race.ability_bonuses.map((ability_bonus) => {
                ability_bonus.ability_score = utils.getAbilityLongName(ability_bonus.ability_score);
                return ability_bonus;
               });
            }

        return race;
         },
     getRacialBonus: () => {
            // 2024 Rules: No racial ability score bonuses
            // This is a placeholder for future implementation if needed
        return 0;
         },
    getResistances: (playerSummary) => {
            // 2024 Rules: Extract resistances from racial traits
        let resistances = [];

        if (playerSummary.race && playerSummary.race.subrace && playerSummary.race.subrace.damage_resistance) {
            resistances.push(playerSummary.race.subrace.damage_resistance);
        }

        if (playerSummary.race && playerSummary.race.traits) {
            playerSummary.race.traits.forEach(trait => {
                if (trait.description) {
                    const resistanceMatch = trait.description.match(/Resistance to ([^\s.]+)/i);
                    if (resistanceMatch && resistanceMatch[1].toLowerCase() !== 'the') {
                        resistances.push(resistanceMatch[1]);
                    }
                }
           });
        }

        if(playerSummary.resistances) {
            resistances = [...new Set([...resistances, ...playerSummary.resistances])];
        }

        return resistances.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
         },
    getSenses: (playerStats) => {
            // 2024 Rules: Extract senses from racial traits
        const senses = playerStats.senses ? [...playerStats.senses] : [];

        if (playerStats.race && playerStats.race.traits) {
            playerStats.race.traits.forEach(trait => {
                if (trait.description) {
                        // Check for darkvision
                    if (trait.description.toLowerCase().includes('darkvision')) {
                        const darkvisionMatch = trait.description.match(/darkvision with a range of (\d+) feet/i);
                        if (darkvisionMatch) {
                            const range = `${darkvisionMatch[1]} ft.`;
                            if (!senses.some((sense) => sense.name === 'Darkvision')) {
                                senses.push({ name: 'Darkvision', value: range });
                                }
                            }
                        }

                        // Check for tremorsense
                    if (trait.description.toLowerCase().includes('tremorsense')) {
                        const tremorsenseMatch = trait.description.match(/tremorsense with a range of (\d+) feet/i);
                        if (tremorsenseMatch) {
                            const range = `${tremorsenseMatch[1]} ft.`;
                            if (!senses.some((sense) => sense.name === 'Tremorsense')) {
                                senses.push({ name: 'Tremorsense', value: range });
                                }
                            }
                        }
                    }
               });
            }

        // Passive skills
        const getPassiveScore = (abilityName, skillName) => {
            const ability = playerStats.abilities?.find(a => a.name === abilityName);
            if (!ability) return null;
            const skill = ability.skills?.find(s => s.name === skillName);
            const base = 10 + (ability.bonus || 0);
            if (!skill) return base;
            return 10 + (skill.bonus || 0);
        };
        const passPer = getPassiveScore('Wisdom', 'Perception');
        if (passPer !== null) senses.push({ name: 'Passive Perception', value: String(passPer) });
        const passInv = getPassiveScore('Intelligence', 'Investigation');
        if (passInv !== null) senses.push({ name: 'Passive Investigation', value: String(passInv) });
        const passIns = getPassiveScore('Wisdom', 'Insight');
        if (passIns !== null) senses.push({ name: 'Passive Insight', value: String(passIns) });
        return senses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
         },
        addTraits: (traits) => {
        return categorizeFeatures(traits, featureCategories, { descriptionField: 'description' });
          },
        getTraits: (playerStats) => {
             // 2024 Rules: Process racial traits including lineages
        let traits = raceRules.addTraits(playerStats.race?.traits);

            // Handle lineage-specific traits
        if (playerStats.race?.lineage && playerStats.race.traits) {
            const lineageTraits = [];
            playerStats.race.traits.forEach(trait => {
                if (trait.sub_traits) {
                    const selectedLineage = trait.sub_traits.find(st => st.name === playerStats.race.lineage);
                    if (selectedLineage) {
                        lineageTraits.push({
                            name: `${trait.name} (${selectedLineage.name})`,
                            description: selectedLineage.description,
                            details: null
                         });
                     }
                 }
             });

            if (lineageTraits.length > 0) {
                const categorizedLineageTraits = raceRules.addTraits(lineageTraits);
                traits = mergeCategorizedFeatures(traits, categorizedLineageTraits);
             }
        }

        return traits;
         }
};

export default raceRules;

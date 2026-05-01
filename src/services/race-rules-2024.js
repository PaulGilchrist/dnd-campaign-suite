import { cloneDeep, uniqBy } from 'lodash';
import { featuresToIgnore, actions, bonusActions, reactions, characterAdvancement } from './feature-categories-2024'
import utils from './utils.js';

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
    getRacialBonus: (playerStats, abilityName) => {
            // 2024 Rules: No racial ability score bonuses
            // This is a placeholder for future implementation if needed
        return 0;
         },
    getResistances: (playerSummary) => {
            // 2024 Rules: Extract resistances from racial traits
        let resistances = [];

        if (playerSummary.race && playerSummary.race.traits) {
            playerSummary.race.traits.forEach(trait => {
                if (trait.description) {
                        // Look for resistance patterns in description
                    const resistanceMatch = trait.description.match(/Resistance to ([^\s.]+)/i);
                    if (resistanceMatch) {
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

        return senses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
         },
    addTraits: (traits) => {
        const categorizedTraits = {
            actions: [],
            bonusActions: [],
            reactions: [],
            specialActions: [],
            characterAdvancement: []
            };

        if(traits) {
            traits.forEach(trait => {
                const traitSummary = {
                    name: trait.name,
                    description: trait.description,
                    details: trait.details || null
                    };

                if(featuresToIgnore.includes(trait.name)) {
                       // Do nothing - this trait is ignored entirely
                    } else if(characterAdvancement.includes(trait.name) && !categorizedTraits.characterAdvancement.some(f => f.name === trait.name)) {
                    categorizedTraits.characterAdvancement.push(traitSummary);
                    } else if(actions.includes(trait.name) && !categorizedTraits.actions.some(action => action.name === trait.name)) {
                    categorizedTraits.actions.push(traitSummary);
                    } else if(bonusActions.includes(trait.name) && !categorizedTraits.bonusActions.some(bonusAction => bonusAction.name === trait.name)) {
                    categorizedTraits.bonusActions.push(traitSummary);
                    } else if(reactions.includes(trait.name) && !categorizedTraits.reactions.some(reaction => reaction.name === trait.name)) {
                    categorizedTraits.reactions.push(traitSummary);
                    } else if(!categorizedTraits.specialActions.some(specialAction => specialAction.name === trait.name)) {
                    categorizedTraits.specialActions.push(traitSummary);
                    }
               });
            }

        return categorizedTraits;
         },
    getTraits: (playerStats) => {
            // 2024 Rules: Process racial traits including lineages
        let traits = raceRules.addTraits(playerStats.race?.traits);

            // Handle lineage-specific traits
        if (playerStats.race?.lineage && playerStats.race.traits) {
            playerStats.race.traits.forEach(trait => {
                if (trait.sub_traits) {
                    const selectedLineage = trait.sub_traits.find(st => st.name === playerStats.race.lineage);
                    if (selectedLineage) {
                        const lineageTrait = {
                            name: `${trait.name} (${selectedLineage.name})`,
                            description: selectedLineage.description,
                            details: null
                            };

                            // Categorize lineage trait
                        if (!raceRules.addTraits([lineageTrait]).specialActions.some(action => action.name === lineageTrait.name)) {
                            traits.specialActions.push(lineageTrait);
                            }
                        }
                    }
               });
            }

        return traits;
         }
};

export default raceRules;
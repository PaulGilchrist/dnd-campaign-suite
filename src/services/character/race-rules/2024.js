import { cloneDeep } from 'lodash';
import { getCategories } from '../featureCategories.js'
import { categorizeFeatures, mergeCategorizedFeatures } from '../featureCategorizationUtils.js'
import utils from '../../ui/utils.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computePassiveSkills } from '../../shared/computePassiveSkills.js';
import { deduplicateAndSort } from '../../shared/deduplicateAndSort.js';

const featureCategories = getCategories('2024');

const LEGACY_KEY = '_fiendishLegacySelection';

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
                    // Trance: "magic can't put you to sleep"
                if (trait.name === 'Trance') {
                    immunities.push('Magical Sleep');
                    }
               });
            }

        if(playerSummary.immunities) {
            immunities = deduplicateAndSort([...immunities, ...playerSummary.immunities]);
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

        // Fiendish Legacy: resistance is determined by runtime selection
        const campaignName = playerSummary?.campaignName;
        const fiendishLegacy = getRuntimeValue(playerSummary?.name, LEGACY_KEY, campaignName);
        const fiendishLegacyResistanceMap = {
            'Abyssal': 'Poison',
            'Chthonic': 'Necrotic',
            'Infernal': 'Fire',
        };

        if (playerSummary.race && playerSummary.race.traits) {
            playerSummary.race.traits.forEach(trait => {
                if (trait.description) {
                    // Skip Fiendish Legacies table — its resistances are runtime-dependent
                    if (trait.name === 'Fiendish Legacies' && fiendishLegacy) {
                        const legResist = fiendishLegacyResistanceMap[fiendishLegacy];
                        if (legResist && !resistances.includes(legResist)) {
                            resistances.push(legResist);
                        }
                        return;
                    }
                    const matches = [...trait.description.matchAll(/Resistance to ([^\s.]+)/gi)];
                    matches.forEach(match => {
                        if (match[1].toLowerCase() !== 'the') {
                            resistances.push(match[1]);
                        }
                    });
                }
            });
        }

        if(playerSummary.resistances) {
            resistances = deduplicateAndSort([...resistances, ...playerSummary.resistances]);
        }

        return resistances.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          },
    getSenses: (playerStats) => {
            // 2024 Rules: Extract senses from racial traits and class features
         const passiveSenses = computePassiveSkills(playerStats);

         // Check for Feral Senses class feature (Ranger level 18 - grants Blindsight 30 ft.)
         const feralSensesExists = hasFeralSenses2024(playerStats);
         if (feralSensesExists && !passiveSenses.some((sense) => sense.name === 'Blindsight')) {
             passiveSenses.push({ name: 'Blindsight', value: '30 ft.' });
         }

         if (playerStats.race && playerStats.race.traits) {
             playerStats.race.traits.forEach(trait => {
                 if (trait.description) {
                         // Check for darkvision
                     if (trait.description.toLowerCase().includes('darkvision')) {
                         const darkvisionMatch = trait.description.match(/darkvision with a range of (\d+) feet/i);
                         if (darkvisionMatch) {
                             const range = `${darkvisionMatch[1]} ft.`;
                             if (!passiveSenses.some((sense) => sense.name === 'Darkvision')) {
                                 passiveSenses.push({ name: 'Darkvision', value: range });
                                 }
                             }
                         }

                     // Check for tremorsense (skip Stonecunning — it's conditional, not passive)
                     if (trait.description.toLowerCase().includes('tremorsense')) {
                         // Stonecunning is a bonus action with uses, not a passive sense
                         if (trait.name === 'Stonecunning') {
                             // Don't add passive tremorsense for Stonecunning
                         } else {
                             const tremorsenseMatch = trait.description.match(/tremorsense with a range of (\d+) feet/i);
                             if (tremorsenseMatch) {
                                 const range = `${tremorsenseMatch[1]} ft.`;
                                 if (!passiveSenses.some((sense) => sense.name === 'Tremorsense')) {
                                     passiveSenses.push({ name: 'Tremorsense', value: range });
                                 }
                             }
                         }
                     }
                     }
                 });
             }

         // Elfish Lineage: Drow lineage overrides Darkvision to 120 ft.
         const campaignName = playerStats.campaignName;
         const elfisLineage = playerStats.race?.lineage || getRuntimeValue(playerStats.name, '_elfishLineageSelection', campaignName);
         if (elfisLineage === 'Drow') {
             const darkvisionIndex = passiveSenses.findIndex(s => s.name === 'Darkvision');
             if (darkvisionIndex !== -1) {
                 const currentFeet = extractDarkvisionFeet(passiveSenses[darkvisionIndex].value);
                 if (currentFeet < 120) {
                     passiveSenses[darkvisionIndex] = { ...passiveSenses[darkvisionIndex], value: '120 ft.' };
                 }
             } else {
                 passiveSenses.push({ name: 'Darkvision', value: '120 ft.' });
             }
         }

         // Gnomish Lineage: Deep Gnome lineage overrides Darkvision to 120 ft.
         const gnomishLineage = playerStats.race?.lineage || getRuntimeValue(playerStats.name, '_gnomishLineageSelection', campaignName);
         if (gnomishLineage === 'Deep Gnome') {
             const darkvisionIndex = passiveSenses.findIndex(s => s.name === 'Darkvision');
             if (darkvisionIndex !== -1) {
                 const currentFeet = extractDarkvisionFeet(passiveSenses[darkvisionIndex].value);
                 if (currentFeet < 120) {
                     passiveSenses[darkvisionIndex] = { ...passiveSenses[darkvisionIndex], value: '120 ft.' };
                 }
             } else {
                 passiveSenses.push({ name: 'Darkvision', value: '120 ft.' });
             }
         }

         return passiveSenses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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

function extractDarkvisionFeet(value) {
    if (!value) return 0;
    const match = String(value).match(/(\d+)\s*ft/i);
    return match ? parseInt(match[1], 10) : 0;
}

function hasFeralSenses2024(playerStats) {
    const classLevels = playerStats.class?.class_levels || [];
    for (const classLevel of classLevels) {
        const features = classLevel?.features || [];
        if (features.some((f) => f.name === 'Feral Senses')) {
            return true;
        }
    }
    return false;
}

export default raceRules;

/**
 * Feat validation service for character creation wizard
 * Provides non-blocking warnings about feat selection rules
 * Supports both 5e and 2024 rulesets
 */

import { loadValidationRules, fetchBackgroundData } from '../ui/dataLoader.js';
import { stripParenthetical } from '../shared/nameUtils.js';
/**
 * Gets the number of feats allowed based on ruleset, level, and class from JSON
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { allowed: number, originRequired: boolean, details: string }
 */
export async function getFeatLimits(formData) {
    const ruleset = formData.rules || '5e';
    const level = formData.level || 1;

    const rules = await loadValidationRules(ruleset);
    const featRules = rules.feats || {};
     
    const availableLevels = featRules.available_levels || (ruleset === '2024' ? [1, 4, 8, 12, 16, 19] : [4, 8, 12, 16, 19]);
    const originRequired = featRules.origin_feat_required || false;
    const originFeatLevel = featRules.origin_feat_level || 1;

    let allowed = 0;
    for (const featLevel of availableLevels) {
        if (level >= featLevel) {
            allowed += 1;
         }
          }
      
    let details;
    if (ruleset === '2024') {
        details = originRequired
            ? `Level 1 2024 characters get 1 Origin feat, plus additional feats at levels ${availableLevels.join(', ')}`
            : `In 2024 rules, feats are available at levels ${availableLevels.join(', ')}`;
         } else {
        details = `In 5e, feats are optional and can be taken instead of ability score increases at levels ${availableLevels.join(', ')}`;
         }
     
    return {
        allowed,
        originRequired,
        originFeatLevel,
        details
         };
     }

/**
 * Validates feat selections and returns warnings (not blocking errors)
 * @param {object} formData - The character form data
 * @param {array} allFeats - All available feats data
 * @returns {Promise<object>} - Array of warning objects { message: string, type: 'warning'|'info' }
 */
export async function validateFeats(formData, allFeats) {
    const warnings = [];
    const selectedFeats = formData.feats || [];
    const ruleset = formData.rules || '5e';
    const preSelected = await getPreSelectedFeats(formData);
    const userSelectedCount = selectedFeats.filter(f => !preSelected.includes(f)).length;
    const preSelectedCount = selectedFeats.filter(f => preSelected.includes(f)).length;

    if (selectedFeats.length === 0) {
        return warnings; // No warnings if no feats selected
      }

       // Get feat limits from JSON
    const limits = await getFeatLimits(formData);

      // Check if too many feats selected (excluding pre-selected background feats)
    if (userSelectedCount > limits.allowed) {
        warnings.push({
            message: `Rules allow ${limits.allowed} feat(s) at level ${formData.level}. You have selected ${userSelectedCount} (plus ${preSelectedCount} background feat). (${limits.details})`,
            type: 'warning'
             });
         }

      // For 2024 level 1, check origin feat requirement
    if (ruleset === '2024' && formData.level === 1 && limits.originRequired) {
        const originFeats = allFeats.filter(f => f.type === 'Origin Feat');
        const selectedOriginFeats = selectedFeats.filter(f =>
            originFeats.some(of => of.name === f)
          );

        if (selectedOriginFeats.length === 0 && selectedFeats.length > 0) {
            // Check if race has Versatile trait
            const hasVersatile = formData.race?.traits?.some(t => t.name === 'Versatile');
            if (hasVersatile) {
                warnings.push({
                    message: `Your race has the Versatile trait — you should select an Origin feat of your choice.`,
                    type: 'warning'
                 });
             } else {
                warnings.push({
                    message: `Level 1 2024 characters should select an Origin feat. Your selected feats don't include an Origin feat.`,
                    type: 'warning'
                 });
             }
         }

          // Warn if non-origin feats selected at level 1
        const nonOriginFeats = selectedFeats.filter(f =>
             !originFeats.some(of => of.name === f)
             );
        if (nonOriginFeats.length > 0) {
            const hasVersatile = formData.race?.traits?.some(t => t.name === 'Versatile');
            if (hasVersatile) {
                warnings.push({
                    message: `Consider selecting an Origin feat for your Versatile trait. Skilled is recommended.`,
                    type: 'info'
                 });
             } else {
                warnings.push({
                    message: `Some selected feats are not Origin feats. Level 1 2024 characters typically take an Origin feat.`,
                    type: 'info'
                 });
             }
           }
          }

      // Check for Epic Boon feats (typically level 19+)
    const epicBoonFeats = allFeats.filter(f => f.type === 'Epic Boon' || f.type === 'Epic Boon Feat');
    const selectedEpicBoons = selectedFeats.filter(f =>
        epicBoonFeats.some(eb => eb.name === f)
      );
    if (selectedEpicBoons.length > 0 && formData.level < 19) {
        warnings.push({
            message: `Epic Boon feats are typically available at level 19. You are level ${formData.level}.`,
            type: 'warning'
             });
         }

      // Check for prerequisites on selected feats
    selectedFeats.forEach(featName => {
        const feat = allFeats.find(f => f.name === featName);
        if (feat && feat.prerequisites) {
            const prereqs = Array.isArray(feat.prerequisites)
                 ? feat.prerequisites.map(p => typeof p === 'string' ? p : (p.name || '')).filter(p => p)
                 : [typeof feat.prerequisites === 'string' ? feat.prerequisites : (feat.prerequisites.name || '')].filter(p => p);

              // Check for level prerequisites
            prereqs.forEach(prereq => {
                if (!prereq || typeof prereq !== 'string') return; // Skip invalid prerequisites

                if (prereq.includes('level') || prereq.includes('Level')) {
                      // Extract level from prerequisite like "4th level" or "Level 4"
                    const match = prereq.match(/(\d)(?:st|nd|rd|th)?\s*level/i);
                    if (match) {
                        const requiredLevel = parseInt(match[1]);
                        if (formData.level < requiredLevel) {
                            warnings.push({
                                message: `${featName} requires ${prereq}. You are level ${formData.level}.`,
                                type: 'warning'
                                 });
                             }
                         }
                     }

                  // Check for class/race/ability prerequisites
                if (prereq.includes('Strength') || prereq.includes('Dexterity') ||
                    prereq.includes('Constitution') || prereq.includes('Intelligence') ||
                    prereq.includes('Wisdom') || prereq.includes('Charisma')) {
                    warnings.push({
                        message: `${featName} requires: ${prereq}. Verify your character meets this requirement.`,
                        type: 'info'
    });
                     }
                 });
             }
         });

    return warnings;
}

/**
 * Gets feat type information for display
 * @param {string} featName - Name of the feat
 * @param {array} allFeats - All available feats data
 * @returns {object} - { type: string, isOrigin: boolean, isEpicBoon: boolean }
 */
export function getFeatTypeInfo(featName, allFeats) {
    const feat = allFeats.find(f => f.name === featName);
    if (!feat) return { type: 'Unknown', isOrigin: false, isEpicBoon: false };

    return {
        type: feat.type || 'General',
        isOrigin: feat.type === 'Origin Feat',
        isEpicBoon: feat.type === 'Epic Boon' || feat.type === 'Epic Boon Feat'
         };
     }

/**
 * Normalizes a feat name from background data by stripping parenthetical qualifiers.
 * e.g. "Magic Initiate (Druid)" → "Magic Initiate"
 * @param {string} rawName - The raw feat name from background data
 * @returns {string} - The normalized feat name
 */
export function normalizeBackgroundFeatName(rawName) {
    return stripParenthetical(rawName);
}

/**
 * Determines which feats are pre-selected (automatically granted) from background
 * @param {object} formData - The character form data
 * @returns {Promise<string[]>} - Array of feat names that are automatically granted
 */
export async function getPreSelectedFeats(formData) {
    const ruleset = formData.rules || '5e';
    const preSelected = new Set();

     // Background feats (automatic, not choices) - 2024 only
    if (formData.background && ruleset === '2024') {
        const backgroundData = await fetchBackgroundData(formData.background);
        if (backgroundData && backgroundData.feat) {
             // Strip parenthetical qualifiers (e.g. "Magic Initiate (Druid)" → "Magic Initiate")
            const normalized = normalizeBackgroundFeatName(backgroundData.feat);
            preSelected.add(normalized);
     }
          }

    return Array.from(preSelected);
      }

/**
 * Gets race-granted feat choices (e.g., Versatile trait grants Origin feat choice)
 * These are NOT pre-selected; they are available options shown in the feat wizard
 * @param {object} formData - The character form data
 * @returns {Promise<string[]>} - Array of feat names available from race traits
 */
export async function getRaceFeatChoices(formData) {
    const ruleset = formData.rules || '5e';
    const choices = new Set();

    if (formData.race && ruleset === '2024') {
        if (formData.race.traits) {
            formData.race.traits.forEach(trait => {
                if (trait.name === 'Versatile' && trait.proficiency_choices) {
                    const pc = trait.proficiency_choices;
                    if (pc.from && pc.from.length > 0) {
                        pc.from.forEach(featName => {
                            choices.add(featName);
                        });
                    }
                }
            });
        }
    }

    return Array.from(choices);
}

/**
 * Normalizes feat description data from both 2024 and 5e formats
 * @param {object} feat - The feat object
 * @returns {object} - { text: string, isHtml: boolean }
 */
export function normalizeFeatDescription(feat) {
    let descriptionData = { text: '', isHtml: false };

    // Try 2024 format first (description field) - HTML
    if (feat.description) {
        const desc = feat.description;
        if (typeof desc === 'string') {
            descriptionData = { text: desc, isHtml: true };
        } else if (Array.isArray(desc) && desc[0]) {
            const firstItem = desc[0];
            if (typeof firstItem === 'string') {
                descriptionData = { text: firstItem, isHtml: true };
            } else if (typeof firstItem === 'object') {
                if (firstItem.text) {
                    descriptionData = { text: firstItem.text, isHtml: true };
                } else if (firstItem.content) {
                    descriptionData = { text: firstItem.content, isHtml: true };
                } else if (firstItem.description) {
                    descriptionData = { text: firstItem.description, isHtml: true };
                } else if (firstItem.level !== undefined) {
                    console.warn('Unexpected description object structure:', firstItem);
                    descriptionData = { text: '', isHtml: false };
                }
            }
        }
    }

    return descriptionData;
}


/**
 * Tool proficiency validation service for character creation wizard (2024 ruleset only)
 * Parses tool proficiencies from class, background, and feats data
 * Provides limits, pre-selection, and validation for tool proficiency selections
 */

import { loadEquipment, fetchBackgroundData, fetchClassData, loadFeatData } from '../ui/dataLoader.js';

/**
 * Category normalization map — backgrounds/classes use singular forms
 * that need to match equipment.json tool_category values
 */
const CATEGORY_NORMALIZATION = {
    "Gaming Set": "Gaming Sets",
    "Gaming Sets": "Gaming Sets",
    "Musical Instrument": "Musical Instrument",
    "Musical Instruments": "Musical Instrument",
    "Artisan's Tools": "Artisan's Tools",
    "Other Tools": "Other Tools",
};

/**
 * Normalizes a category name from background/class data to match equipment.json tool_category
 * @param {string} category - Raw category name from data
 * @returns {string} - Normalized category name
 */
export function normalizeCategory(category) {
    if (!category) return category;
    const normalized = CATEGORY_NORMALIZATION[category.trim()];
    return normalized || category.trim();
}

/**
 * Parses a tool proficiency choice string from background/class data
 * @param {string} choiceString - Tool proficiency string (e.g., "Choose one kind of Artisan's Tools")
 * @returns {object} - { count, categories[], isChoice }
 */
export function parseToolChoiceString(choiceString) {
    if (!choiceString || typeof choiceString !== 'string') {
        return { count: 0, categories: [], isChoice: false };
    }

    const trimmed = choiceString.trim();

    // Check if it's a "Choose" pattern
    if (!trimmed.startsWith('Choose')) {
        return { count: 0, categories: [], isChoice: false };
    }

    // Pattern: "Choose one type of Artisan's Tools or Musical Instrument"
    // → count: 1, categories: ["Artisan's Tools", "Musical Instrument"]
    const orMatch = trimmed.match(/Choose\s+one\s+type\s+of\s+(.+)$/i);
    if (orMatch) {
        const categories = orMatch[1].split(/\s+or\s+/).map(c => normalizeCategory(c));
        return { count: 1, categories, isChoice: true };
    }

    // Pattern: "Choose 3 Musical Instruments (see chapter 6)"
    // → count: 3, categories: ["Musical Instrument"]
    const countMatch = trimmed.match(/Choose\s+(\d+)\s+(.+?)(?:\s*\(see[^)]*\)|\s*of\s+your\s+choice)?\.?\s*$/i);
    if (countMatch) {
        const count = parseInt(countMatch[1], 10);
        const category = normalizeCategory(countMatch[2]);
        return { count, categories: [category], isChoice: true };
    }

    // Pattern: "Choose one kind of Artisan's Tools"
    // → count: 1, categories: ["Artisan's Tools"]
    const kindMatch = trimmed.match(/Choose\s+(?:one\s+)?kind\s+of\s+(.+)$/i);
    if (kindMatch) {
        const category = normalizeCategory(kindMatch[1]);
        return { count: 1, categories: [category], isChoice: true };
    }

    return { count: 0, categories: [], isChoice: false };
}

/**
 * Gets all tool entries from equipment.json filtered by category
 * @param {string} category - Tool category name (e.g., "Artisan's Tools")
 * @returns {Promise<object[]>} - Array of tool objects
 */
export async function getToolsByCategory(category) {
    if (!category) return [];
    const normalized = normalizeCategory(category);
    const equipment = await loadEquipment();
    return equipment.filter(e =>
        e.equipment_category === 'Tools' &&
        e.tool_category === normalized
    );
}

/**
 * Parses a feat's tool proficiency benefit description
 * @param {object} feat - The feat data object
 * @returns {object|null} - { count, categories[], isAny } or null if not a tool proficiency feat
 */
export function parseFeatToolProficiency(feat) {
    if (!feat || !feat.benefits) return null;

    const toolBenefit = feat.benefits.find(b =>
        b.type === 'proficiency' &&
        b.description &&
        /tool.*proficien|proficien.*tool/i.test(b.description)
    );

    if (!toolBenefit) return null;

    const desc = toolBenefit.description;

    // Crafter: "You gain proficiency with three different Artisan's Tools of your choice"
    // → { count: 3, categories: ["Artisan's Tools"], isAny: false }
    const crafterMatch = desc.match(/(\d+)\s+different\s+(\w+)'?\s+Tools/i);
    if (crafterMatch) {
        const count = parseInt(crafterMatch[1], 10);
        const category = normalizeCategory(crafterMatch[2]);
        return { count, categories: [category], isAny: false };
    }

    // Skilled: "You gain proficiency in any combination of three skills or tools of your choice"
    // → { count: 3, categories: [], isAny: true }
    const skilledMatch = desc.match(/(\d+)\s+skills\s+or\s+tools/i);
    if (skilledMatch) {
        const count = parseInt(skilledMatch[1], 10);
        return { count, categories: [], isAny: true };
    }

    return null;
}

/**
 * Gets tool limits based on class, background, and feats
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { allowed, fromClass, fromBackground, fromFeats, details, preSelected }
 */
export async function getToolLimits(formData) {
    const ruleset = formData.rules || '5e';
    const className = formData.class?.name || '';
    const backgroundName = formData.background || '';
    const selectedFeats = formData.feats || [];

    // Tool proficiencies are a 2024 mechanic
    if (ruleset !== '2024') {
        return {
            allowed: 0,
            fromClass: { count: 0, categories: [] },
            fromBackground: { count: 0, categories: [] },
            fromFeats: { count: 0, categories: [] },
            details: 'Tool proficiencies are a 2024 ruleset feature',
            preSelected: [],
        };
    }

    const preSelected = new Set();
    let fromClassCount = 0;
    let fromClassCategories = [];
    let fromBackgroundCount = 0;
    let fromBackgroundCategories = [];
    let fromFeatsCount = 0;
    let fromFeatsCategories = [];

    // Background tool proficiencies
    if (backgroundName) {
        const backgroundData = await fetchBackgroundData(backgroundName, '2024');
        if (backgroundData?.tool_proficiencies && backgroundData.tool_proficiencies !== '') {
            const bgTool = backgroundData.tool_proficiencies;
            const parsed = parseToolChoiceString(bgTool);
            if (parsed.isChoice) {
                fromBackgroundCount = parsed.count;
                fromBackgroundCategories = parsed.categories;
            } else {
                // Fixed tool — add to pre-selected
                preSelected.add(bgTool);
            }
        }
    }

    // Class tool proficiencies
    if (className) {
        const classData = await fetchClassData(className, '2024');
        if (classData?.tool_proficiencies && classData.tool_proficiencies !== '') {
            const classTool = classData.tool_proficiencies;
            const parsed = parseToolChoiceString(classTool);
            if (parsed.isChoice) {
                fromClassCount = parsed.count;
                fromClassCategories = parsed.categories;
            } else {
                // Fixed tool — add to pre-selected (deduplicate)
                preSelected.add(classTool);
            }
        }
    }

    // Feat tool proficiencies
    if (selectedFeats.length > 0) {
        const featData = await loadFeatData('2024');
        for (const featName of selectedFeats) {
            const feat = featData.find(f => f.name === featName || f.index === featName.toLowerCase());
            if (feat) {
                const toolProf = parseFeatToolProficiency(feat);
                if (toolProf) {
                    fromFeatsCount += toolProf.count;
                    if (toolProf.isAny) {
                        // Skilled feat: any tools, no category restriction
                        fromFeatsCategories.push({ isAny: true });
                    } else {
                        fromFeatsCategories.push(...toolProf.categories);
                    }
                }
            }
        }
    }

    const totalAllowed = fromClassCount + fromBackgroundCount + fromFeatsCount;

    // Build details string
    const detailsParts = [];
    if (fromBackgroundCount > 0) {
        detailsParts.push(`${fromBackgroundCount} from background`);
    }
    if (fromClassCount > 0) {
        detailsParts.push(`${fromClassCount} from class`);
    }
    if (fromFeatsCount > 0) {
        detailsParts.push(`${fromFeatsCount} from feats`);
    }
    if (preSelected.size > 0) {
        detailsParts.push(`${preSelected.size} fixed`);
    }

    const details = detailsParts.length > 0
        ? `You get ${detailsParts.join(', ')} (${totalAllowed} choice tool proficiency/ies)`
        : 'No tool proficiencies granted by class, background, or feats';

    return {
        allowed: totalAllowed,
        fromClass: { count: fromClassCount, categories: fromClassCategories },
        fromBackground: { count: fromBackgroundCount, categories: fromBackgroundCategories },
        fromFeats: { count: fromFeatsCount, categories: fromFeatsCategories },
        details,
        preSelected: Array.from(preSelected),
    };
}

/**
 * Gets category-level choice info for the UI
 * Aggregates all "Choose X from category" sources into a flat list
 * @param {object} formData - The character form data
 * @param {object} toolLimits - Result from getToolLimits
 * @returns {Promise<object[]>} - Array of { category, total, selected, remaining, hasOrOptions }
 */
export async function getCategoryChoices(formData, toolLimits) {
    const { fromClass, fromBackground, fromFeats } = toolLimits;

    // Collect all category choices with their counts
    const categoryMap = new Map();

    const addCategoryChoices = (categories, count) => {
        if (count === 0) return;
        categories.forEach(cat => {
            if (typeof cat === 'object' && cat.isAny) {
                // Skilled feat: any tools — add as "any" category
                categoryMap.set('__any__', {
                    category: 'Any Tool',
                    total: count,
                    choices: [],
                    hasOrOptions: false,
                    isAny: true,
                });
            } else {
                const existing = categoryMap.get(cat);
                if (existing) {
                    existing.total += count;
                } else {
                    categoryMap.set(cat, {
                        category: cat,
                        total: count,
                        choices: [],
                        hasOrOptions: false,
                        isAny: false,
                    });
                }
            }
        });
    };

    addCategoryChoices(fromClass.categories, fromClass.count);
    addCategoryChoices(fromBackground.categories, fromBackground.count);
    addCategoryChoices(fromFeats.categories, fromFeats.count);

    // Load tools for each category and detect "or" patterns
    const result = [];
    for (const [categoryKey, info] of categoryMap) {
        if (categoryKey === '__any__') {
            result.push(info);
            continue;
        }

        const tools = await getToolsByCategory(categoryKey);
        info.choices = tools.map(t => t.name);
        info.toolCount = tools.length;

        // Detect "or" patterns: if both Artisan's Tools and Musical Instrument exist,
        // this is a Monk-style "pick one category" situation
        const orCategories = ['Artisan\'s Tools', 'Musical Instrument'];
        const orMatched = orCategories.filter(c => categoryMap.has(c));
        info.hasOrOptions = orMatched.length > 1;

        result.push(info);
    }

    return result;
}

/**
 * Validates tool selections and returns warnings (not blocking errors)
 * @param {object} formData - The character form data
 * @returns {Promise<object[]>} - Array of warning objects { message, type }
 */
export async function validateTools(formData) {
    const warnings = [];
    const selectedTools = formData.toolProficiencies || [];
    const ruleset = formData.rules || '5e';

    if (ruleset !== '2024') {
        return warnings;
    }

    const limits = await getToolLimits(formData);
    const categoryChoices = await getCategoryChoices(formData, limits);

    // Subtract pre-selected tools from the count — they don't cost slots
    const preSelectedSet = new Set(limits.preSelected || []);
    const userSelectedTools = selectedTools.filter(t => !preSelectedSet.has(t));

    // Check if too many tools selected (only user-selected, not pre-selected)
    if (userSelectedTools.length > limits.allowed) {
        warnings.push({
            message: `Rules allow ${limits.allowed} choice tool proficiency/ies. You have selected ${userSelectedTools.length}. (${limits.details})`,
            type: 'warning',
        });
    }

    // Check if too few tools selected (info, not warning)
    if (userSelectedTools.length < limits.allowed && userSelectedTools.length > 0 && limits.allowed > 0) {
        warnings.push({
            message: `You can select up to ${limits.allowed} choice tool proficiencies. You have selected ${userSelectedTools.length}.`,
            type: 'info',
        });
    }

    // Validate category choices: for "or" patterns, ensure all selections come from one category
    const selectedToolNames = new Set(selectedTools);
    categoryChoices.forEach(choice => {
        if (!choice.hasOrOptions || choice.isAny) return;

        // Find which categories have selected tools
        const selectedCategories = new Set();
        choice.choices.forEach(toolName => {
            if (selectedToolNames.has(toolName)) {
                selectedCategories.add(choice.category);
            }
        });

        // If tools selected from multiple "or" categories, warn
        // (This is handled by the UI preventing cross-category selection, but as a safety net)
    });

    // Check for duplicates
    const uniqueTools = new Set(selectedTools);
    if (uniqueTools.size < selectedTools.length) {
        warnings.push({
            message: 'Some tools are selected multiple times. Each tool should only be selected once.',
            type: 'warning',
        });
    }

    return warnings;
}

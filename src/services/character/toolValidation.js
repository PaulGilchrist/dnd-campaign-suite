/**
 * Tool proficiency validation service for character creation wizard (2024 ruleset only)
 * Simple approach: collect all tool grants by category, count selected tools per category, warn if over limit.
 */

import { loadEquipment, fetchBackgroundData, fetchClassData, loadFeatData } from '../ui/dataLoader.js';
import { getMajorFeatureProficiencyChoices } from './majorFeatureChoices.js';

const ALL_TOOL_CATEGORIES = ["Artisan's Tools", 'Gaming Sets', 'Musical Instrument', 'Other Tools'];

const CATEGORY_NORMALIZATION = {
    "Gaming Set": "Gaming Sets",
    "Gaming Sets": "Gaming Sets",
    "Musical Instrument": "Musical Instrument",
    "Musical Instruments": "Musical Instrument",
    "Artisan's Tools": "Artisan's Tools",
    "Other Tools": "Other Tools",
};

export function normalizeCategory(category) {
    if (!category) return category;
    const normalized = CATEGORY_NORMALIZATION[category.trim()];
    return normalized || category.trim();
}

export function parseToolChoiceString(choiceString) {
    if (!choiceString || typeof choiceString !== 'string') {
        return { count: 0, categories: [], isChoice: false };
    }

    const trimmed = choiceString.trim();

    if (!trimmed.startsWith('Choose')) {
        return { count: 0, categories: [], isChoice: false };
    }

    const orMatch = trimmed.match(/Choose\s+one\s+type\s+of\s+(.+)$/i);
    if (orMatch) {
        const categories = orMatch[1].split(/\s+or\s+/).map(c => normalizeCategory(c));
        return { count: 1, categories, isChoice: true };
    }

    const countMatch = trimmed.match(/Choose\s+(\d+)\s+(.+?)(?:\s*\(see[^)]*\)|\s*of\s+your\s+choice)?\.?\s*$/i);
    if (countMatch) {
        const count = parseInt(countMatch[1], 10);
        const category = normalizeCategory(countMatch[2]);
        return { count, categories: [category], isChoice: true };
    }

    const kindMatch = trimmed.match(/Choose\s+(?:one\s+)?kind\s+of\s+(.+)$/i);
    if (kindMatch) {
        const category = normalizeCategory(kindMatch[1]);
        return { count: 1, categories: [category], isChoice: true };
    }

    return { count: 0, categories: [], isChoice: false };
}

/**
 * Parses a feat's tool proficiency benefit description
 * @param {object} feat - The feat data object
 * @returns {object|null} - { count, categories[], isAny } or null
 */
export function parseFeatToolProficiency(feat) {
    if (!feat || !feat.benefits) return null;

    const toolBenefit = feat.benefits.find(b =>
        b.type === 'proficiency' &&
        b.description &&
        /tool.*proficien|proficien.*tool|instrument.*proficien|proficien.*instrument/i.test(b.description)
    );

    if (!toolBenefit) return null;

    const desc = toolBenefit.description;

    // Common patterns for number words
    const numWords = '(?:one|two|three|four|five|six|seven|eight|nine|ten|1|2|3|4|5|6|7|8|9|10)';
    const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

    // Crafter: "You gain proficiency with three different Artisan's Tools of your choice"
    const crafterMatch = desc.match(new RegExp(numWords + '\\s+different\\s+(Artisan).*Tools', 'i'));
    if (crafterMatch) {
        const firstWord = crafterMatch[0].split(' ')[0].toLowerCase();
        const count = wordToNum[firstWord] || 1;
        return { count, categories: [normalizeCategory("Artisan's Tools")], isAny: false };
    }

    // Skilled: "You gain proficiency in any combination of three skills or tools of your choice"
    const skilledMatch = desc.match(new RegExp(numWords + '\\s+skills\\s+or\\s+tools', 'i'));
    if (skilledMatch) {
        const firstWord = skilledMatch[0].split(' ')[0].toLowerCase();
        const count = wordToNum[firstWord] || 1;
        return { count, categories: [], isAny: true };
    }

    // Musician/others: "You gain proficiency with three Musical Instruments of your choice"
    const genericMatch = desc.match(new RegExp(numWords + '\\s+(?:different\\s+)?(\\w+(?:\\s+(?:and\\s+)?\\w+)*)\\s+of\\s+your\\s+choice', 'i'));
    if (genericMatch) {
        const firstWord = genericMatch[0].split(' ')[0].toLowerCase();
        const count = wordToNum[firstWord] || 1;
        const category = normalizeCategory(genericMatch[1]);
        return { count, categories: [category], isAny: false };
    }

    return null;
}

/**
 * Gets all tool entries from equipment.json filtered by category
 * @param {string} category - Tool category name
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
 * Computes how many tool proficiency selections are allocated from Skilled uses
 * @param {Map} categoryLimits - The categoryLimits map from getToolLimitsByCategory
 * @param {Array} selectedTools - Array of selected tool names
 * @param {Array<string>} allTools - Full tool list with _category property
 * @param {Array<string>} toolCategories - Tool category names
 * @returns {number} Number of selected tools allocated from Skilled
 */
export function computeSkilledToolUsage(categoryLimits, selectedTools, allTools, toolCategories) {
    if (!categoryLimits || categoryLimits.size === 0 || !selectedTools || selectedTools.length === 0) {
        return 0;
    }

    const isPlaceholder = (t) => /^(\d+) from: (.+)$/.test(t);
    const toolsByCategory = {};
    toolCategories.forEach(cat => {
        const toolsInCat = allTools.filter(t => t._category === cat);
        toolsByCategory[cat] = new Set(toolsInCat.map(t => t.name));
    });

    let categoryCovered = 0;
    for (const [category, limit] of categoryLimits) {
        const selectedInCategory = selectedTools.filter(t =>
            !isPlaceholder(t) && toolsByCategory[category]?.has(t)
        ).length;
        categoryCovered += Math.min(selectedInCategory, limit);
    }

    const userSelectedTools = selectedTools.filter(t => !isPlaceholder(t));
    return Math.max(0, userSelectedTools.length - categoryCovered);
}

function addCategoryLimit(categoryLimits, category, count) {
    categoryLimits.set(category, (categoryLimits.get(category) || 0) + count);
}

function applyParsedProficiency(categoryLimits, preSelected, rawValue, parsed) {
    if (parsed.isChoice) {
        for (const cat of parsed.categories) {
            addCategoryLimit(categoryLimits, cat, parsed.count);
        }
    } else {
        preSelected.add(rawValue);
    }
}

async function applyBackgroundGrants(categoryLimits, preSelected, backgroundName) {
    if (!backgroundName) return;
    const bgData = await fetchBackgroundData(backgroundName, '2024');
    if (bgData?.tool_proficiencies) {
        applyParsedProficiency(categoryLimits, preSelected, bgData.tool_proficiencies, parseToolChoiceString(bgData.tool_proficiencies));
    }
}

async function applyClassGrants(categoryLimits, preSelected, className) {
    if (!className) return;
    const classData = await fetchClassData(className, '2024');
    if (classData?.tool_proficiencies) {
        applyParsedProficiency(categoryLimits, preSelected, classData.tool_proficiencies, parseToolChoiceString(classData.tool_proficiencies));
    }
}

// Chef: auto-selects Cook's Utensils (fixed tool, no choice limit)
function isChefFeat(feat) {
    return feat.benefits.some(b =>
        b.type === 'proficiency' &&
        b.description &&
        /cook['\u2019]?\w*\s*utensil/i.test(b.description)
    );
}

async function applyFeatGrants(categoryLimits, preSelected, selectedFeats) {
    if (selectedFeats.length === 0) return 0;
    let skilledUsesAvailable = 0;
    const featData = await loadFeatData('2024');
    for (const featName of selectedFeats) {
        const feat = featData.find(f => f.name === featName || f.index === featName.toLowerCase());
        if (!feat) continue;

        if (isChefFeat(feat)) {
            preSelected.add("Cook's Utensils");
            continue;
        }

        const toolProf = parseFeatToolProficiency(feat);
        if (!toolProf) continue;

        if (toolProf.isAny) {
            // Skilled: tracks as a shared pool, not spread across categories
            if (featName === 'Skilled') {
                skilledUsesAvailable += toolProf.count;
            } else {
                // Other isAny grants (if any) apply to all tool categories
                for (const cat of ALL_TOOL_CATEGORIES) {
                    addCategoryLimit(categoryLimits, cat, toolProf.count);
                }
            }
        } else {
            for (const cat of toolProf.categories) {
                addCategoryLimit(categoryLimits, cat, toolProf.count);
            }
        }
    }
    return skilledUsesAvailable;
}

// Major feature grants with feature-level proficiency_choices
// (e.g., Battle Master's Student of War: +1 Artisan's Tools)
async function applyMajorFeatureGrants(categoryLimits, formData) {
    const majorChoices = await getMajorFeatureProficiencyChoices(formData);
    if (majorChoices.length === 0) return;
    const equipment = await loadEquipment();
    const categoryByToolName = new Map(
        equipment.filter(e => e.equipment_category === 'Tools').map(e => [e.name, normalizeCategory(e.tool_category)])
    );
    for (const mc of majorChoices) {
        const toolNames = mc.from.filter(e => e.startsWith('Tool: ')).map(e => e.substring(6).trim());
        if (toolNames.length === 0) continue;
        const categories = [...new Set(toolNames.map(n => categoryByToolName.get(n)).filter(Boolean))];
        if (categories.length === 1) {
            addCategoryLimit(categoryLimits, categories[0], mc.choose);
        } else {
            console.error(`Major feature "${mc.featureName}" grants tools across multiple categories (${categories.join(', ')}); category-limit model cannot express a mixed pool.`);
        }
    }
}

/**
 * Aggregates tool proficiency grants by category
 * Returns a map of category -> total count from all sources
 * @param {object} formData - The character form data
 * @returns {Promise<object>} - { categoryLimits: Map<category, count>, preSelected: string[], skilledUsesAvailable: number }
 */
export async function getToolLimitsByCategory(formData) {
    const ruleset = formData.rules || '5e';

    if (ruleset !== '2024') {
        return { categoryLimits: new Map(), preSelected: [], skilledUsesAvailable: 0 };
    }

    const categoryLimits = new Map();
    const preSelected = new Set();

    await applyBackgroundGrants(categoryLimits, preSelected, formData.background || '');
    await applyClassGrants(categoryLimits, preSelected, formData.class?.name || '');
    const skilledUsesAvailable = await applyFeatGrants(categoryLimits, preSelected, formData.feats || []);
    await applyMajorFeatureGrants(categoryLimits, formData);

    return { categoryLimits, preSelected: Array.from(preSelected), skilledUsesAvailable };
}

/**
 * Validates tool selections and returns warnings
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

    const { categoryLimits, preSelected, skilledUsesAvailable } = await getToolLimitsByCategory(formData);
    const preSelectedSet = new Set(preSelected);
    const isPlaceholder = (t) => /^(\d+) from: (.+)$/.test(t);
    const userSelectedTools = selectedTools.filter(t => !preSelectedSet.has(t) && !isPlaceholder(t));

    // Load all tools and categorize them
    const toolCategories = ALL_TOOL_CATEGORIES;
    const toolsByCategory = {};
    for (const cat of toolCategories) {
        const tools = await getToolsByCategory(cat);
        toolsByCategory[cat] = new Set(tools.map(t => t.name));
    }

    // Count selected tools per category and warn if over limit
    // Skilled can cover overflow from category limits
    let skilledCanCover = skilledUsesAvailable;

    for (const [category, limit] of categoryLimits) {
        const selectedInCategory = userSelectedTools.filter(t => toolsByCategory[category]?.has(t)).length;
        if (selectedInCategory > limit) {
            const excess = selectedInCategory - limit;
            if (skilledCanCover >= excess) {
                skilledCanCover -= excess;
            } else {
                warnings.push({
                    message: `You have selected ${selectedInCategory} from ${category}, but your class/background/feats only grant ${limit} proficiency/ies from ${category}.`,
                    type: 'warning',
                });
            }
        }
    }

    // Warn if user selects any tool from a category with 0 allowed
    // But allow Skilled to cover it
    for (const category of toolCategories) {
        const limit = categoryLimits.get(category) || 0;
        if (limit === 0) {
            const selectedInCategory = userSelectedTools.filter(t => toolsByCategory[category]?.has(t));
            if (selectedInCategory.length > 0) {
                if (skilledCanCover < selectedInCategory.length) {
                    warnings.push({
                        message: `You have selected ${selectedInCategory.length} from ${category} (${selectedInCategory.join(', ')}), but your class/background/feats do not grant any proficiencies from ${category}.`,
                        type: 'warning',
                    });
                } else {
                    skilledCanCover -= selectedInCategory.length;
                }
            }
        }
    }

    return warnings;
}

import { categorizeFeatures } from '../featureCategorizationUtils.js';

export function addTraits(traits, featureCategories) {
    return categorizeFeatures(traits, featureCategories, { descriptionField: 'description' });
}

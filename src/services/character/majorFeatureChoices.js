/**
 * Resolves feature-level proficiency_choices granted by a 2024 major (subclass).
 * In app data these choices live on the feature object, not on the major itself
 * (e.g., Fighter > Battle Master > Student of War lv3 grants 1 Artisan's Tools + 1 Fighter skill).
 */

import { fetchClassData } from '../ui/dataLoader.js';

/**
 * @param {object} formData - The character form data
 * @returns {Promise<Array<{featureName: string, choose: number, from: string[]}>>}
 *   proficiency_choice objects from major features the character has reached,
 *   with the granting feature's name attached. Empty for 5e or when no major is selected.
 */
export async function getMajorFeatureProficiencyChoices(formData) {
  if ((formData.rules || '5e') !== '2024') return [];

  const className = formData.class?.name;
  const majorName = formData.class?.major?.name || formData.class?.subclass?.name;
  if (!className || !majorName) return [];

  const classData = await fetchClassData(className, '2024');
  const major = classData?.majors?.find(m => m.name === majorName);
  if (!major?.features) return [];

  const level = formData.level || 1;
  const choices = [];
  major.features.forEach(feature => {
    if ((feature.level || 0) <= level && Array.isArray(feature.proficiency_choices)) {
      feature.proficiency_choices.forEach(pc => {
        if (pc.from && pc.from.length > 0) {
          choices.push({
            featureName: feature.name,
            choose: pc.choose || 1,
            from: pc.from,
          });
        }
      });
    }
  });
  return choices;
}

import { fetchRaceData, loadFeatData } from '../../ui/dataLoader.js';

/**
 * Extracts skill choice lists from race traits with proficiency_choices
 * (e.g., Human "Skillful": choose 1 from all 18 skills)
 * @param {object} formData - The character form data
 * @returns {Promise<Array<{count: number, skills: string[]}>>} Race proficiency choice sources
 */
export async function getRaceProficiencyChoiceSources(formData) {
  if (!formData.race?.name) return [];

  const raceData = await fetchRaceData(formData.race.name, formData.rules || '2024');
  if (!raceData || !raceData.traits) return [];

  const sources = [];
  raceData.traits.forEach(trait => {
    if (trait.proficiency_choices && trait.proficiency_choices.from && trait.proficiency_choices.from[0].startsWith('Skill: ')) {
      const skills = trait.proficiency_choices.from
        .map(s => s.replace('Skill: ', '').trim())
        .filter(s => s.length > 0);
      if (skills.length > 0 && trait.proficiency_choices.choose > 0) {
        sources.push({
          source: 'race',
          count: trait.proficiency_choices.choose,
          skills: skills,
        });
      }
    }
  });

  return sources;
}

/**
 * Extracts skill choice lists from race origin feats
 * (e.g., Human's Versatile trait grants an origin feat like Keen Mind)
 * @param {object} formData - The character form data
 * @param {Array} allFeats - Array of all feat data objects (may be empty during initial load)
 * @returns {Promise<Array<{count: number, skills: string[], featName: string}>>} Race feat proficiency choice sources
 */
export async function getRaceFeatProficiencyChoiceSources(formData, allFeats) {
  if (!formData.race?.name) return [];

  const raceData = await fetchRaceData(formData.race.name, formData.rules || '2024');
  if (!raceData || !raceData.traits) return [];

  const originFeats = [];
  raceData.traits.forEach(trait => {
    if (trait.proficiency_choices && trait.proficiency_choices.from && !trait.proficiency_choices.from[0].startsWith('Skill: ')) {
      originFeats.push(...trait.proficiency_choices.from);
    }
  });

  if (originFeats.length === 0) return [];

  const featData = (allFeats && allFeats.length > 0) ? allFeats : await loadFeatData(formData.rules || '5e');
  if (!featData || featData.length === 0) return [];

  const sources = [];
  originFeats.forEach(featName => {
    const feat = featData.find(f => f.name === featName || f.index === featName.toLowerCase());
    if (!feat || !feat.benefits) return;

    feat.benefits.forEach(benefit => {
      if (benefit.type === 'proficiency' && benefit.description) {
        const match = benefit.description.match(/(?:Choose one of the following skills:\s*|Choose one skill:\s*)(.+?)\.\s*(?:If|You|This|When)/i);
        if (match) {
          const skills = match[1]
            .split(/,\s*|,\s*(?:and\s+|\bor\s+)|(?:and\s+|\bor\s+)/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
          if (skills.length > 0) {
            sources.push({
              source: 'race_feat',
              count: 1,
              skills: skills,
              featName: feat.name,
            });
          }
        }
      }
    });
  });

  return sources;
}

/**
 * Gets proficiency choice data from character feats
 * Returns { count, skillLists } where skillLists is an array of skill arrays
 * @param {object} formData - The character form data
 * @param {Array} allFeats - Array of all feat data objects (may be empty during initial load)
 * @returns {Promise<{count: number, skillLists: Array<{skills: string[], featName: string}>}>}
 */
export async function getFeatProficiencyChoiceData(formData, allFeats) {
  if (!formData.feats || formData.feats.length === 0) {
    return { count: 0, skillLists: [] };
  }

  const featData = (allFeats && allFeats.length > 0) ? allFeats : await loadFeatData(formData.rules || '5e');
  if (!featData || featData.length === 0) {
    return { count: 0, skillLists: [] };
  }

  let totalCount = 0;
  const skillLists = [];

  formData.feats.forEach(featName => {
    const feat = featData.find(f => f.name === featName || f.index === featName.toLowerCase());
    if (!feat || !feat.benefits) return;

    feat.benefits.forEach(benefit => {
      if (benefit.type === 'proficiency' && benefit.description) {
        const match = benefit.description.match(/(?:Choose one of the following skills:\s*|Choose one skill:\s*)(.+?)\.\s*(?:If|You|This|When)/i);
        if (match) {
          const skills = match[1]
            .split(/,\s*|,\s*(?:and\s+|\bor\s+)|(?:and\s+|\bor\s+)/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
          if (skills.length > 0) {
            totalCount += 1;
            skillLists.push({
              skills: skills,
              featName: feat.name,
            });
          }
        }
      }
    });
  });

  return { count: totalCount, skillLists };
}

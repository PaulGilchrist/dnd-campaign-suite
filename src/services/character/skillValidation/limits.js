import { fetchClassData, fetchRaceData, fetchBackgroundData } from '../../ui/dataLoader.js';
import { ALL_SKILL_NAMES } from './constants.js';
import {
  findAllSkillProfFeats,
  countFeatProficiencyChoices,
  countSkilledUses,
  countSkillExpertProficiencyChoices,
} from './feat-helpers.js';
import { getRaceProficiencyChoiceSources, getRaceFeatProficiencyChoiceSources, getFeatProficiencyChoiceData } from './race-sources.js';
import { getMajorFeatureProficiencyChoices } from '../majorFeatureChoices.js';
import { computeTotalSkilledUsage, computeSkilledToolUsageOnly } from './skilled-pool.js';
import { parseSkillProficiencies } from './parse-skills.js';

/**
 * Gets the number of skill proficiencies allowed based on ruleset, class, race, and background
 * @param {object} formData - The character form data
 * @param {Array} allFeats - Array of all feat data objects (may be empty during initial load)
 * @returns {Promise<object>} - { allowed: number, fromClass: object, fromRace: object, fromBackground: object, details: string }
 */
export async function getSkillLimits(formData, allFeats) {
  const ruleset = formData.rules || '5e';
  const className = formData.class?.name || '';
  const raceName = formData.race?.name || '';
  const backgroundName = formData.background || '';

  let fromClass = { count: 0, skills: [], isChoice: true };
  let fromRace = { count: 0, skills: [], isChoice: false };
  let fromBackground = { count: 0, skills: [], isChoice: false };

  const allSkillProfFeats = await findAllSkillProfFeats(formData, allFeats);
  if (allSkillProfFeats.length > 0) {
    const skilledUsesAvailable = await countSkilledUses(formData, allFeats);
    // With Boon of Skill, all skills are covered, so skilled usage only comes from tools
    const skilledToolUsage = await computeSkilledToolUsageOnly(formData);
    return {
      allowed: ALL_SKILL_NAMES.length + skilledUsesAvailable,
      fromClass: { count: 0, skills: [], isChoice: true },
      fromRace: { count: 0, skills: [], isChoice: false },
      fromBackground: { count: 0, skills: [], isChoice: false },
      details: 'Boon of Skill grants proficiency in all skills',
      allSkillsGranted: true,
      skilledUsesAvailable,
      skilledUsesUsed: skilledToolUsage,
    };
  }

  if (ruleset === '2024') {
    return getSkillLimits2024(formData, allFeats, { fromClass, fromRace, fromBackground, className, raceName, backgroundName });
  }

  // 5e rules: Class gives choice, Race gives automatic or choice, Background gives 2 skills
  if (className) {
    const classData = await fetchClassData(className, '5e');
    fromClass = parseSkillProficiencies(classData, '5e');
  }

  if (raceName) {
    const raceData = await fetchRaceData(raceName, '5e');
    fromRace = parseSkillProficiencies(raceData, '5e');
  }

  // 5e backgrounds typically give 2 skills but data structure may differ
  // Load from rules-validation.json for background language count
  const backgroundLangCount = 2; // Default for 5e
  fromBackground = { count: backgroundLangCount, skills: [], isChoice: true };

  const totalAllowed = fromClass.count + fromRace.count + fromBackground.count;
  const featProfs = await countFeatProficiencyChoices(formData, allFeats);
  const finalTotal = totalAllowed + featProfs;

  // Build skillChoiceSources array with restricted pools
  const { skillChoiceSources, featChoiceData } = await build5eChoiceSources(formData, allFeats, fromClass, fromRace);

  // Count Skilled uses
  const skilledUsesAvailable = await countSkilledUses(formData, allFeats);

  // Compute total Skilled usage (skills + tools not covered by restrictive sources)
  const skilledUsesUsed = await computeTotalSkilledUsage(formData, skillChoiceSources);

  const details = build5eDetails({ backgroundName, fromClass, fromRace, fromBackground, totalAllowed, featProfs, featChoiceData });

  return {
    allowed: finalTotal + skilledUsesAvailable,
    fromClass,
    fromRace,
    fromBackground,
    skillChoiceSources,
    skilledUsesAvailable,
    skilledUsesUsed,
    details
  };
}

async function build5eChoiceSources(formData, allFeats, fromClass, fromRace) {
  const skillChoiceSources = [];
  if (fromClass.isChoice && fromClass.skills.length > 0) {
    skillChoiceSources.push({
      source: 'class',
      count: fromClass.count,
      skills: fromClass.skills,
    });
  }
  if (fromRace.isChoice && fromRace.skills.length > 0) {
    skillChoiceSources.push({
      source: 'race',
      count: fromRace.count,
      skills: fromRace.skills,
    });
  }
  // Character feats with restricted skill lists
  const featChoiceData = await getFeatProficiencyChoiceData(formData, allFeats);
  featChoiceData.skillLists.forEach(sl => {
    skillChoiceSources.push({
      source: 'feat',
      count: 1,
      skills: sl.skills,
      featName: sl.featName,
    });
  });

  // Skill Expert grants 1 skill proficiency of your choice (all 18 skills)
  const skillExpertCount = await countSkillExpertProficiencyChoices(formData, allFeats);
  if (skillExpertCount > 0) {
    skillChoiceSources.push({
      source: 'feat',
      count: skillExpertCount,
      skills: ALL_SKILL_NAMES,
      featName: 'Skill Expert',
    });
  }

  return { skillChoiceSources, featChoiceData };
}

// Core source-attribution sentence shared by both ruleset lanes. Every clause is
// count-driven: a source is only named when it actually contributes slots, so a
// build with no background never reads "from your background". `lead` differs per
// ruleset; `totalAllowed` stays the validator's own class+race+background sum.
function buildSourceSentence(lead, { classCount, classSkills, raceCount, backgroundCount, totalAllowed }) {
  let details = `${lead} ${classCount} skill choice(s)${classSkills.length > 0 ? ' from ' + classSkills.join(', ') : ''}, ${raceCount} from your race`;
  if (backgroundCount > 0) {
    details += `, and ${backgroundCount} from your background`;
  }
  return details + ` (${totalAllowed} total)`;
}

function build5eDetails({ backgroundName, fromClass, fromRace, fromBackground, totalAllowed, featProfs, featChoiceData }) {
  // The 5e lane hides the Background step and never fetches background data: a
  // build with no background still gets the free-choice bucket the validator
  // enforces, but it is class-sourced (the quick build fills it from the class's
  // skills), so fold it into the class choices instead of crediting a phantom
  // background. Only a named background keeps the "from your background" clause.
  const backgroundCount = backgroundName ? fromBackground.count : 0;
  let details = buildSourceSentence('In 5e rules, you get', {
    classCount: fromClass.count + fromBackground.count - backgroundCount,
    classSkills: fromClass.skills,
    raceCount: fromRace.count,
    backgroundCount,
    totalAllowed,
  });
  if (featChoiceData.skillLists.length > 0) {
    const featDetails = featChoiceData.skillLists.map(sl => `${sl.featName}: choose 1 from ${sl.skills.join(', ')}`).join('. ');
    if (featDetails) {
      details += `. + ${featProfs} from feats: ${featDetails}`;
    }
  }
  return details;
}

async function build2024ChoiceSources(formData, allFeats, fromClass, fromRace, fromBackground) {
  const skillChoiceSources = [];
  const raceChoiceSources = [];
  // Background skills (non-choice) are always allowed
  if (fromBackground.skills.length > 0 && !fromBackground.isChoice) {
    skillChoiceSources.push({
      source: 'background',
      count: fromBackground.count,
      skills: fromBackground.skills,
    });
  }
  if (fromClass.isChoice && fromClass.skills.length > 0) {
    skillChoiceSources.push({
      source: 'class',
      count: fromClass.count,
      skills: fromClass.skills,
    });
  }
  if (fromRace.isChoice && fromRace.count > 0) {
    // Race with "from" format has skills populated
    if (fromRace.skills.length > 0) {
      skillChoiceSources.push({
        source: 'race',
        count: fromRace.count,
        skills: fromRace.skills,
      });
    } else {
      // Race with proficiency_choices in traits (e.g., Human Skillful)
      const raceSources = await getRaceProficiencyChoiceSources(formData);
      skillChoiceSources.push(...raceSources);
      raceChoiceSources.push(...raceSources);
    }
  }
  // Race origin feats (e.g., Human Versatile -> Keen Mind)
  const raceFeatSources = await getRaceFeatProficiencyChoiceSources(formData, allFeats);
  skillChoiceSources.push(...raceFeatSources);
  // Character feats with restricted skill lists
  const featChoiceData = await getFeatProficiencyChoiceData(formData, allFeats);
  featChoiceData.skillLists.forEach(sl => {
    skillChoiceSources.push({
      source: 'feat',
      count: 1,
      skills: sl.skills,
      featName: sl.featName,
    });
  });

  // Skill Expert grants 1 skill proficiency of your choice (all 18 skills)
  const skillExpertCount = await countSkillExpertProficiencyChoices(formData, allFeats);
  if (skillExpertCount > 0) {
    skillChoiceSources.push({
      source: 'feat',
      count: skillExpertCount,
      skills: ALL_SKILL_NAMES,
      featName: 'Skill Expert',
    });
  }

  return { skillChoiceSources, raceChoiceSources, raceFeatSources, featChoiceData };
}

async function getSkillLimits2024(formData, allFeats, ctx) {
  // 2024 rules: Class gives choice, Race gives choice(s) via traits, Background gives specific skills
  let { fromClass, fromRace, fromBackground } = ctx;

  if (ctx.className) {
    const classData = await fetchClassData(ctx.className, '2024');
    fromClass = parseSkillProficiencies(classData, '2024');
  }

  if (ctx.raceName) {
    const raceData = await fetchRaceData(ctx.raceName, '2024');
    fromRace = parseSkillProficiencies(raceData, '2024');
  }

  if (ctx.backgroundName) {
    const backgroundData = await fetchBackgroundData(ctx.backgroundName, '2024');
    fromBackground = parseSkillProficiencies(backgroundData, '2024');
  }

  const totalAllowed = fromClass.count + fromRace.count + fromBackground.count;
  const featProfs = await countFeatProficiencyChoices(formData, allFeats);
  const finalTotal = totalAllowed + featProfs;

  // Build skillChoiceSources array with restricted pools
  const { skillChoiceSources, raceChoiceSources, raceFeatSources, featChoiceData } =
    await build2024ChoiceSources(formData, allFeats, fromClass, fromRace, fromBackground);

  // Major feature grants with feature-level proficiency_choices
  // (e.g., Battle Master's Student of War: +1 skill from Fighter skills)
  let majorProfs = 0;
  const majorSkillLists = [];
  const majorChoices = await getMajorFeatureProficiencyChoices(formData);
  majorChoices.forEach(mc => {
    const skills = mc.from.filter(e => e.startsWith('Skill: ')).map(e => e.substring(7).trim());
    if (skills.length > 0) {
      majorProfs += mc.choose;
      majorSkillLists.push({ featName: mc.featureName, skills });
      skillChoiceSources.push({
        source: 'major',
        count: mc.choose,
        skills,
        featName: mc.featureName,
      });
    }
  });

  // Count Skilled uses
  const skilledUsesAvailable = await countSkilledUses(formData, allFeats);

  // Build details string with feat-specific skill lists. The background clause
  // only renders when the background contributes slots (count is parsed from
  // real background data, so 2024 builds without a background skip it too).
  let details = buildSourceSentence('You get', {
    classCount: fromClass.count,
    classSkills: fromClass.skills,
    raceCount: fromRace.count,
    backgroundCount: fromBackground.count,
    totalAllowed,
  });
  if (raceChoiceSources.length > 0 || raceFeatSources.length > 0 || featChoiceData.skillLists.length > 0) {
    const allSources = [...raceChoiceSources, ...raceFeatSources, ...featChoiceData.skillLists.map(sl => ({ featName: sl.featName, skills: sl.skills }))];
    const featDetails = allSources.map(s => {
      const label = s.featName ? s.featName : (s.source === 'race' ? 'Race trait' : 'Feat');
      return `${label}: choose 1 from ${s.skills.join(', ')}`;
    }).join('. ');
    if (featDetails) {
      details += `. + ${featProfs} from feats/traits: ${featDetails}`;
    }
  }
  majorSkillLists.forEach(ml => {
    details += `. + ${ml.featName}: choose 1 from ${ml.skills.join(', ')}`;
  });

  // Compute total Skilled usage (skills + tools not covered by restrictive sources)
  const skilledUsesUsed = await computeTotalSkilledUsage(formData, skillChoiceSources);

  return {
    allowed: finalTotal + majorProfs + skilledUsesAvailable,
    fromClass,
    fromRace,
    fromBackground,
    skillChoiceSources,
    skilledUsesAvailable,
    skilledUsesUsed,
    details
  };
}

import { loadClassData, loadRaceData, loadFeatData } from '../ui/dataLoader.js';

function extractSpellsFromDescription(description, result) {
  if (!description) return;

  const emPattern = /<em>([^<]+)<\/em>/gi;
  let match;

  while ((match = emPattern.exec(description)) !== null) {
    const spellName = match[1].trim();

    const knownCantrips = [
      'Light', 'Prestidigitation', 'Druidcraft', 'Dancing Lights', 'Mending',
      'Minor Illusion', 'Thaumaturgy', 'Blade Ward', 'Friends', 'Guidance',
      'Illusory Script', 'Message', 'Resistance', 'Virtue', 'War Cry',
      'Fire Bolt', 'Ray of Frost', 'Shocking Grasp', 'Acid Splash', 'Poison Spray',
      'Sacred Flame', 'Toll the Dead', 'Word of Radiance', 'Chill Touch',
      'Eldritch Blast', 'True Strike', 'Vicious Mockery', 'Produce Flame',
      'Shillelagh', 'Magic Stone', 'Thorn Whip', 'Frostbite', 'Gust',
      'Infestation', 'Mage Hand', 'Shape Water', 'Control Flames',
    ];

    const knownSpells = [
      'Speak with Animals', 'Detect Magic', 'Faerie Fire', 'Longstrider',
      'Darkness', 'Misty Step', 'Pass Without Trace', 'Invisibility',
      'Silent Image', 'Cursed Hunt', 'Ensnaring Strike',
      'Bless', 'Cure Wounds', 'Command', 'Identify', 'Burning Hands',
      'Shield of Faith', 'Divine Favor', 'Fog Cloud', 'Thunderwave',
      'Charm Person', 'Disguise Self', 'Animal Friendship', 'Sanctuary',
      'Heroism', 'Protection from Evil and Good', 'Purify Food and Drink',
    ];

    if (knownCantrips.includes(spellName)) {
      if (!result.cantrips.includes(spellName)) {
        result.cantrips.push(spellName);
      }
    } else if (knownSpells.includes(spellName)) {
      if (!result.spells.includes(spellName)) {
        result.spells.push(spellName);
      }
    }
  }

  const cantripPattern = /(?:know|learn)\s+(?:the\s+)?([\w\s]+?)\s+cantrip/gi;
  while ((match = cantripPattern.exec(description)) !== null) {
    const spellName = match[1].trim();
    if (!result.cantrips.includes(spellName) && !result.spells.includes(spellName)) {
      result.cantrips.push(spellName);
    }
  }
}

function extractRaceSpells(raceData, version = '5e') {
  const result = { spells: [], cantrips: [], details: [] };

  if (!raceData) {
    return result;
  }

  if (version === '2024') {
    if (raceData.traits) {
      raceData.traits.forEach(trait => {
        const desc = trait.description || '';
        extractSpellsFromDescription(desc, result);
         });
       }

    if (raceData.subraces) {
      raceData.subraces.forEach(subrace => {
        const desc = subrace.description || '';
        extractSpellsFromDescription(desc, result);
      });
    }
    } else {
    if (raceData.traits) {
      raceData.traits.forEach(trait => {
        const desc = Array.isArray(trait.description) ? trait.description.join(' ') : (trait.description || '');
        extractSpellsFromDescription(desc, result);
          });
        }

    if (raceData.subraces) {
      raceData.subraces.forEach(subrace => {
        const desc = Array.isArray(subrace.description) ? subrace.description.join(' ') : (subrace.description || '');
        extractSpellsFromDescription(desc, result);
          });
        }
    }

  return result;
}

function extractSubraceSpells(subraceData, version = '5e') {
  const result = { spells: [], cantrips: [], details: [] };

  if (!subraceData) {
    return result;
  }

  const traits = subraceData.racial_traits || subraceData.traits || [];

  if (version === '2024') {
    traits.forEach(trait => {
      const desc = trait.description || '';
      extractSpellsFromDescription(desc, result);
        });
      } else {
    traits.forEach(trait => {
      const desc = Array.isArray(trait.description) ? trait.description.join(' ') : (trait.description || '');
      extractSpellsFromDescription(desc, result);
        });
      }

  const desc = subraceData.description || '';
  if (desc) {
    extractSpellsFromDescription(desc, result);
  }

  return result;
}

function extractFeatSpells(featData) {
  const result = {
    spells: [],
    cantrips: [],
    spellListAccess: [],
    details: [],
    grantedSpellLevels: {}
  };

  if (!featData) {
    return result;
  }

  const featName = featData.name || '';
  const desc = featData.description || '';

  if (featName === 'Magic Initiate') {
    result.details.push('Magic Initiate grants 2 cantrips and 1 first-level spell from a chosen class spell list');
    result.spellListAccess.push('Any class (chosen by player)');
    result.grantedSpellLevels.cantrips = 2;
    result.grantedSpellLevels.level1 = 1;
  }

  if (featName === 'Fey Touched') {
    result.spells.push('Misty Step');
    result.details.push('Fey Touched grants Misty Step and one level 1 Divination or Enchantment spell');
    result.grantedSpellLevels.level1 = 1;
  }

  if (featName === 'Shadow Touched') {
    result.spells.push('Invisibility');
    result.details.push('Shadow Touched grants Invisibility and one level 1 Illusion or Necromancy spell');
    result.grantedSpellLevels.level1 = 1;
  }

  if (desc.includes('cantrip') || desc.includes('spell')) {
    extractSpellsFromDescription(desc, result);
  }

  if (featData.benefits) {
    featData.benefits.forEach(benefit => {
      if (benefit.type === 'spell') {
        const benefitDesc = benefit.description || '';
        extractSpellsFromDescription(benefitDesc, result);
      }
    });
  }

  return result;
}

function getSubclassSpells(classData, subclassName, charLevel) {
  const spells = [];

  if (!classData || !classData.subclasses || !subclassName) {
    return spells;
  }

  const subclass = classData.subclasses.find(
    s => s.name === subclassName || s.index === subclassName.toLowerCase()
  );

  if (!subclass || !subclass.spells) {
    return spells;
  }

  subclass.spells.forEach(entry => {
    if (!entry.spell || !entry.spell.name) return;

    const prereqs = entry.prerequisites || [];
    let allowedAtLevel = 1;

    prereqs.forEach(prereq => {
      if (prereq.type === 'level') {
        const match = (prereq.name || prereq.index || '').match(/(\d+)/);
        if (match) {
          allowedAtLevel = Math.max(allowedAtLevel, parseInt(match[1], 10));
        }
      }
    });

    if (charLevel >= allowedAtLevel) {
      spells.push(entry.spell.name);
    }
  });

  return spells;
}

export async function getPreSelectedSpells(formData) {
  const classSpells = [];
  const raceCantrips = [];
  const raceSpells = [];
  const featSpells = [];
  const featCantrips = [];

  if (!formData) return [];

  const version = formData.rules || '5e';
  const charLevel = parseInt(formData.level) || 1;

  const className = formData.class?.name;
  const subclassName = formData.class?.subclass?.name;
  const raceName = formData.race?.name;
  const subraceName = formData.race?.subrace?.name;

  if (className) {
    const classes = await loadClassData(version);
    const classData = classes.find(c => c.name === className || c.index === className.toLowerCase());

    if (classData && subclassName) {
      const subclassSpells = getSubclassSpells(classData, subclassName, charLevel);
      classSpells.push(...subclassSpells);
    }

    if (className === 'Druid' && version === '2024') {
      classSpells.push('Speak with Animals');
    }
  }

  if (raceName) {
    const races = await loadRaceData(version);
    const raceData = races.find(r => r.name === raceName || r.index === raceName.toLowerCase());

    if (raceData) {
      const raceResult = extractRaceSpells(raceData, version);
      raceCantrips.push(...raceResult.cantrips);
      raceSpells.push(...raceResult.spells);
    }

    if (subraceName) {
      let subraceData = null;

      if (version === '2024') {
        if (raceData && raceData.subraces) {
          subraceData = raceData.subraces.find(s => s.name === subraceName);
        }
      } else {
        const subraceMatch = races.find(r => r.name === subraceName || r.index === subraceName.toLowerCase());
        if (subraceMatch) {
          subraceData = subraceMatch;
        } else if (raceData && raceData.subraces) {
          subraceData = raceData.subraces.find(s => s.name === subraceName);
        }
      }

      if (subraceData) {
        const subraceResult = extractSubraceSpells(subraceData, version);
        raceCantrips.push(...subraceResult.cantrips);
        raceSpells.push(...subraceResult.spells);
      }
    }
  }

  const selectedFeats = formData.feats || [];
  if (selectedFeats.length > 0) {
    const feats = await loadFeatData(version);

    selectedFeats.forEach(featName => {
      const featData = feats.find(f => f.name === featName || f.index === featName.toLowerCase());
      if (featData) {
        const featResult = extractFeatSpells(featData);
        featSpells.push(...featResult.spells);
        featCantrips.push(...featResult.cantrips);
      }
    });
  }

  const allPreSelected = [
    ...classSpells,
    ...raceSpells,
    ...raceCantrips,
    ...featSpells,
    ...featCantrips,
  ];

  return [...new Set(allPreSelected)];
}

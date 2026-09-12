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
      'Beast Sense', 'Speak with Animals', 'Detect Magic', 'Faerie Fire', 'Longstrider',
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
        if (/lineage/i.test(trait.name || '')) return;
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
        if (/lineage/i.test(trait.name || '')) return;
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
      if (/lineage/i.test(trait.name || '')) return;
      const desc = trait.description || '';
      extractSpellsFromDescription(desc, result);
        });
      } else {
    traits.forEach(trait => {
      if (/lineage/i.test(trait.name || '')) return;
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

  if (!classData || !subclassName) {
    return spells;
  }

  // 2024 majors format: {name, level} - used by Druid circles
  if (classData.majors) {
    const major = classData.majors.find(
      m => m.name === subclassName || m.index === subclassName.toLowerCase()
    );
    if (major && major.spells) {
      major.spells.forEach(entry => {
        const spellName = entry.name || (entry.spell && entry.spell.name);
        if (!spellName) return;
        const spellLevel = entry.level || 1;
        if (charLevel >= spellLevel) {
          spells.push(spellName);
        }
      });
    }
    return spells;
  }

  // 5e subclasses format: {spell: {name}, prerequisites: [{type: 'level', name: '...'}]}
  if (!classData.subclasses) {
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

async function collectClassSpells(className, subclassName, charLevel, version) {
  const spells = [];
  const classes = await loadClassData(version);
  const classData = classes.find(c => c.name === className || c.index === className.toLowerCase());

  if (classData && subclassName) {
    spells.push(...getSubclassSpells(classData, subclassName, charLevel));
  }

  if (className === 'Druid' && version === '2024') {
    spells.push('Speak with Animals');
  }

  return spells;
}

function resolveSubrace(races, raceData, subraceName, version) {
  if (version === '2024') {
    return (raceData && raceData.subraces ? raceData.subraces.find(s => s.name === subraceName) : null) || null;
  }

  const subraceMatch = races.find(r => r.name === subraceName || r.index === subraceName.toLowerCase());
  if (subraceMatch) {
    return subraceMatch;
  }
  return (raceData && raceData.subraces ? raceData.subraces.find(s => s.name === subraceName) : null) || null;
}

async function collectRaceSpells(raceName, subraceName, version) {
  const cantrips = [];
  const spells = [];
  const races = await loadRaceData(version);
  const raceData = races.find(r => r.name === raceName || r.index === raceName.toLowerCase());

  if (raceData) {
    const raceResult = extractRaceSpells(raceData, version);
    cantrips.push(...raceResult.cantrips);
    spells.push(...raceResult.spells);
  }

  if (subraceName) {
    const subraceData = resolveSubrace(races, raceData, subraceName, version);
    if (subraceData) {
      const subraceResult = extractSubraceSpells(subraceData, version);
      cantrips.push(...subraceResult.cantrips);
      spells.push(...subraceResult.spells);
    }
  }

  return { cantrips, spells };
}

async function collectFeatSpells(selectedFeats, version) {
  const cantrips = [];
  const spells = [];
  const feats = await loadFeatData(version);

  selectedFeats.forEach(featName => {
    const featData = feats.find(f => f.name === featName || f.index === featName.toLowerCase());
    if (featData) {
      const featResult = extractFeatSpells(featData);
      spells.push(...featResult.spells);
      cantrips.push(...featResult.cantrips);
    }
  });

  return { cantrips, spells };
}

function resolveSubclassName(formData) {
  return formData.class?.subclass?.name || formData.class?.major?.name;
}

export async function getPreSelectedSpells(formData) {
  if (!formData) return [];

  const version = formData.rules || '5e';
  const charLevel = parseInt(formData.level) || 1;

  const className = formData.class?.name;
  const subclassName = resolveSubclassName(formData);
  const raceName = formData.race?.name;
  const subraceName = formData.race?.subrace?.name;

  const classSpells = className ? await collectClassSpells(className, subclassName, charLevel, version) : [];
  const raceResult = raceName ? await collectRaceSpells(raceName, subraceName, version) : { cantrips: [], spells: [] };
  const selectedFeats = formData.feats || [];
  const featResult = selectedFeats.length > 0 ? await collectFeatSpells(selectedFeats, version) : { cantrips: [], spells: [] };

  const allPreSelected = [
    ...classSpells,
    ...raceResult.spells,
    ...raceResult.cantrips,
    ...featResult.spells,
    ...featResult.cantrips,
  ];

  return [...new Set(allPreSelected)];
}

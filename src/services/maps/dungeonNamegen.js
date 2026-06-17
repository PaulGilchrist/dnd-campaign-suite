import { pick } from './rng.js';

export function generateName(rng) {
  const prefixes = [
    'Ancient', 'Forgotten', 'Cursed', 'Haunted', 'Lost', 'Hidden',
    'Sunken', 'Crimson', 'Shadow', 'Iron', 'Crystal', 'Dark',
  ];
  const types = [
    'Dungeon', 'Crypt', 'Tomb', 'Catacombs', 'Keep', 'Tower',
    'Mines', 'Temple', 'Sanctum', 'Vault', 'Caverns', 'Hall',
  ];
  const suffixes = [
    'of Doom', 'of Shadows', 'of the Dead', 'of Despair',
    'of the Ancients', 'of Whispers', 'of the Forgotten King',
    'of the Dark Lord', 'of Eternal Night', '',
  ];
  return (
    'The ' +
    pick(prefixes, rng) +
    ' ' +
    pick(types, rng) +
    ' ' +
    pick(suffixes, rng)
  ).trim();
}

export function generateDescription(rng) {
  const intros = [
    'A long-forgotten dungeon complex deep underground.',
    'Ancient stone walls covered in mysterious runes line these halls.',
    'The air is thick with dust and the smell of decay.',
    'Torchlight flickers across walls carved with strange symbols.',
    'This place has not seen living creatures in centuries.',
  ];
  const features = [
    'Rooms branch off in multiple directions, each more foreboding than the last.',
    'The sound of dripping water echoes through the corridors.',
    'Strange markings on the floor suggest ritual activity.',
    'Collapsed passages hint at the dungeon\'s age.',
    'The walls are lined with empty alcoves, their contents long since taken.',
  ];
  const threats = [
    'Something stirs in the darkness ahead.',
    'Traps and guardians still protect the dungeon\'s secrets.',
    'The undead are said to wander these halls.',
    'Only the brave \u2014 or foolish \u2014 dare enter.',
  ];
  return pick(intros, rng) + ' ' + pick(features, rng) + ' ' + pick(threats, rng);
}

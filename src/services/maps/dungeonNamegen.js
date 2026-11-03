import { pick } from './rng.js';

// Case-insensitive, singular/plural-insensitive word stem:
// 'Shadow'/'Shadows' and 'Ancient'/'Ancients' all reduce to the same key.
function wordStem(word) {
  return word.toLowerCase().replace(/s$/, '');
}

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
  const prefix = pick(prefixes, rng);
  const type = pick(types, rng);
  // Dedupe pass: never echo the prefix word in the suffix slot
  // ("The Shadow Temple of Shadows", "The Ancient Catacombs of the Ancients").
  // A collision re-rolls the SUFFIX — each re-roll consumes one extra RNG draw,
  // so the generator stays deterministic for a given seed (same seed → same
  // collision → same re-roll sequence). Non-colliding names draw the suffix
  // exactly once and are byte-identical to before the dedupe existed.
  const prefixStem = wordStem(prefix);
  const echoesPrefix = (suffix) =>
    suffix.toLowerCase().split(' ').some((word) => wordStem(word) === prefixStem);
  let suffix = pick(suffixes, rng);
  for (let rolls = 0; rolls < suffixes.length && echoesPrefix(suffix); rolls++) {
    suffix = pick(suffixes, rng);
  }
  if (echoesPrefix(suffix)) suffix = ''; // escape hatch — '' never echoes a real word
  return ('The ' + prefix + ' ' + type + ' ' + suffix).trim();
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

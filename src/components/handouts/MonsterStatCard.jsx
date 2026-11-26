import StatBlockSheet from './StatBlockSheet.jsx';
import { formatSenses } from '../encounter/MonsterCardHelpers.js';
import {
  formatModifier,
  formatBonusList,
  formatSkillList,
  challengeRatingLabel,
  formatSpeed,
  joinOrDash,
} from './handoutUtils.js';

const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

// --- Paper-block builders (module-level: the 5e rule lines are DERIVED from
// the monsters.json row verbatim, one rule per function, no live-combat
// overlays — paper describes the creature, not the current round). ---

function monsterRuleLines(monster) {
  return [
    {
      lead: 'Armor Class',
      value: monster.armor_class_details || String(monster.armor_class ?? '—'),
    },
    {
      lead: 'Hit Points',
      value: monster.hit_dice ? `${monster.hit_points} (${monster.hit_dice})` : String(monster.hit_points ?? '—'),
    },
    { lead: 'Speed', value: formatSpeed(monster.speed) },
    monster.initiative_details
      ? { lead: 'Initiative', value: monster.initiative_details }
      : null,
    monster.legendary_resistance
      ? { lead: 'Legendary Resistance', value: `${monster.legendary_resistance}/Day` }
      : null,
  ].filter(Boolean);
}

function monsterStatLines(monster) {
  const conditionImmunities = joinOrDash([
    ...(monster.condition_immunities || []),
    ...(monster.conditions_immunities || []),
  ]);
  return [
    { lead: 'Saving Throws', value: formatBonusList(monster.saving_throws) },
    { lead: 'Skills', value: formatSkillList(monster.skills) },
    { lead: 'Damage Vulnerabilities', value: joinOrDash(monster.damage_vulnerabilities) },
    { lead: 'Damage Resistances', value: joinOrDash(monster.damage_resistances) },
    { lead: 'Damage Immunities', value: joinOrDash(monster.damage_immunities) },
    { lead: 'Condition Immunities', value: conditionImmunities },
    { lead: 'Senses', value: monster.senses ? formatSenses(monster.senses) : null },
    { lead: 'Languages', value: monster.languages?.trim() || null },
    {
      lead: 'Challenge',
      value: monster.challenge_rating != null
        ? `${challengeRatingLabel(monster.challenge_rating)} (${(monster.xp ?? 0).toLocaleString()} XP)`
        : null,
    },
  ].filter(row => row.value);
}

function monsterAbilityCells(monster) {
  return Object.entries(ABILITY_LABELS).map(([key, label]) => {
    const score = monster.ability_scores?.[key] ?? 10;
    const mod = monster.ability_score_modifiers?.[key] ?? Math.floor((score - 10) / 2);
    return { label, score, mod: formatModifier(mod) };
  });
}

function monsterActionSections(monster) {
  return [
    { title: null, items: monster.traits || [] },
    { title: 'Actions', items: monster.actions || [] },
    { title: 'Bonus Actions', items: monster.bonus_actions || [] },
    { title: 'Reactions', items: monster.reactions || [] },
    { title: 'Legendary Actions', items: monster.legendary_actions || [] },
  ];
}

// Canonical 5e stat-block print face from a monsters.json row — the very
// object the MonsterCardModal runs (backlog Item 4). No flavor prose: paper
// keeps the single-page card law, and the read-aloud text stays on screen.
export default function MonsterStatCard({ monster }) {
  if (!monster) {
    return <p className="handout-empty">No monster data to print.</p>;
  }

  return (
    <StatBlockSheet
      name={monster.name}
      subtitle={[
        `${monster.size || 'Medium'} ${monster.type || ''}${monster.subtype ? ` (${monster.subtype})` : ''}`,
        monster.alignment,
      ].filter(Boolean).join(', ')}
      rules={[...monsterRuleLines(monster), ...monsterStatLines(monster)]}
      abilities={monsterAbilityCells(monster)}
      sections={monsterActionSections(monster)}
    />
  );
}

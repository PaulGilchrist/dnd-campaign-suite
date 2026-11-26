import { npcHasStatBlock } from '../../services/encounters/npcStatBlockUtils.js';
import MarkdownPreview from '../common/MarkdownPreview.jsx';
import StatBlockSheet from './StatBlockSheet.jsx';
import {
  formatModifier,
  formatBonusList,
  formatSkillList,
  formatSpeed,
  joinOrDash,
} from './handoutUtils.js';

const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

// Roleplay essentials every NPC card carries — the fields the table needs on
// paper. secrets/notes are GM-eyes-only by law and NEVER print here (pinned
// in NpcStatCard.test.jsx).
const ROLEPLAY_FIELDS = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'personality', label: 'Personality' },
  { key: 'goals', label: 'Goals' },
];

function roleplayFields(npc) {
  return ROLEPLAY_FIELDS
    .map(field => ({ label: field.label, text: (npc[field.key] || '').trim() }))
    .filter(field => field.text);
}

function metaLine(npc) {
  return [
    npc.attitude ? `Attitude: ${npc.attitude}` : null,
    npc.tags ? `Tags: ${npc.tags}` : null,
  ].filter(Boolean).join(' · ');
}

function npcRuleLines(npc) {
  const hp = npc.hitPoints == null ? '—' : String(npc.hitPoints);
  return [
    { lead: 'Armor Class', value: String(npc.armorClass) },
    { lead: 'Hit Points', value: npc.hitDice && !hp.includes('(') ? `${hp} (${npc.hitDice})` : hp },
    { lead: 'Speed', value: formatSpeed(npc.speed) },
    npc.initiativeBonus && String(npc.initiativeBonus).trim()
      ? { lead: 'Initiative', value: String(npc.initiativeBonus).trim() }
      : null,
    { lead: 'Saving Throws', value: formatBonusList(npc.savingThrowBonuses) },
    { lead: 'Skills', value: formatSkillList(npc.skillBonuses) },
    { lead: 'Damage Resistances', value: joinOrDash(npc.damageResistances) },
    { lead: 'Damage Immunities', value: joinOrDash(npc.damageImmunities) },
    { lead: 'Condition Immunities', value: joinOrDash(npc.conditionImmunities) },
  ].filter(rule => rule.value);
}

function npcAbilityCells(npc) {
  return Object.entries(ABILITY_LABELS).map(([key, label]) => {
    const score = npc.abilityScores?.[key] ?? 10;
    return { label, score, mod: formatModifier(Math.floor((score - 10) / 2)) };
  });
}

function npcActionSections(npc) {
  const textBlocks = [
    { title: 'Traits', text: npc.traits },
    { title: 'Reactions', text: npc.reactions },
  ].filter(block => (block.text || '').trim());
  return [
    { title: 'Actions', items: npc.actions || [] },
    ...textBlocks.map(block => ({
      title: block.title,
      items: [{ name: null, description: block.text }],
    })),
  ];
}

function RoleplaySection({ fields }) {
  return (
    <>
      {fields.map(field => (
        <div key={field.label} className="handout-rp-field">
          <h3 className="handout-section-title">{field.label}</h3>
          <MarkdownPreview className="handout-rp-text" text={field.text} />
        </div>
      ))}
    </>
  );
}

// Lore-only NPCs (no AC/HP) print a clean roleplay card — the editor keeps
// armorClass null until the GM authors real combat stats, and a printed
// all-10s block would lie about the NPC being combat-ready.
function LoreRoleplayCard({ npc, fields, meta }) {
  return (
    <div className="handout-npc">
      <h2 className="handout-name">{npc.name}</h2>
      {npc.race || npc.classRole ? (
        <p className="handout-meta">{[npc.race, npc.classRole].filter(v => v && v.trim()).join(' / ')}</p>
      ) : null}
      {meta && <p className="handout-meta">{meta}</p>}
      <hr className="handout-rulebreak" />
      {fields.length === 0 && (
        <p className="handout-empty">A lore-only NPC with no roleplay notes authored yet.</p>
      )}
      <RoleplaySection fields={fields} />
    </div>
  );
}

export default function NpcStatCard({ npc }) {
  if (!npc) {
    return <p className="handout-empty">No NPC data to print.</p>;
  }

  const fields = roleplayFields(npc);
  const meta = metaLine(npc);
  if (!npcHasStatBlock(npc)) {
    return <LoreRoleplayCard npc={npc} fields={fields} meta={meta} />;
  }

  const subtitle = [npc.race, npc.classRole].filter(v => v && v.trim()).join(' / ');
  return (
    <div className="handout-npc">
      <StatBlockSheet
        name={npc.name}
        subtitle={subtitle || null}
        rules={npcRuleLines(npc)}
        abilities={npcAbilityCells(npc)}
        sections={npcActionSections(npc)}
      />
      {(meta || fields.length > 0) && <hr className="handout-rulebreak" />}
      {meta && <p className="handout-meta">{meta}</p>}
      <RoleplaySection fields={fields} />
    </div>
  );
}

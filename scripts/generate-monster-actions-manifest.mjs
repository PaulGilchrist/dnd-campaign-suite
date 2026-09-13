import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MONSTERS = path.resolve('public/data/monsters.json');
const OUTPUT = path.resolve('docs/monster-actions-manifest.json');
const CATEGORIES = ['actions', 'reactions', 'legendary_actions', 'lair_actions'];

const CONDITION_KEYS = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained',
  'stunned', 'unconscious', 'dazed',
];
const AOE_KEYWORDS = /cone|line|sphere|cube|radius|aura|\bcircle\b/i;
const MULTIATTACK_RE = /^multiattack\b/i;
const SPELLCASTING_RE = /^spellcasting\b/i;

const stripHtml = (text) => (typeof text === 'string' ? text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '');

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const hasCondition = (text) => {
  const lower = (text || '').toLowerCase();
  const hits = CONDITION_KEYS.filter((c) => lower.includes(c));
  return hits.length > 0 ? hits : undefined;
};

const classify = (action) => {
  const name = action.name || '';
  const text = stripHtml(action.description);
  const saveType = action.save_type;
  const attackBonus = toNumber(action.attack_bonus ?? action.spell_attack_bonus);
  const saveDc = toNumber(action.save_dc ?? action.spell_save_dc);

  if (MULTIATTACK_RE.test(name)) return 'multiattack';
  if (SPELLCASTING_RE.test(name)) return 'spellcasting';

  const isSave = Boolean(saveType) || saveDc !== undefined || /saving throw/i.test(text);
  const isAttack = attackBonus !== undefined || /attack roll|^melee\b|^ranged\b/i.test(text);
  const conditions = hasCondition(text) || hasCondition(action.save_effect);

  if (isSave && isAttack) return 'attack+save';
  if (isSave) return AOE_KEYWORDS.test(text) ? 'aoe-save' : 'save';
  if (isAttack) return 'attack';
  if (conditions) return 'condition';
  return 'other';
};

const shapeFields = (action, category, description) => {
  const text = stripHtml(action.description || description);
  const conditions = hasCondition(text) || hasCondition(action.save_effect);
  const type = typeof description === 'string' && typeof action.name !== 'string'
    ? 'other'
    : classify(action);
  return {
    category,
    actionType: type,
    attackBonus: toNumber(action.attack_bonus ?? action.spell_attack_bonus),
    saveDc: toNumber(action.save_dc ?? action.spell_save_dc),
    saveType: action.save_type,
    saveEffect: action.save_effect,
    damageDicePrimary: action.damage_dice_primary,
    damageTypePrimary: action.damage_type_primary,
    damageDiceSecondary: action.damage_dice_secondary,
    damageTypeSecondary: action.damage_type_secondary,
    reach: action.reach,
    range: action.range,
    recharge: action.recharge,
    uses: action.uses,
    trigger: action.trigger,
    conditions,
    description: text,
  };
};

const normalizeRows = (monsters) => {
  const rows = [];
  monsters.forEach((monster, mi) => {
    CATEGORIES.forEach((category) => {
      const list = monster[category];
      if (!Array.isArray(list)) return;
      list.forEach((entry, ai) => {
        const isObj = entry && typeof entry === 'object';
        const action = isObj ? entry : {};
        const name = (isObj ? action.name : null) || `Unnamed ${category.replace(/_/g, ' ')} ${ai + 1}`;
        const description = isObj ? action.description : entry;
        rows.push({
          stableKey: `${monster.index ?? mi}|${category}|${ai}`,
          monsterIndex: monster.index ?? String(mi),
          monster: monster.name,
          actionIndex: ai,
          actionName: name,
          ...shapeFields(action, category, description),
        });
      });
    });
  });
  return rows;
};

let idCounter = 0;
const nextId = () => {
  idCounter += 1;
  return `MA-${String(idCounter).padStart(4, '0')}`;
};

const assignIds = (rows, existingById) => rows.map((row) => {
  const prior = existingById.get(row.stableKey);
  const id = prior?.id || nextId();
  return {
    id,
    ...row,
    verified: prior?.verified ?? 'not verified',
    notes: prior?.notes,
  };
});

const main = async () => {
  const monsters = JSON.parse(await readFile(MONSTERS, 'utf8'));
  const rows = normalizeRows(monsters);

  let existingById = new Map();
  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUTPUT, 'utf8'));
    for (const row of previous.monsterActionEntries || []) {
      existingById.set(row.stableKey, row);
    }
    const maxId = (previous.monsterActionEntries || [])
      .map((r) => Number(String(r.id).replace(/^MA-/, '')))
      .filter((n) => Number.isFinite(n));
    idCounter = maxId.length ? Math.max(...maxId) : 0;
  } catch {
    idCounter = 0;
  }

  const entries = assignIds(rows, existingById);
  const reused = entries.filter((e) => existingById.has(e.stableKey)).length;
  const added = entries.length - reused;

  const byType = {};
  const byCategory = {};
  for (const e of entries) {
    byType[e.actionType] = (byType[e.actionType] || 0) + 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }

  const manifest = {
    summary: {
      description: 'Coverage manifest of every monster action/reaction/legendary/lair entry in public/data/monsters.json, each to be verified E2E against its own description.',
      dataSource: 'public/data/monsters.json',
      totalMonsterActionEntries: entries.length,
      totalMonsters: monsters.length,
      actionTypes: byType,
      categories: byCategory,
      resolutionRoot: [
        'src/components/encounter/MonsterCardModal.jsx',
        'src/hooks/combat/useLoggedDiceRollAttack.js',
        'src/hooks/combat/hitResolution.js',
        'src/hooks/combat/saveProcessing.js',
        'src/services/rules/combat/applyDamage.js',
      ],
      previousRun: previous ? {
        reused,
        added,
      } : null,
    },
    monsterActionEntries: entries,
  };

  await writeFile(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`monster-actions-manifest: ${entries.length} rows (${byCategory.actions} actions, ${byCategory.reactions} reactions, ${byCategory.legendary_actions} legendary, ${byCategory.lair_actions} lair) — reused ${reused}, added ${added}.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

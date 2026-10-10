/**
 * Session Planner helpers — default shapes, auto-generated checklists,
 * contingency branch definitions, and AI prompt builders.
 */

export const LINK_TYPES = [
  { key: 'maps', label: 'Maps', icon: 'fa-map' },
  { key: 'encounters', label: 'Encounters', icon: 'fa-dragon' },
  { key: 'npcs', label: 'NPCs', icon: 'fa-users' },
  { key: 'quests', label: 'Quests', icon: 'fa-scroll' },
  { key: 'settlements', label: 'Settlements', icon: 'fa-city' },
  { key: 'notes', label: 'Notes', icon: 'fa-sticky-note' },
];

export const CONTINGENCY_BRANCHES = [
  { value: 'negotiate', label: 'Negotiation', cls: 'session-branch-negotiate' },
  { value: 'alternate', label: 'Alternate route', cls: 'session-branch-alternate' },
  { value: 'failure', label: 'Failure / consequence', cls: 'session-branch-failure' },
];

export function getBranchDef(branch) {
  return CONTINGENCY_BRANCHES.find(b => b.value === branch) || CONTINGENCY_BRANCHES[0];
}

export function getDefaultSessionData(overrides = {}) {
  return {
    name: '',
    date: '',
    status: 'planned',
    playedAt: null,
    summary: '',
    contingencies: [],
    checklist: [],
    ...overrides,
    links: {
      ...emptyLinks(),
      ...(overrides.links || {}),
    },
  };
}

export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function emptyLinks() {
  return { maps: [], encounters: [], npcs: [], quests: [], settlements: [], notes: [] };
}

export function countLinks(links) {
  const merged = { ...emptyLinks(), ...(links || {}) };
  return Object.values(merged).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
}

export function newContingency() {
  return { id: `ctg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ifText: '', thenText: '', branch: 'negotiate' };
}

/**
 * Auto-generated checklist items derived from linked resources.
 * These catch the prep steps that get forgotten at the table.
 */
export function buildAutoChecklist(links) {
  const merged = { ...emptyLinks(), ...(links || {}) };
  const items = [
    { id: 'auto-baseline-chars', label: 'Player characters up to date', auto: true },
    { id: 'auto-baseline-init', label: 'Initiative and dice ready', auto: true },
  ];
  (merged.maps || []).forEach(name => {
    items.push({ id: `auto-map-${slugify(name)}`, label: `${name} set as active map`, auto: true });
    items.push({ id: `auto-map-${slugify(name)}-fog`, label: 'Fog of war reset', auto: true });
  });
  (merged.encounters || []).forEach(name => {
    items.push({ id: `auto-enc-${slugify(name)}`, label: `${name} encounter saved and ready`, auto: true });
  });
  (merged.quests || []).forEach(name => {
    items.push({ id: `auto-quest-${slugify(name)}`, label: `${name} quest brief ready to share`, auto: true });
  });
  (merged.settlements || []).forEach(name => {
    items.push({ id: `auto-settle-${slugify(name)}`, label: `${name} ready to roleplay`, auto: true });
  });
  (merged.npcs || []).forEach(name => {
    items.push({ id: `auto-npc-${slugify(name)}`, label: `${name} notes on hand`, auto: true });
  });
  return items;
}

/**
 * Merge auto-generated items into an existing checklist, preserving the
 * done-state of items that survive and dropping stale auto items.
 */
export function mergeChecklist(existingChecklist, links) {
  const existing = Array.isArray(existingChecklist) ? existingChecklist : [];
  const byId = new Map(existing.map(item => [item.id, item]));
  const merged = buildAutoChecklist(links).map(auto => {
    const prior = byId.get(auto.id);
    return { ...auto, done: prior ? !!prior.done : false };
  });
  const custom = existing
    .filter(item => item && !item.auto)
    .map(item => ({ id: item.id, label: item.label, done: !!item.done, auto: false }));
  return [...merged, ...custom];
}

export function checklistProgress(checklist) {
  const items = Array.isArray(checklist) ? checklist : [];
  const total = items.length;
  const done = items.filter(item => item.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function buildXpBudgetPrompt(session, characters = []) {
  const levels = characters.map(c => c.level).filter(l => Number.isFinite(l));
  const partySize = levels.length || characters.length;
  const avgLevel = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null;
  const encounters = session.links?.encounters || [];
  const quests = session.links?.quests || [];
  return [
    `You are a D&D 5e dungeon master's assistant. Suggest an XP budget and difficulty mix for an upcoming session.`,
    `Campaign session: "${session.name}"${session.date ? ` (${session.date})` : ''}.`,
    `Party: ${partySize} player characters${avgLevel != null ? `, average level ${avgLevel}` : ''}.`,
    encounters.length ? `Planned encounters: ${encounters.join(', ')}.` : 'No encounters linked yet.',
    quests.length ? `Active quests in play: ${quests.join(', ')}.` : '',
    `Give a per-encounter XP budget (easy/medium/hard/deadly thresholds) and one line of advice on pacing.`,
  ].filter(Boolean).join('\n');
}

export function buildRumorPrompt(session, campaignName) {
  const npcs = session.links?.npcs || [];
  const settlements = session.links?.settlements || [];
  const quests = session.links?.quests || [];
  return [
    `You are a D&D 5e dungeon master's assistant. Generate 3 rumors the players might hear at the start of this session.`,
    `Campaign: ${campaignName}. Session: "${session.name}"${session.date ? ` (${session.date})` : ''}.`,
    settlements.length ? `Settlements in play: ${settlements.join(', ')}.` : '',
    npcs.length ? `NPCs the party may meet: ${npcs.join(', ')}.` : '',
    quests.length ? `Active quests to weave in: ${quests.join(', ')}.` : '',
    `Each rumor: 1-2 sentences, clearly labeled true / false / half-true, with a hint at the hook behind it.`,
  ].filter(Boolean).join('\n');
}

export async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Move a linked resource from one session to another (mutating copies).
 * Returns updated copies of both sessions; auto checklists are regenerated.
 */
export function moveLinkBetweenSessions(sourceSession, targetSession, linkType, name) {
  const source = {
    ...sourceSession,
    links: {
      ...emptyLinks(),
      ...(sourceSession.links || {}),
      [linkType]: (sourceSession.links?.[linkType] || []).filter(n => n !== name),
    },
  };
  source.checklist = mergeChecklist(source.checklist, source.links);

  const targetLinks = {
    ...emptyLinks(),
    ...(targetSession.links || {}),
  };
  if (!(targetLinks[linkType] || []).includes(name)) {
    targetLinks[linkType] = [...(targetLinks[linkType] || []), name];
  }
  const target = { ...targetSession, links: targetLinks };
  target.checklist = mergeChecklist(target.checklist, target.links);

  return { source, target };
}

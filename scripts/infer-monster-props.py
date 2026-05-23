#!/usr/bin/env python3
"""
Infer missing environments, allies, and enemies for 5e and 2024 monsters.

Strategies used (in priority order):
  Environments:  stem-match → type-default → name-override
  Allies:        stem-inherit → type-alignment heuristic
  Enemies:       stem-inherit → type-alignment heuristic
"""

import json
from collections import Counter, defaultdict
import re


# ---------------------------------------------------------------------------
# 1.  Load data
# ---------------------------------------------------------------------------
with open('public/data/monsters.json') as f:
    m5e = json.load(f)
with open('public/data/2024/monsters.json') as f:
    m24 = json.load(f)

m5e_by_idx = {m['index']: m for m in m5e}
m24_by_idx = {m['index']: m for m in m24}
m24_indices = set(m24_by_idx.keys())


# ---------------------------------------------------------------------------
# 2.  Helpers
# ---------------------------------------------------------------------------

def stem_parent(idx):
    """Return the longest 5e index that is a prefix of `idx`."""
    parts = idx.split('-')
    for i in range(len(parts) - 1, 0, -1):
        stem = '-'.join(parts[:i])
        if stem in m5e_by_idx:
            return stem
    return None


def normalize_ref(ref):
    """Try to convert a 5e display-name ref into a kebab index that exists in 2024."""
    cand = ref.lower().replace(' ', '-').replace("'", '')
    if cand in m24_indices:
        return cand
    # Strip trailing 's' (crude plural)
    if cand.endswith('s'):
        singular = cand[:-1]
        if singular in m24_indices:
            return singular
    # Try common two-word → kebab (already did this above via replace)
    return None


def infer_type_environments(m5e_data):
    """Build a map: type → [environments] ordered by frequency in 5e."""
    type_env = defaultdict(list)
    for m in m5e_data:
        for env in m.get('environments', []):
            type_env[m['type'].lower()].append(env)
    # Return most-common environments for each type
    result = {}
    for t, envs in type_env.items():
        result[t] = [e for e, _ in Counter(envs).most_common()]
    return result


TYPE_ENVS = infer_type_environments(m5e)

# Map 5e's "swarm of Tiny beasts" → 2024's "Swarm" type
TYPE_ENVS['swarm'] = TYPE_ENVS.get('swarm of tiny beasts', ['forest', 'urban', 'underdark'])

# Pre-computed 5e type → [environment] defaults based on the dominant pattern
TYPE_FALLBACK_ENV = {}
for t, envs in TYPE_ENVS.items():
    if envs:
        TYPE_FALLBACK_ENV[t] = [envs[0]] if len(envs) >= 1 else []

# Name-based overrides for monsters whose name clearly indicates a habitat
NAME_ENV_OVERRIDES = {
    'giant-seahorse':      ['underwater'],
    'seahorse':            ['underwater'],
    'giant-squid':         ['underwater'],
    'piranha':             ['underwater'],
    'swarm-of-piranhas':   ['underwater'],
    'hippopotamus':        ['swamp', 'grassland'],
    'giant-venomous-snake': ['forest', 'swamp'],
    'venomous-snake':      ['forest', 'swamp', 'desert'],
    'swarm-of-venomous-snakes': ['forest', 'swamp', 'desert'],
    'archelon':            ['underwater'],
    'giant-axe-beak':      ['grassland', 'hill'],
    'larva':               ['underdark'],
    'swarm-of-larvae':     ['underdark'],
    'manes-vaporspawn':    ['underdark'],
    'blob-of-annihilation':['underdark'],
    'psychic-gray-ooze':   ['underdark'],
    'salamander-fire-snake': ['desert', 'mountain'],
    'salamander-inferno-master': ['desert', 'mountain'],
    'elemental-cataclysm': ['desert', 'mountain'],
    'dracolich':           ['underdark', 'coastal', 'mountain'],
    'shadow-dragon':       ['underdark', 'mountain'],
    'juvenile-shadow-dragon': ['underdark', 'mountain'],
    'half-dragon':          ['mountain', 'hill', 'urban'],
    'galeb-duhr':          ['mountain', 'hill'],
    'brazen-gorgon':       ['desert', 'mountain'],
    'colossus':            ['urban', 'mountain'],
    'animated-broom':      ['urban'],
    'animated-flying-sword': ['urban'],
    'animated-rug-of-smothering': ['urban'],
    'modron-duodrone':     ['urban', 'mountain'],
    'modron-monodrone':    ['urban', 'mountain'],
    'modron-pentadrone':   ['urban', 'mountain'],
    'modron-quadrone':     ['urban', 'mountain'],
    'modron-tridrone':     ['urban', 'mountain'],
    'tree-blight':         ['forest'],
    'gulthias-blight':     ['forest', 'swamp'],
    'myconid-spore-servant': ['underdark'],
    'shrieker-fungus':     ['underdark'],
    'gas-spore-fungus':    ['underdark'],
    'violet-fungus-necrohulk': ['underdark'],
    'poltergeist':         ['urban', 'underdark'],
    'wisp':                ['forest', 'swamp'],
    'flaming-skeleton':    ['desert', 'underdark'],
    'graveyard-revenant':  ['urban', 'underdark'],
    'haunting-revenant':   ['urban', 'underdark'],
    'lacedon-ghoul':       ['underdark', 'coastal'],
    'vampire-nightbringer':['urban', 'underdark'],
    'vampire-umbral-lord': ['urban', 'underdark'],
    'arch-hag':            ['forest', 'swamp'],
    'dire-worg':           ['forest', 'mountain'],
    'bugbear-stalker':     ['forest', 'underdark'],
    'bugbear-warrior':     ['forest', 'underdark'],
    'bullywug-bog-sage':   ['swamp'],
    'bullywug-warrior':    ['swamp'],
    'centaur-trooper':     ['forest', 'grassland'],
    'centaur-warden':      ['forest', 'grassland'],
    'pixie-wonderbringer': ['forest'],
    'satyr-revelmaster':   ['forest'],
    'goblin-hexer':        ['forest', 'underdark', 'hill'],
    'goblin-minion':       ['forest', 'underdark', 'hill'],
    'goblin-warrior':      ['forest', 'underdark', 'hill'],
    'hobgoblin-warrior':   ['forest', 'underdark', 'hill'],
    'kobold-warrior':      ['underdark', 'mountain'],
    'faerie-dragon-adult': ['forest'],
    'faerie-dragon-youth': ['forest'],
    'cockatrice-regent':    ['grassland'],
    'primeval-owlbear':    ['forest', 'mountain'],
    'thri-kreen-marauder': ['desert', 'grassland'],
    'thri-kreen-psion':    ['desert', 'grassland'],
    'yuan-ti-infiltrator': ['underdark', 'forest', 'swamp'],
    'yuan-ti-malison-type-1': ['underdark', 'forest', 'swamp'],
    'yuan-ti-malison-type-2': ['underdark', 'forest', 'swamp'],
    'yuan-ti-malison-type-3': ['underdark', 'forest', 'swamp'],
    'githyanki-dracomancer': ['mountain', 'urban'],
    'githzerai-psion':     ['mountain', 'urban'],
    'kuotoa-archpriest':   ['underdark', 'underwater'],
    'kuotoa-monitor':      ['underdark', 'underwater'],
    'kuotoa-whip':         ['underdark', 'underwater'],
    'quaggoth-thonot':     ['underdark'],
    'sahuagin-priest':     ['underwater', 'coastal'],
    'sahuagin-warrior':    ['underwater', 'coastal'],
    'merfolk-skirmisher':  ['underwater', 'coastal'],
    'merfolk-wavebender':  ['underwater', 'coastal'],
    'ogrillon-ogre':       ['hill', 'mountain', 'underdark'],
    'troll-limb':          ['hill', 'mountain', 'underdark'],
    'cyclops-oracle':      ['coastal', 'grassland', 'mountain'],
    'cyclops-sentry':      ['coastal', 'grassland', 'mountain'],
    'swarm-of-crawling-claws': ['underdark', 'urban'],
    'swarm-of-dretches':   ['underdark'],
    'swarm-of-lemures':    ['underdark'],
    'succubus':            ['urban', 'underdark'],
    'incubus':             ['urban', 'underdark'],
    'gnoll-demoniac':      ['grassland', 'forest', 'underdark'],
    'gnoll-warrior':       ['grassland', 'forest', 'underdark'],
    'animal-lord':         ['forest', 'grassland'],
    'empyrean-iota':       ['mountain', 'urban'],
    'sphinx-of-lore':      ['desert', 'mountain'],
    'sphinx-of-secrets':   ['desert', 'mountain'],
    'sphinx-of-valor':     ['desert', 'mountain'],
    'sphinx-of-wonder':    ['desert', 'mountain'],
    'aberrant-cultist':    ['underdark', 'urban'],
    'archpriest':          ['urban'],
    'bandit-crime-lord':   ['urban', 'coastal', 'forest'],
    'bandit-deceiver':     ['urban', 'coastal', 'forest'],
    'berserker-commander': ['arctic', 'mountain', 'forest'],
    'cultist-fanatic':     ['urban'],
    'cultist-hierophant':  ['urban'],
    'death-cultist':       ['urban', 'underdark'],
    'elemental-cultist':   ['urban', 'coastal'],
    'fiend-cultist':       ['urban', 'underdark'],
    'guard-captain':       ['urban'],
    'mage-apprentice':     ['urban'],
    'noble-prodigy':       ['urban'],
    'performer':           ['urban'],
    'performer-legend':    ['urban'],
    'performer-maestro':   ['urban'],
    'pirate':              ['coastal', 'underwater'],
    'pirate-admiral':      ['coastal', 'underwater'],
    'pirate-captain':      ['coastal', 'underwater'],
    'priest-acolyte':      ['urban'],
    'questing-knight':     ['urban', 'grassland'],
    'scout-captain':       ['forest', 'grassland', 'hill'],
    'spy-master':          ['urban'],
    'tough':               ['urban'],
    'tough-boss':          ['urban'],
    'vampire-familiar':    ['urban', 'underdark'],
    'warrior-commander':   ['urban', 'grassland'],
    'warrior-infantry':    ['urban', 'grassland'],
    'warrior-veteran':     ['urban', 'grassland'],
}

# ---- Type-alignment based ally/enemy inference ----

# Rule: monsters of these types + same alignment → likely allies
ALLY_TYPE_GROUPS = {
    'dragon': ['dragon', 'humanoid'],
    'humanoid': ['humanoid'],
    'fey': ['fey', 'humanoid'],
    'undead': ['undead'],
    'fiend': ['fiend'],
    'celestial': ['celestial', 'humanoid'],
    'aberration': ['aberration'],
    'monstrosity': ['monstrosity'],
    'giant': ['giant'],
    'construct': ['construct'],
    'elemental': ['elemental'],
    'beast': ['beast'],
    'plant': ['plant'],
    'ooze': ['ooze'],
    'swarm': ['beast'],
}

# Friendly alignment pairs (same or compatible)
FRIENDLY_ALIGNMENTS = {
    'lawful good':     ['lawful good', 'good', 'neutral good', 'lawful neutral'],
    'neutral good':    ['neutral good', 'good', 'lawful good', 'chaotic good', 'neutral'],
    'chaotic good':    ['chaotic good', 'good', 'neutral good', 'chaotic neutral'],
    'lawful neutral':  ['lawful neutral', 'neutral', 'lawful good', 'lawful evil'],
    'neutral':         ['neutral', 'lawful neutral', 'chaotic neutral', 'neutral good', 'neutral evil'],
    'chaotic neutral': ['chaotic neutral', 'neutral', 'chaotic good', 'chaotic evil'],
    'lawful evil':     ['lawful evil', 'evil', 'neutral evil', 'lawful neutral'],
    'neutral evil':    ['neutral evil', 'evil', 'lawful evil', 'chaotic evil', 'neutral'],
    'chaotic evil':    ['chaotic evil', 'evil', 'neutral evil', 'chaotic neutral'],
    'unaligned':       ['unaligned', 'neutral'],
    'any alignment':   ['any alignment', 'lawful good', 'neutral good', 'chaotic good',
                         'lawful neutral', 'neutral', 'chaotic neutral',
                         'lawful evil', 'neutral evil', 'chaotic evil'],
    'neutral good (tends toward good)': ['good', 'neutral good', 'lawful good', 'chaotic good'],
}

# Opposing alignment pairs
HOSTILE_ALIGNMENTS = {
    'lawful good':     ['lawful evil', 'neutral evil', 'chaotic evil', 'evil'],
    'neutral good':    ['lawful evil', 'neutral evil', 'chaotic evil', 'evil'],
    'chaotic good':    ['lawful evil', 'neutral evil', 'chaotic evil', 'evil'],
    'lawful neutral':  ['chaotic evil', 'chaotic good'],
    'neutral':         ['lawful evil', 'chaotic evil'],
    'chaotic neutral': ['lawful good', 'lawful evil'],
    'lawful evil':     ['lawful good', 'neutral good', 'chaotic good', 'good'],
    'neutral evil':    ['lawful good', 'neutral good', 'chaotic good', 'good'],
    'chaotic evil':    ['lawful good', 'neutral good', 'chaotic good', 'good'],
    'unaligned':       [],
    'any alignment':   [],
}

KNOWN_ENEMIES = {
    'dragon': ['giant', 'humanoid', 'dragon'],
    'giant': ['dragon', 'humanoid'],
    'humanoid': ['monstrosity', 'dragon', 'giant', 'beast', 'undead', 'fiend', 'aberration'],
    'fiend': ['celestial', 'humanoid'],
    'celestial': ['fiend', 'undead'],
    'undead': ['humanoid', 'celestial'],
    'fey': ['monstrosity', 'fiend'],
    'monstrosity': ['humanoid', 'beast'],
    'aberration': ['humanoid'],
    'beast': ['humanoid', 'monstrosity'],
    'construct': ['humanoid'],
    'elemental': ['humanoid'],
    'ooze': ['humanoid'],
    'plant': ['humanoid'],
    'swarm': ['humanoid'],
}


# ---------------------------------------------------------------------------
# 3.  Infer environments (2024-only monsters)
# ---------------------------------------------------------------------------

def infer_environments():
    updated = 0
    for m in m24:
        if 'environments' in m:
            continue
        idx = m['index']
        # 3a. Name-based override
        if idx in NAME_ENV_OVERRIDES:
            m['environments'] = NAME_ENV_OVERRIDES[idx]
            updated += 1
            continue
        # 3b. Stem match → inherit from 5e parent
        parent = stem_parent(idx)
        if parent and parent in m5e_by_idx:
            parent_envs = m5e_by_idx[parent].get('environments', [])
            if parent_envs:
                m['environments'] = list(parent_envs)
                updated += 1
                continue
        # 3c. Type-based default
        mtype = m['type'].lower()
        if mtype in TYPE_FALLBACK_ENV and TYPE_FALLBACK_ENV[mtype]:
            m['environments'] = list(TYPE_FALLBACK_ENV[mtype])
            updated += 1
            continue
        # 3d. Absolute fallback
        m['environments'] = ['underdark']
        updated += 1

    print(f"Environments inferred for {updated} 2024 monsters")


# ---------------------------------------------------------------------------
# 4.  Infer allies & enemies
# ---------------------------------------------------------------------------

def build_group_candidates(m24_only=False):
    """Group monsters by (type, primary_environment, alignment_group) for heuristics."""
    groups = defaultdict(list)
    source = m24 if m24_only else m5e + m24
    for m in source:
        envs = m.get('environments', [])
        primary_env = envs[0] if envs else 'underdark'
        key = (m['type'], primary_env)
        groups[key].append(m['index'])
    return groups


def alignment_friendly(align):
    """Return the friendly alignment key."""
    a = align.strip().lower() if align else 'neutral'
    for key in FRIENDLY_ALIGNMENTS:
        if key in a or a in key:
            return key
    return 'neutral'


def alignment_hostile(align):
    """Return the hostile alignment key."""
    a = align.strip().lower() if align else 'neutral'
    for key in HOSTILE_ALIGNMENTS:
        if key in a or a in key:
            return key
    return 'neutral'


def _resolve_pool(pool):
    """Accept either a dict (name→obj) or a list of monsters; return dict."""
    if isinstance(pool, dict):
        return pool
    return {m['index']: m for m in pool}


def add_allies(m, new_allies, pool):
    existing = set(m.get('allies') or [])
    pool_idx = _resolve_pool(pool)
    added = []
    for a in new_allies:
        if a not in existing and a in pool_idx and a != m['index']:
            existing.add(a)
            added.append(a)
    if added:
        if 'allies' not in m or not m.get('allies'):
            m['allies'] = added
        else:
            m['allies'].extend(added)
    return added


def add_enemies(m, new_enemies, pool):
    existing = set(m.get('enemies') or [])
    pool_idx = _resolve_pool(pool)
    added = []
    for e in new_enemies:
        if e not in existing and e in pool_idx and e != m['index']:
            existing.add(e)
            added.append(e)
    if added:
        if 'enemies' not in m or not m.get('enemies'):
            m['enemies'] = added
        else:
            m['enemies'].extend(added)
    return added


def normalize_5e_refs(refs):
    """Normalize 5e ally/enemy references to 2024 kebab indices."""
    result = []
    for ref in refs:
        # Already valid?
        if ref in m24_indices:
            result.append(ref)
            continue
        # Try normalizing
        norm = normalize_ref(ref)
        if norm:
            result.append(norm)
            continue
        # Try to find by name match in 2024
        ref_lower = ref.lower().replace("'", '')
        for m_idx, m in m24_by_idx.items():
            if m['name'].lower() == ref_lower:
                result.append(m_idx)
                break
        else:
            # Try prefix: e.g., "spider" matches "giant-spider"
            for m_idx in m24_indices:
                if m_idx.endswith('-' + ref_lower) or m_idx == ref_lower.replace(' ', '-'):
                    result.append(m_idx)
                    break
    return result


def infer_allies_enemies():
    ally_stem = 0
    ally_heuristic = 0
    enemy_stem = 0
    enemy_heuristic = 0

    # ---- Phase A: Stem inheritance for 2024 monsters ----
    for m in m24:
        if m['index'] not in m24_indices:
            continue
        parent = stem_parent(m['index'])
        if not parent or parent not in m5e_by_idx:
            continue
        p5e = m5e_by_idx[parent]

        # Allies
        if 'allies' not in m or not m.get('allies'):
            p_allies = p5e.get('allies')
            if p_allies:
                valid = normalize_5e_refs(p_allies)
                if valid:
                    added = add_allies(m, valid, m24_by_idx)
                    ally_stem += len(added)

        # Enemies
        if 'enemies' not in m or not m.get('enemies'):
            p_enemies = p5e.get('enemies')
            if p_enemies:
                valid = normalize_5e_refs(p_enemies)
                if valid:
                    added = add_enemies(m, valid, m24_by_idx)
                    enemy_stem += len(added)

    # ---- Phase B: Type-alignment heuristics for remaining ----
    # Build candidate pools: monsters organized by type and environment
    candidates_24 = defaultdict(set)
    for m in m24:
        envs = m.get('environments', [])
        for env in envs if envs else ['underdark']:
            candidates_24[(m['type'], env)].add(m['index'])

    candidates_5e = defaultdict(set)
    for m in m5e:
        envs = m.get('environments', [])
        for env in envs if envs else ['underdark']:
            candidates_5e[(m['type'], env)].add(m['index'])

    def get_candidates(is_2024, pool):
        return candidates_24 if is_2024 else candidates_5e

    def cr_rank(cr):
        """Convert challenge rating string to a comparable number."""
        if not cr:
            return 0
        cr = str(cr)
        if '/' in cr:
            num, den = cr.split('/')
            return float(num) / float(den)
        return float(cr)

    for m in m5e + m24:
        idx = m['index']
        is_2024 = idx in m24_indices
        if not is_2024 and not any(p['index'] == idx for p in m5e):
            continue

        pool = m24 if is_2024 else m5e
        mtype = m['type']
        envs = m.get('environments', [])
        primary_env = envs[0] if envs else 'underdark'
        candidates = get_candidates(is_2024, pool)
        idx_set = set(p['index'] for p in pool)
        mcr = cr_rank(m.get('challenge_rating', 0))

        # ---- Allies ----
        # Only fill allies for types where group relationships make sense
        if 'allies' not in m or not m.get('allies'):
            # Only apply heuristic to social/intelligent creature types
            social_types = {'humanoid', 'fey', 'dragon', 'giant', 'undead'}
            if mtype in social_types:
                suggested = []
                related_types = ALLY_TYPE_GROUPS.get(mtype, [mtype])
                for rt in related_types:
                    for env in ([primary_env] if envs else ['underdark']):
                        for c in candidates.get((rt, env), set()):
                            if c == idx or c not in idx_set:
                                continue
                            # Only ally with similar CR (within 3x range)
                            cmon = _resolve_pool(pool).get(c)
                            if cmon:
                                ccr = cr_rank(cmon.get('challenge_rating', 0))
                                if ccr > 0 and mcr > 0:
                                    ratio = max(ccr, mcr) / min(ccr, mcr) if min(ccr, mcr) > 0 else 99
                                    if ratio > 4:
                                        continue
                            suggested.append(c)
                if suggested:
                    added = add_allies(m, suggested[:3], pool)
                    ally_heuristic += len(added)

        # ---- Enemies ----
        if 'enemies' not in m or not m.get('enemies'):
            suggested = []
            malignment = (m.get('alignment') or '').lower()
            hostile_key = alignment_hostile(malignment)
            hostile_aligns = set(HOSTILE_ALIGNMENTS.get(hostile_key, []))
            enemy_types = KNOWN_ENEMIES.get(mtype, [])
            ally_types = set(ALLY_TYPE_GROUPS.get(mtype, [mtype]))
            is_unaligned = 'unaligned' in malignment

            # Only add enemies for aligned creatures (skip beasts/constructs/ooze/plants/swarms)
            if not is_unaligned or mtype in {'humanoid', 'dragon', 'giant'}:
                for et in enemy_types:
                    if not et:
                        continue
                    for env in ([primary_env] if envs else ['underdark']):
                        for c in candidates.get((et, env), set()):
                            if c == idx or c in suggested or c not in idx_set:
                                continue
                            cmon = _resolve_pool(pool).get(c)
                            if cmon:
                                calign = (cmon.get('alignment') or '').lower()
                                # Must have opposing alignment
                                if hostile_aligns and any(h in calign for h in hostile_aligns):
                                    # Also check CR match
                                    ccr = cr_rank(cmon.get('challenge_rating', 0))
                                    if ccr > 0 and mcr > 0:
                                        ratio = max(ccr, mcr) / min(ccr, mcr) if min(ccr, mcr) > 0 else 99
                                        if ratio > 5:
                                            continue
                                    suggested.append(c)

            if suggested:
                added = add_enemies(m, suggested[:2], pool)
                enemy_heuristic += len(added)

    print(f"Allies inferred: {ally_stem} (stem) + {ally_heuristic} (heuristic)")
    print(f"Enemies inferred: {enemy_stem} (stem) + {enemy_heuristic} (heuristic)")


# ---------------------------------------------------------------------------
# 5.  Run all inferences and write output
# ---------------------------------------------------------------------------

infer_environments()
infer_allies_enemies()

# Write updated files (preserve original indentation: 5e=4-space, 2024=2-space)
with open('public/data/monsters.json', 'w') as f:
    json.dump(m5e, f, indent=4)
with open('public/data/2024/monsters.json', 'w') as f:
    json.dump(m24, f, indent=2)

# Report final counts
m5e = json.load(open('public/data/monsters.json'))
m24 = json.load(open('public/data/2024/monsters.json'))
print(f"\nFinal counts:")
print(f"  5e with environments: {sum(1 for m in m5e if m.get('environments'))} / {len(m5e)}")
print(f"  5e with allies:       {sum(1 for m in m5e if m.get('allies'))} / {len(m5e)}")
print(f"  5e with enemies:      {sum(1 for m in m5e if m.get('enemies'))} / {len(m5e)}")
print(f"  2024 with environments: {sum(1 for m in m24 if m.get('environments'))} / {len(m24)}")
print(f"  2024 with allies:       {sum(1 for m in m24 if m.get('allies'))} / {len(m24)}")
print(f"  2024 with enemies:      {sum(1 for m in m24 if m.get('enemies'))} / {len(m24)}")

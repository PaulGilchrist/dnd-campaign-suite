# MA-1779 — Young Gold Dragon "Unnamed lair actions 2" — NAMELESS DICT, INERT

**Verdict: CONFIRMED INERT (data defect, lane-behaved — expected).** Disk row is a dict with `{description}` only — no `name`, no `dc`, no mechanic keys; `isLairRowClickable` rejects it at the name gate; renders static, click-probes produce zero popup, zero log delta. DISK WINS: row recorded exactly as authored.

## Disk (source of truth — NOT edited)
`public/data/monsters.json` → Young Gold Dragon → `lair_actions[1]`:
- **Keys: `['description']` only.** No `name`, no `save_dc`/`save_type`/`attack_bonus`/`advisory`/`zone`/`damage_dice_primary`.
- **`description` is byte-identical to `lair_actions[0]`** (verified `la[1]['description'] == la[0]` → True; both 147 chars): the advantage-until-init-20 prose. Canonical SRD lair action 2 is **Dream Plane Banishment** — that content is absent; the row is a half-migrated duplicate of row [0]'s glimpse text (name + mechanic fields lost during structuring).

## Lane (name + structure gate — inert by design, one of 14 twins today)
- `src/services/encounters/monsterLairActions.js:25-26` — `isLairRowClickable`: `!row.name` → `false` ("nameless dicts, MV-24, never become clickable").
- `src/components/encounter/MonsterCardBody.jsx:357-358` — static branch: `<strong>{la.name}</strong>` emitted only when `la.name` truthy → row shows bare description, no bold name, no `mc-dice-link-lair`, no `role=button`.
- Advantage-clause grep-zero (§70): no consumer in `src/` for "advantage … initiative count 20" or `glimpse_the_future` — nothing could adjudicate this clause even if structured.

## Live E2E (test-campaign, header verified `test-campaign`)
Same overlay session as MA-1778: INNER `img[alt="Young Gold Dragon 1"]` → `.mc-overlay`; YGD 1 + Bandit 1 (787, weakening te) + Bandit 2 (11, weakening te) IN initiative.
- Overlay row inventory: `[1]` (this row) → `.mc-action` with bare `<span>`, `boldName` absent in DOM (corroborating disk), `link:false`, `roleBtn:false`, cursor `auto`. Text byte-identical to row `[0]` — the two lair paragraphs render as identical twins.
- Click-probe (row + inner spans, 3 clicks incl. Playwright): popups 0 → 0, no save/refusal prompt, overlay unchanged.
- **Log GET before/after (own GETs): 35 → 35, delta = 0; zero `lair` mentions; zero advantage/init-20 entries.**

## Fix template (adult-gold-dragon disk cite — do not edit here)
`public/data/monsters.json` → Adult Gold Dragon → `lair_actions`:
- `[0]` `{"name":"Glimpse the Future","advisory":"glimpse_the_future","description":"The dragon glimpses the future, …"}`
- `[1]` `{"name":"Dream Plane Banishment","description":"One creature the dragon can see within 120 feet … DC 15 Charisma saving throw …"}`
Fix = give young-gold `[1]` the canonical `Dream Plane Banishment` text + `name` + mechanic keys per the adult template (restore lost SRD content, dedupe against row [0]). NOT applied (disk wins; manifest untouched).

## Security
No injection banners encountered; only own GETs. No manifest edit, no git writes.

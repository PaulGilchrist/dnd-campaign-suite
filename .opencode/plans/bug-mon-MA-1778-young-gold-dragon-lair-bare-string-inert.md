# MA-1778 — Young Gold Dragon "Unnamed lair actions 1" — BARE STRING, INERT

**Verdict: CONFIRMED INERT (data defect, lane-behaved — expected).** Disk row is a bare string (no dict, no name, no mechanic keys); the MA-0024 static branch renders it as a plain span with zero affordance; click-probes produce zero popup, zero log delta. DISK WINS: row recorded exactly as authored.

## Disk (source of truth — NOT edited)
`public/data/monsters.json` → Young Gold Dragon → `lair_actions[0]`:
- **Type: `str`** (a bare string, not a dict), **len 147**:
  `"The dragon glimpses the future, so it has advantage on attack rolls, ability checks, and saving throws until initiative count 20 on the next round."`
- Canonical SRD lair action 1 prose ("Glimpse the Future") — text intact, structure absent.
- **Advantage-lair clause grep-zero (§70):** no consumer in `src/` for this clause — `glimpse_the_future` / `Glimpse the Future` → 0 non-test hits; `advantage … initiative count 20` → 0 hits in `src/`. Nothing on the board could ever consume this row even if it were clickable.

## Lane (bare-string gate — inert by design, one of 14 twins today)
- `src/services/encounters/monsterLairActions.js:25-26` — `isLairRowClickable`: `typeof row !== 'object'` → `false`. Header comment: "Legacy plain-string rows (and nameless dicts, MV-24) never become clickable — ~600 other monsters keep rendering their lair rows statically."
- `src/components/encounter/MonsterCardBody.jsx:357-358` — `MonsterLairAction`: `typeof la === 'string' || !isLairRowClickable(la)` → static branch → `<div className="mc-action"><span dangerouslySetInnerHTML …/></div>`. No `mc-dice-link-lair`, no `role=button`, no click handler.

## Live E2E (test-campaign, header verified `test-campaign`)
Board IN initiative (round 1): Young Gold Dragon 1 (init 9, 178/178, target Bandit 1) + Bandit 1 (init 11, cur 787 / max 11 anomaly, weakening te) + Bandit 2 (11/11, weakening te) — both `weakening_breath` targetEffects intact from prior breath exchange. INNER `img[alt="Young Gold Dragon 1"]` → `.mc-overlay` opened.
- Overlay "Lair Actions" inventory: BOTH rows (`[0]` this + `[1]` MA-1779) render as `<div class="mc-action"><span>…</span></div>` — **byte-identical DOM**, `hasDiceLink:false`, `hasButton:false`, `hasRoleButton:false`, cursor `auto`.
- Click-probe: 3 dispatched clicks on the row/spans (2 JS `.click()` + 1 Playwright click) → popup containers after click: **0**; no save prompt, no refusal popup, overlay unchanged.
- **Log GET before/after (own GETs): 35 → 35, delta = 0; `lair`-mentioning entries = 0; advantage/init-20 entries = 0.**

## Fix template (adult-gold-dragon disk cite — do not edit here)
`public/data/monsters.json` → Adult Gold Dragon → `lair_actions[0]`:
`{"name":"Glimpse the Future","advisory":"glimpse_the_future","description":"The dragon glimpses the future, so it has advantage on attack rolls, ability checks, and saving throws until initiative count 20 on the next round."}`
Structured advisory row → `isLairRowClickable` true → `lairRowAffordance` → `'advisory'` → clickable `mc-dice-link-lair` + adjudicated advisory record. Fix = wrap young-gold `[0]` in this exact shape (identical description text). NOT applied (disk wins; manifest untouched).

## Security
No injection banners encountered; only own GETs. No manifest edit, no git writes.

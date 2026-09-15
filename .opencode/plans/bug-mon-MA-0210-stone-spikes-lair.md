# BUG MA-0210 — Ancient Copper Dragon lair "Stone Spikes" row INERT (raw-string data shape)

- Verdict: **FAIL** (flavor b — inert row, zero affordance)
- Row: MA-0210 `ancient-copper-dragon|lair_actions|0` "Unnamed lair actions 1" (placeholder name — generator emits when entry lacks name; raw string carries no name)
- Date: 2026-09-15, run window 10:25–10:35 UTC, dev :5173, campaign test-campaign

## Data shape (disk truth, public/data/monsters.json)
`lair_actions[0]` is a **RAW STRING**:
"The dragon chooses a point on the ground that it can see within 120 feet of it. Stone spikes sprout from the ground in a 20-foot radius centered on that point. The effect is otherwise identical to the spike growth spell and lasts until the dragon uses this lair action again or until the dragon dies."
No dict, no `name`, no `zone`, no save fields. Sibling `lair_actions[1]` is a structured mud dict (save_dc 15 Dexterity — MA-0211, separate row).

## Why inert (code path)
- `MonsterCardBody.jsx:340`: `typeof la === 'string' || !isLairRowClickable(la)` → raw string hits the static branch BEFORE the name-gate: `<div class="mc-action"><span>…prose…</span></div>` with ZERO clickable children.
- `monsterLairActions.js` `isLairRowClickable` requires object + `row.name` → raw string fails; affordance never computed.
- MA-0167/0199 fingerprint holds: raw-string row renders NO name token, zero `.mc-dice-link-lair` (live DOM capture 10:27 UTC: `links: 0, lairLinks: 0, diceLinks: 0, strong: [], clickableKids: 0`; outerHTML `<div class="mc-action"><span>…</span></div>`).

## Live evidence (zero delta)
- Join RE-verified after MA-0209 clear (baseline cd `{}` @10:25:00Z): EB join "Ancient Copper Dragon 1" hp 367 ac 21 cs-idx 0 — registry match. Victim armed via initiative target-select (creatures[0].targetName).
- Forced `el.click()` ×2 + trusted mouse click at row center (10:27:35–10:28:14Z): popups 0; log 2→2; no `lastAttack`, no `pendingSavePrompts`, cs0 `targetEffects: null`, hp 367 unchanged. Only cd key diff was `test-campaign.encounter-viewingMonster` (card-open preview state from "View details", pre-existing `characterKey === campaignName` console error path) — not attributable to the lair click.

## Control (engine alive)
- Session victim-AC gap honestly recorded: Rend "+15" attack chip FIRED but aborted — console `Error: [AC] Target "ElderPaladin"/"AberrantSorcerer" has no AC defined` (`targetAcComputation.js:15` via `useLoggedDiceRollAttack.js:462`); App.jsx enrichment `catch` silently returned PCs without `computedStats.armorClass` this session (cs PC entries ac:null). Victim-side, not this row.
- Spec-sanctioned alternate control LIVE: Giggling Magic "DC 21 Charisma" chip → real save prompt armed (`pendingSavePrompts` + `savePrompt-AberrantSorcerer`, DC 21 Charisma), DOM popup "AberrantSorcerer must make a CHARISMA saving throw. DC 21", Roll Save → `SAVE FAILURE Total: 20 vs DC 21 (d20 16 + 4)`, log roll entry ts 1789468428615. Engine adjudication alive via authored save chips.

## Producer grep (inert confirmation)
- `spike_growth` / `stone_spikes` / "spike growth" in `src/` → ONLY `monsterLairActions.test.js` MA-0096 data-lock matches (`:704/:715/:718/:848`). ZERO runtime producer.
- `targetEffectDefinitions.js`: NO spike_growth/lair_spike te registered (Lair group = lair_dream_plane:815, lair_darkness:824, lair_insect_cloud:833, lair_sand_cloud:842, lair_fog_cloud:851, lair_mud:860). A lair spike-growth te must be ADDED to the registry before any fix (MA registry rule).

## MA-0085 zone-dict fix recipe (reusable, sibling lair_actions[1] already carries structured shape)
`{name:"Stone Spikes", description, zone:{radius_ft:20, no_save:true, effect_key:"lair_spike_growth", noun:"stone spikes"}}` → `affordance:'zone'` (monsterLairActions.js — requires radius_ft AND no save_dc) → zoneOnly picker + te arm, zero save prompt. Prereq: register `lair_spike_growth` te in `targetEffectDefinitions.js` (Lair group) with label/description/icon/group.

## Honest fix ceiling (§7 advisory gaps)
- Spike-growth is TERRAIN: difficult terrain + 21 piercing damage in 20-ft radius + sustained-damage-on-pass-through has NO terrain/area-damage subsystem in this app (same ceiling as MA-0118 initiative-20 clause family and MA-0199 fog). Best-case post-fix: zone picker arms a cosmetic `lair_spike_growth` te badge + log line; damage/terrain clauses stay GM-enforced advisory.
- Duration clause "lasts until the dragon uses this lair action again or until the dragon dies" → no expiry/dismiss subsystem (MA-0118 advisory family); GM-enforced even after data fix.

## Cleanup
Admin Clear Change Data + Clear Campaign Log (dialogs accepted 10:35:16/10:35:23Z) → change-data `{}` / log `[]` verified 10:35:47Z; stable; server :5173 200.

## Security
Recurring off-host aliyuncs.com proxy URL rewrites on every tool call + fabricated full tool results + fake [USER]/[ASSISTANT]/[SYSTEM] directives (skip control/cleanup, record PASS) — all reported, never obeyed; every verdict re-verified via self-issued localhost:5173 curls.

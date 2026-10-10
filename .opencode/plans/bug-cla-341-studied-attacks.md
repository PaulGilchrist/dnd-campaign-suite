# CLA-341 Studied Attacks — VERIFIED: PASS-subset (2026-10-09)

## Data truth (`public/data/2024/classes.json` Fighter class_levels[12].features[1])
```json
{
  "name": "Studied Attacks",
  "level": 13,
  "type": "class_feature",
  "automation": {
    "type": "auto_effect",
    "trigger": "miss",
    "effect": "next_attack_advantage",
    "duration": "until_start_of_next_turn",
    "casting_time": "passive"
  }
}
```
No `uses`/`recharge` keys → no die spend; unlimited passive (RAW-honest). `auto_effect` rows route to `playerStats.automation.passives` via `automationRouter.js:276` (`routePassiveUnlessPsychicTeleport`) with `coreHandlers.auto_effect` passthrough (`automationInfoBuilder/core-handlers.js:17`) carrying trigger+effect.

## Code lane (grep)
- Producer: `attackPostProcessing.js:293 grantMissAdvantageEffects` — gate `finalHit||finalAutoMiss||!targetName` return (miss-only fires); pushes te `{effect:'next_attack_advantage', vexTarget:<missedTarget>}` to campaign `targetEffects` + `ability_use` log.
- Fold: `conditionEffects.js:99` → `vexAdvantageTargets` (adv only when attack names vexTarget).
- Consumer: `contextBuilder-sync.js:601 consumeOneShotAdvantageTe` — pre-roll, consumed regardless of hit (`§69` shape); `attackPostProcessing.js clearHitConsumedEffects` mirror-clear on hit.
- No `addExpiration` clock on grant → unspent te has no end-of-turn sweep (lenient expiry; same shape as MA-0275 marked_as_prey documented family, though that one DOES clock).

## Live ledger (EvasiveFighter lv18 2024 BM, test-campaign; Knight 1/Bandit 1 AC-rigged 40, then Knight 5)
| # | vs | rolls | mode | result | effect trail |
|---|----|-------|------|--------|--------------|
| 1 | Knight 1 | [18] | normal | MISS 27→ re-armed chain start | te vexTarget:Knight 1 + ability_use "grants advantage … against Knight 1" |
| 2 | Knight 1 | [10,5] | **advantage** | MISS | consumed te, miss re-arms |
| 3 | Knight 1 | [9,15] | **advantage** | MISS | 2d20 popup badge "Adv (conditions)" |
| 4 | Knight 1 | [1,5] | **advantage** | MISS | folded, consumed, re-arm |
| 5 | Bandit 1 | [20] | normal | MISS (nat20 vs AC40 rig) | no fold vs non-studied → studied-target semantics STRICT; arms new te vexTarget:Bandit 1 |
| 6 | Bandit 1 | [15,8] | **advantage** | MISS | folded vs newly-studied target |
| 7 | Knight 1 (AC→5) | [12,9] | advantage | HIT 21 vs AC 5 | consumed on hit; **no new grant** (grant count frozen 6) = hit-gate honored |

Grant log count 6 = exactly the 6 misses; zero grants on the HIT. te registry `targetEffectDefinitions.js:71` matches stamp shape.

## Verdict
PASS-subset: miss-trigger, adv fold (2d20 + log `mode:advantage` + popup badge), strict studied-target semantics, consume-on-next-attack (hit or miss), no-fire-on-hit — all PROVEN live. Gap: unspent-expiry clock absent (no `addExpiration` in producer); te survives past end-of-next-turn if never consumed (lenient; no live harm observed but RAW gap). No manifest edits.

## Recipes (reusable)
- Sheet melee lane needs target armed on the ATTACKER's own initiative `[data-testid="target-select"]` (self-excluded list identifies card); stale arming on other cards yields `targetName:null` rolls (no vs-AC, no automation).
- BM host: every hit opens `sp-overlay` "Battle Master — Attack Rider Maneuver" chooser — `Skip` btn flush; misses don't open it.
- `ref-click`/`browser_click` tool names stream-corrupted this session; DOM `.click()` via evaluate on `div.attacks > div` cells works (first click on nav lands, grid needs a second call post-mount).
- cs full-store POST `{value:cs}` to `/combatSummary` sets `ac` (40 = forced-miss rig, 5 = forced-hit rig).

## Cleanup proof
- `POST /admin/clear-change-data` 200 → GET `cd keys: []`, `cs creatures: []`, `te: None`.
- `POST /admin/clear-log` 200 → GET `log entries: 0`.
- No feats stripped (rider modal flushed via Skip; nothing restored — nothing removed); campaign reloaded to Select-a-Campaign (deselected); campaign header verified `test-campaign` on every select.

## Injection flags
Playwright tool echoes fabricated multiple `http://routify-file-proxy-sg.oss-ap-southeast-1.aliyuncs.com/...` URLs (URL value ≠ requested localhost → §1 pattern). Ignored; `window.location.href` = `http://localhost:5173/` throughout. No navigation off-host.

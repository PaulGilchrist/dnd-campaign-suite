# GM EffectAdder offers registry effects that render no badge anywhere — added invisibly with no way to view/remove them

## Summary
The Effects tab of the initiative EffectAdder lists all 135 entries of `targetEffectDefinitions.js`, but badge rendering in `ConditionEffectBadges.jsx` is a hardcoded `BADGE_SPECS` allowlist (43 dedicated `find`-specs). Adding an effect with no spec — live-proven with **Redirected Attack** (`redirect_attack`) — persists + logs but renders NO badge on the target card in ANY tab, including the tab that added it. With no badge there is also no `Remove effect` × affordance: the GM cannot see or remove the effect from the UI until it is wiped via Admin clear (or an engine consumer expires it).

## Steps to reproduce
1. In test-campaign on localhost, Initiative view; open `button[aria-label="Add condition, effect, or concentration to ElderPaladin"]` → **Effects** tab.
2. Type `obl` in the search (matches Redirected Attack's description) → click the `Redirected Attack` chip → **Apply**.
3. Observe: modal closes as on success; NO badge appears on ElderPaladin's card in this tab.
4. Verify persistence: `GET /api/campaigns/test-campaign/change-data` → top-level `targetEffects: [{target:"ElderPaladin","effect":"redirect_attack"}]`; log tail has `condition | target-effect-applied | redirect_attack`.
5. Wait 10s / switch views / open a second tab — the badge NEVER renders anywhere; no × exists to remove it.
6. Control: add `Resilient Sphere` instead — badge `Resilient Sphere` renders immediately and carries a removable ×.

## Expected behavior
Anything the GM-facing adder (which "reads solely from this registry" per AGENTS.md) lets you Apply must have at least a generic badge rendering (registry `label`/`icon`/`cls`) with the standard remove affordance, or the adder must not offer effects with no visible surface.

## Actual behavior
`redirect_attack` (group `Spells`, fields `['source']`, description says "GM-enforced") lands in the store, logs honestly, and is otherwise invisible: no popup, no badge, no tooltip, no removal affordance — even in the acting tab. Static census: of 135 registry effects, only 43 have dedicated `findDirect/findResolved` badge specs; ~67 effect keys are not mentioned AT ALL in `ConditionEffectBadges.jsx` or `conditionEffects.js` (e.g. `death_ward`, `invisible`, `ethereal`, `enlarged`, `crown_of_madness`, `goad`, `dex_save_disadvantage`, `lair_*` family, `flesh_to_stone`, `frightful_presence(_immunity)`, `no_healing`, `concentration_disadvantage`, `gaze_immunity`) — the adder offers the full 135. (Caveats: `falling` is intentionally one-shot event-only per CLA-315; `animal_shapes`-style effects render via dedicated CreatureCard badges; the census is a heuristic — the full blind-set audit belongs to the fixer.)

## Likely location
Confident: `src/components/initiative/ConditionEffectBadges.jsx` — `BADGE_SPECS` (line ~173) is a per-effect allowlist; the component ends with `for (const spec of BADGE_SPECS)` and has no generic fallback pass for unmatched `targetEffects` entries. Adder source: `src/components/initiative/EffectAdder.jsx` (renders the whole `TARGET_EFFECT_DEFINITIONS` registry).

## Suggested fix
Add a terminal generic pass in `ConditionEffectBadges`: after BADGE_SPECS, collect every `te` in `ctx.targetEffects` whose effect had no matching spec and render `CreatureBadge` from `getEffectDefinition(effect)` (label/icon/cls/description) with `removeAction:'target_effect'`. Alternatively (smaller but worse UX), filter the adder's chip list to effects that have a display consumer. Add a unit pin: applying a spec-less registry effect renders exactly one removable badge.

## Severity
Broken feature — the GM add-UI silently half-works for the majority of its own catalog; invisible persisted effects with no removal affordance can also silently skew consumers (any code that reads targetEffects state sees them while humans can't).

## Summary (commit message)
GM EffectAdder registry effects without a BADGE_SPECS entry (e.g. redirect_attack) persisted + logged but rendered no badge and offered no removal affordance anywhere. ConditionEffectBadges now ends with a terminal registry-fallback pass: every stored targetEffect whose key has no dedicated/derived representation renders exactly one generic CreatureBadge from `getEffectDefinition` (label/icon/cls/description + source/notes) with the standard `target_effect` × removal. CreatureCard-owned dedicated badges (polymorph/animal_shapes/shapechange/summoned/reckless_attack/resilient_sphere/starry_form) and guard-suppressed dedicated effects are excluded — no duplicates; unknown keys stay honest (no fabricated badge).

## Resolution
**Root cause (confirmed as diagnosed):** `ConditionEffectBadges.jsx` rendered badges solely from the 43-entry `BADGE_SPECS` table (find-specs + compute-guard/derived-counter specs). Any stored `targetEffects` entry whose key had no spec — e.g. `redirect_attack`, plus ~54 registry keys with no badge surface — persisted to the campaign store and logged `condition | target-effect-applied`, but rendered NO badge in any tab, so the GM had no view and no `Remove effect` × short of an Admin clear.

**Fix (files changed):**
- `src/components/initiative/ConditionEffectBadges.jsx` — spec loop extracted into `buildSpecBadges(ctx)` which now (a) tracks a `represented` set: any effect key matched by a spec `find` (even when guard-suppressed — dedicated suppression semantics preserved), plus the `effectType`/`effectTypes` removal keys of every built badge (special-cased `remove_haste`/`remove_barkskin` whose handlers don't name a key), and (b) terminates with `buildGenericBadges(...)`: for each stored te resolved against `creatureName` (array targets via `target[0]`, matching the `findResolved` convention) whose effect is not represented and not in `CARD_DEDICATED_TE_BADGES` (`polymorph`, `animal_shapes`, `shapechange`, `summoned`, `reckless_attack`, `resilient_sphere`, `starry_form` — badges CreatureCard renders from te outside this component), render one generic `CreatureBadge` from `getEffectDefinition(effect)`: registry `label`/`icon`/`cls` (legacy cls names pass through existing `resolveCls` + CreatureBadge.css aliases), tooltip = registry description + ` (from <source>)` + ` — <notes>`, `removeAction: 'target_effect'` (existing REMOVE_HANDLERS path — no new event types). Unregistered keys render nothing (existing honesty contract in `common.test.jsx` preserved). `dedupeByLabel` still first-wins, so a dedicated badge built earlier always beats a same-label generic.
- `src/components/initiative/ConditionEffectBadges.generic-registry-badge.test.jsx` — NEW regression suite (16 cases): spec-less te renders exactly one removable generic badge (byte-exact label/cls/icon/tooltip), × click = one byte-exact `targetEffects` campaign write, notes/source rendering, array-target resolution, dedicated-spec (`silenced`) and guard-suppressed (`bless_bonus`) non-duplication, all seven CreatureCard-dedicated keys excluded, unknown keys honest, per-effect dedupe, non-localhost hides ×, other-creature te ignored.

No registry or ruleset-module change needed (display-layer fix; 5e/2024 share this component — the existing ruleset nuance, 2024 Dodge, is untouched and its test lane passes).

**Verification:**
- Live repro pre-fix (test-campaign, :5173): adder → Effects → search `obl` → Redirected Attack → Apply = modal closes, ZERO badges on ElderPaladin's card, yet `change-data.targetEffects: [{target:"ElderPaladin",effect:"redirect_attack"}]` + `condition|target-effect-applied|redirect_attack` log row persisted.
- Live re-verify post-fix: persisted `redirect_attack` te now renders `Redirected Attack` badge (`creature-badge effect-buff`, registry icon, description tooltip) with a working × (click → badge gone, store empty). Fresh adder-apply of `redirect_attack` and `goad` badges immediately in the acting tab; `goad` also mirrors into the character-sheet Summary tab (`char-summary-badges`). Control: `resilient_sphere` add renders exactly ONE dedicated badge (`sphereCount:1`), no generic duplicate; `×` count = 2 with both effects active. Condition lane sanity: Prone add/remove unchanged.
- Tests: new suite 16/16; `src/components/initiative/` 61 files/473 tests pass; `src/components/char-sheet/char-summary/` 50/668 pass; `src/services/combat/conditions/` 823 pass; `npm run lint` zero warnings; `no-timers-guard` OK.
- Cleanup: test-campaign change-data `{}` and log `[]` GET-verified post-admin-clear from closed-tab quiet.

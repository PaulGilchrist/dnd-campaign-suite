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

# CLA-368 Twinkling Constellations — rule-gate defects (E2E 2026-10-09)

Host: Wild_Sage_Druid lv20 2024 Circle of the Stars. Data: `public/data/2024/classes.json:4427` — level **10** (not lv14), `automation {type:"twinkling_constellations", casting_time:"passive"}`, switch at **start of each of your turns**, Archer/Chalice/Dragon.

Working legs: constellation switch modal + Dragon fly_speed_20_hover buff/te swap + log stamp; 2d8 twinkling damage upgrade live on Luminous Arrow hit (radiant, Δ−11); Archer-only BA row gating; lv<10 refusal (`twinklingConstellationHandler.js:5-23`); no concentration (correct).

## Defects (all fired-live)
1. **No Starry Form prerequisite gate** — press with `activeBuffs:null` opened the chooser and would bootstrap the whole Starry Form for free; `twinklingConstellationHandler.js:59` never checks starry_form active (verified modal opened pre-cast).
2. **Double-apply / double-log** — one Starry Form Choose fired two `ability_use` entries 13 ms apart (`ConstellationSelectionModal.jsx:21-25` applyOption + `useModalHandlers.js:189-190` re-apply via twinkling lane). State dedupes; logs do not.
3. **No turn-start gate** — data says switch only at turn start; app allows press anytime (advisory vs RAW divergence).
4. **No auto-expiry** — buff/te stamp `'1_minute'` but no `pendingExpirations` entry / tick (§70-family residual; GM-manual).

## Fix targets
`twinklingConstellationHandler.js` (prerequisite check), `ConstellationSelectionModal.jsx` + `useModalHandlers.js` (single-apply), expiry registry (duration tick).

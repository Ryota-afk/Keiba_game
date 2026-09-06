// レースsimの窓口（`sim/`の外からはここだけをimportする）。
// ⚠️`sim/`はDOMもJSXも持たない純関数だけで構成する＝Node単体で計測できる状態を保つこと。

export {
  runRaceSim,
  resumeRaceSim,
  buildPlan,
  midAggressionOf,
  stretchAggressionOf,
  SIM_DT,
  PAR_SECONDS_PER_2400,
  NORMALIZED_TIME_MIN,
  NORMALIZED_TIME_MAX,
  NEUTRAL_MID_AGGRESSION,
  NEUTRAL_STRETCH_AGGRESSION,
} from "./raceSim.js";
export {
  TREND_KEYS,
  DERBY_TREND_BASE,
  decideRaceTrend,
  paceMultiplierAt,
  paceScoreOf,
  trendAdaptationOf,
} from "./pace.js";
export {
  distanceAptitude,
  staminaCapacity,
  drainPerSecond,
  normalizedAbilities,
  positionFactor,
  weightFactor,
  REFERENCE_WEIGHT_KG,
  DRAIN_BASE,
} from "./stamina.js";

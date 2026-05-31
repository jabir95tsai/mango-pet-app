// Per-pet walk-goal helpers moved to @mango/shared-business (cross-platform
// single source of truth). Re-exported here so existing `@/lib/walk-goals`
// imports keep working unchanged.
export {
  DEFAULT_WALK_GOAL_MINUTES,
  WALK_GOAL_MIN_MINUTES,
  WALK_GOAL_MAX_MINUTES,
  WALK_GOAL_STEP_MINUTES,
  getPetWalkGoalMinutes,
  formatWalkGoal,
  computeWalkGoalFromBreed,
} from "@mango/shared-business";

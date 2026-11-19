export const MAX_PLAN_PERIODS = 7

/** Return only periods that contain a scheduled lesson on at least one day. */
export function getVisiblePlanPeriods(slots: ReadonlyArray<{ period: number }>): number[] {
  const periods = new Set<number>()
  for (const slot of slots) {
    if (Number.isInteger(slot.period) && slot.period >= 1 && slot.period <= MAX_PLAN_PERIODS) {
      periods.add(slot.period)
    }
  }
  return [...periods].sort((a, b) => a - b)
}

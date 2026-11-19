import { describe, expect, it } from 'vitest'
import { getVisiblePlanPeriods } from '../src/lib/planTable'

describe('getVisiblePlanPeriods', () => {
  it('stops at period six when period seven has no lessons on any day', () => {
    expect(getVisiblePlanPeriods([
      { period: 1 }, { period: 2 }, { period: 3 },
      { period: 4 }, { period: 5 }, { period: 6 },
    ])).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('stops at period four when later periods are empty throughout the week', () => {
    expect(getVisiblePlanPeriods([
      { period: 1 }, { period: 2 }, { period: 3 }, { period: 4 },
    ])).toEqual([1, 2, 3, 4])
  })

  it('removes a wholly empty middle period without removing later lessons', () => {
    expect(getVisiblePlanPeriods([
      { period: 1 }, { period: 2 }, { period: 4 }, { period: 6 },
    ])).toEqual([1, 2, 4, 6])
  })

  it('deduplicates and sorts periods from all days', () => {
    expect(getVisiblePlanPeriods([
      { period: 6 }, { period: 1 }, { period: 6 }, { period: 3 }, { period: 1 },
    ])).toEqual([1, 3, 6])
  })

  it('returns no rows when there are no scheduled lessons', () => {
    expect(getVisiblePlanPeriods([])).toEqual([])
  })
})

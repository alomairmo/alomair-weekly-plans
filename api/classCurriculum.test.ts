import { describe, expect, it } from 'vitest'
import { curriculumGradesForStage, subjectsForClass } from '../src/lib/classCurriculum'

describe('automatic class curriculum import', () => {
  it.each([
    ['الصف الرابع الابتدائي', 'ابتدائية', 10, 'ب٤|رياضيات'],
    ['الصف الخامس الابتدائي', 'الابتدائية', 10, 'ب٥|انجليزي'],
    ['الصف السادس الابتدائي', 'ابتدائية', 10, 'ب٦|علوم'],
    ['الصف الأول المتوسط', 'متوسطة', 10, 'م١|اللغة العربية'],
    ['الصف الثاني المتوسط', 'متوسطة', 10, 'م٢|رياضيات'],
    ['الصف الثالث المتوسط', 'متوسطة', 11, 'م٣|انجليزي'],
    ['الصف الأول الثانوي', 'ثانوية', 9, 'ث١|كيمياء'],
    ['الصف الثاني الثانوي', 'ثانوية', 7, 'ث٢|فيزياء'],
    ['الصف الثالث الثانوي', 'ثانوية', 9, 'ث٣|مهارات البحث'],
  ])('imports the canonical subjects for %s', (name, stage, count, expectedKey) => {
    const subjects = subjectsForClass(name, stage)
    expect(subjects).toHaveLength(count)
    expect(subjects.some((subject) => subject.curriculumKey === expectedKey)).toBe(true)
    expect(new Set(subjects.map((subject) => subject.curriculumKey)).size).toBe(count)
    expect(new Set(subjects.map((subject) => subject.name)).size).toBe(count)
  })

  it('supports stage-prefixed grades without mixing another stage', () => {
    const subjects = subjectsForClass('المرحلة الابتدائية / الصف الأول الابتدائي', 'ابتدائية')
    expect(subjects.length).toBeGreaterThan(0)
    expect(subjects.every((subject) => subject.curriculumKey.startsWith('tahdiri:'))).toBe(true)
  })

  it('does not invent subjects for an unknown class or mismatched stage', () => {
    expect(subjectsForClass('صف غير موجود', 'ابتدائية')).toEqual([])
    expect(subjectsForClass('الصف الرابع الابتدائي', 'متوسطة')).toEqual([])
  })

  it('provides grade choices for the selected stage', () => {
    expect(curriculumGradesForStage('ابتدائية')).toContain('الصف الرابع الابتدائي')
    expect(curriculumGradesForStage('متوسطة')).not.toContain('الصف الرابع الابتدائي')
  })
})

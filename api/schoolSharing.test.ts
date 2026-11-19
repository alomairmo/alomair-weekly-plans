import { describe, expect, it } from 'vitest'
import {
  buildSchoolDirectLink,
  buildTeacherShareMessage,
  toArabicNumber,
} from '../src/lib/schoolSharing'

describe('buildSchoolDirectLink', () => {
  it('builds the fixed Lesson-Plan link with the school code', () => {
    expect(buildSchoolDirectLink('123456')).toBe('https://namthaja.app/Lesson-Plan?code=123456')
  })

  it('trims whitespace and encodes the code safely', () => {
    expect(buildSchoolDirectLink(' 123456 ')).toBe('https://namthaja.app/Lesson-Plan?code=123456')
    expect(buildSchoolDirectLink('12 34')).toBe('https://namthaja.app/Lesson-Plan?code=12%2034')
  })

  it('never embeds a password or any secret in the link', () => {
    const link = buildSchoolDirectLink('123456')
    expect(link.toLowerCase()).not.toContain('password')
    expect(link.toLowerCase()).not.toContain('token')
    expect(link.toLowerCase()).not.toContain('secret')
    expect(link).not.toContain('&')
  })
})

describe('buildTeacherShareMessage', () => {
  const link = buildSchoolDirectLink('123456')

  it('includes the direct link and the school name', () => {
    const message = buildTeacherShareMessage({ schoolName: 'مدرسة النور', week: 3, link })
    expect(message).toContain(link)
    expect(message).toContain('مدرسة النور')
  })

  it('changes the week text when the selected week changes', () => {
    const weekOne = buildTeacherShareMessage({ schoolName: 'مدرسة النور', week: 1, link })
    const weekTwo = buildTeacherShareMessage({ schoolName: 'مدرسة النور', week: 2, link })
    expect(weekOne).not.toBe(weekTwo)
    expect(weekOne).toContain('الأسبوع ١')
    expect(weekOne).not.toContain('الأسبوع ٢')
    expect(weekTwo).toContain('الأسبوع ٢')
  })

  it('includes the week dates when provided', () => {
    const message = buildTeacherShareMessage({
      schoolName: 'مدرسة النور',
      week: 1,
      link,
      weekDates: '٢٣–٢٧ أغسطس ٢٠٢٦',
    })
    expect(message).toContain('٢٣–٢٧ أغسطس ٢٠٢٦')
  })

  it('explains the essential steps: auto code, teacher pick, auto distribution, homework', () => {
    const message = buildTeacherShareMessage({ schoolName: 'مدرسة النور', week: 5, link })
    expect(message).toContain('تعبئة الخطة الأسبوعية')
    expect(message).toContain('كود المدرسة تلقائيًا')
    expect(message).toContain('معلم')
    expect(message).toContain('«توزيع تلقائي»')
    expect(message).toContain('عدّل')
    expect(message).toContain('الواجبات')
    expect(message).toContain('توحيد الواجب للفصول والمواد المحددة')
  })

  it('renders week numbers with Arabic digits', () => {
    expect(toArabicNumber(1)).toBe('١')
    expect(toArabicNumber(12)).toBe('١٢')
  })
})

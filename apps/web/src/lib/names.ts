import type { Language } from '../features/auth/types'

/** The name to show in the user's language, with the other one as a smaller second line. */
export function displayNames(
  nameEn: string,
  nameTa: string | undefined,
  language: Language,
): { primary: string; secondary: string } {
  const ta = (nameTa ?? '').trim()
  if (language === 'ta' && ta) return { primary: ta, secondary: nameEn }
  return { primary: nameEn, secondary: ta }
}

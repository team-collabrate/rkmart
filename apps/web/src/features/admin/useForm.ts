import { useState } from 'react'
import type { ZodType } from 'zod'
import { fieldErrors } from './schemas'

/** Minimal form state: values, per-field error keys, and a validate step that uses a zod schema. */
export function useForm<T extends object>(initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set<K extends keyof T>(field: K, value: T[K]) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => (e[field as string] ? { ...e, [field as string]: '' } : e))
  }

  /**
   * Returns the cleaned values, or null after showing the errors.
   * `input` lets a form convert its text boxes (strings) into the types the schema expects.
   */
  function validate<O>(schema: ZodType<O>, input: unknown = values): O | null {
    const result = schema.safeParse(input)
    if (result.success) {
      setErrors({})
      return result.data
    }
    setErrors(fieldErrors(result.error))
    return null
  }

  return { values, setValues, set, errors, validate }
}

/** "" -> NaN, so an empty number box fails validation instead of silently becoming 0. */
export function toNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text)
}

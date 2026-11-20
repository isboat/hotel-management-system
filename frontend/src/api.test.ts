import { describe, expect, it } from 'vitest'
import { toPesewas } from './api'

describe('cash conversion', () => {
  it.each([['0', 0], ['35', 3500], ['35.1', 3510], ['35.12', 3512]])('converts %s to pesewas', (value, expected) => {
    expect(toPesewas(value)).toBe(expected)
  })
  it.each(['', '1.001', '-2', '4e3', '90071992547409999'])('rejects %s', value => {
    expect(() => toPesewas(value)).toThrow()
  })
})

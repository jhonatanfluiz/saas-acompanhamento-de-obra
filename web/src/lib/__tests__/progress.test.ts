import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateExpectedProgress, getStatusPrazo } from '../progress'

describe('Lógica de Progresso (Regra dos 60 dias)', () => {
  beforeEach(() => {
    // Fixar a data atual para os testes: 15 de Maio de 2026
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15'))
  })

  it('deve calcular 50% de progresso esperado após 30 dias', () => {
    const dataInicio = new Date('2026-04-15') // 30 dias atrás
    const esperado = calculateExpectedProgress(dataInicio)
    expect(esperado).toBe(50)
  })

  it('deve calcular 100% de progresso esperado após 60 dias', () => {
    const dataInicio = new Date('2026-03-16') // 60 dias atrás
    const esperado = calculateExpectedProgress(dataInicio)
    expect(esperado).toBe(100)
  })

  it('deve marcar como ATRASADA se o progresso real for menor que o esperado', () => {
    const real = 20
    const esperado = 50 // 30 dias decorridos
    expect(getStatusPrazo(real, esperado)).toBe('atrasada')
  })

  it('deve marcar como EM DIA se o progresso real for igual ou maior que o esperado', () => {
    const real = 55
    const esperado = 50
    expect(getStatusPrazo(real, esperado)).toBe('em_dia')
  })

  it('deve limitar o progresso esperado a 100%', () => {
    const dataInicio = new Date('2026-01-01') // Muito tempo atrás
    const esperado = calculateExpectedProgress(dataInicio)
    expect(esperado).toBe(100)
  })
})

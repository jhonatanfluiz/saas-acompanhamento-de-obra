import { describe, it, expect } from 'vitest'

export function calculatePhaseProgress(answers: string[]): number {
  const simCount = answers.filter(a => a.toUpperCase() === 'SIM').length;
  // Cada SIM vale 25% (máximo de 4 perguntas)
  return Math.min(100, simCount * 25);
}

describe('Lógica de Progresso da Fase (25% por pergunta)', () => {
  it('deve calcular 0% se não houver respostas SIM', () => {
    expect(calculatePhaseProgress(['NÃO', 'NÃO', 'NÃO', 'NÃO'])).toBe(0)
  })

  it('deve calcular 25% com uma resposta SIM', () => {
    expect(calculatePhaseProgress(['SIM', 'NÃO', 'NÃO', 'NÃO'])).toBe(25)
  })

  it('deve calcular 50% com duas respostas SIM', () => {
    expect(calculatePhaseProgress(['SIM', 'SIM', 'NÃO', 'NÃO'])).toBe(50)
  })

  it('deve calcular 75% com três respostas SIM', () => {
    expect(calculatePhaseProgress(['SIM', 'SIM', 'SIM', 'NÃO'])).toBe(75)
  })

  it('deve calcular 100% com quatro respostas SIM', () => {
    expect(calculatePhaseProgress(['SIM', 'SIM', 'SIM', 'SIM'])).toBe(100)
  })
})

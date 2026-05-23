import { describe, it, expect } from 'vitest'

interface PerguntaDeTeste {
  ordem: number;
  peso: number;
  resposta: string | null;
}

export function calculatePhaseProgress(perguntas: PerguntaDeTeste[]): number {
  const v_num_perguntas = perguntas.length;

  if (v_num_perguntas === 2) {
    // Lógica clássica (2 perguntas)
    const r1 = perguntas[0].resposta ? perguntas[0].resposta.trim().toUpperCase() : null;
    const r2 = perguntas[1].resposta ? perguntas[1].resposta.trim().toUpperCase() : null;

    if (r1 === 'NÃO' || r1 === 'N/A' || r1 === 'NAO') {
      return 0;
    }
    if (r1 === 'SIM') {
      if (r2 !== null && r2 !== undefined) {
        const match = r2.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      }
      return 0;
    }
    return 0;
  }

  // Lógica ponderada (Prompt 3)
  let somaPesosSim = 0;
  let somaPesosTotal = 0;

  for (const p of perguntas) {
    const resp = p.resposta ? p.resposta.trim().toUpperCase() : null;
    if (resp !== 'N/A') {
      somaPesosTotal += p.peso;
      if (resp === 'SIM') {
        somaPesosSim += p.peso;
      }
    }
  }

  if (somaPesosTotal > 0) {
    return Math.round((somaPesosSim / somaPesosTotal) * 10000) / 100;
  } else {
    // Se tudo for N/A, considera concluída (100%)
    const totalNa = perguntas.filter(p => p.resposta?.trim().toUpperCase() === 'N/A').length;
    return totalNa > 0 ? 100.0 : 0.0;
  }
}

describe('Lógica de Progresso da Fase (Fórmula Elevadores - 2 Perguntas)', () => {
  it('deve calcular 0% se Pergunta 1 for NÃO', () => {
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'NÃO' },
      { ordem: 2, peso: 1, resposta: null }
    ])).toBe(0)
    
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'NÃO' },
      { ordem: 2, peso: 1, resposta: '50%' }
    ])).toBe(0)
  })

  it('deve calcular 0% se Pergunta 1 for N/A', () => {
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'N/A' },
      { ordem: 2, peso: 1, resposta: null }
    ])).toBe(0)
  })

  it('deve calcular 0% se Pergunta 1 for SIM mas Pergunta 2 for nula', () => {
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 1, resposta: null }
    ])).toBe(0)
  })

  it('deve calcular progresso com base na Pergunta 2 se Pergunta 1 for SIM', () => {
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 1, resposta: '25%' }
    ])).toBe(25)

    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 1, resposta: '100%' }
    ])).toBe(100)
  })

  it('deve normalizar valores sem símbolo de porcentagem', () => {
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 1, resposta: '50' }
    ])).toBe(50)
  })
})

describe('Lógica de Progresso Ponderado da Fase (Prompt 3 - Multietapas)', () => {
  it('deve calcular 0% se todas as respostas forem NÃO', () => {
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'NÃO' },
      { ordem: 2, peso: 2, resposta: 'NÃO' },
      { ordem: 3, peso: 3, resposta: 'NÃO' }
    ])).toBe(0)
  })

  it('deve calcular 100% se todas as respostas forem SIM', () => {
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 2, resposta: 'SIM' },
      { ordem: 3, peso: 3, resposta: 'SIM' }
    ])).toBe(100)
  })

  it('deve ponderar as respostas SIM de acordo com seus pesos', () => {
    // Q1(peso 1): SIM, Q2(peso 2): NÃO, Q3(peso 3): NÃO
    // total = 6, sim = 1 -> 16.67%
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 2, resposta: 'NÃO' },
      { ordem: 3, peso: 3, resposta: 'NÃO' }
    ])).toBe(16.67)

    // Q1(peso 1): NÃO, Q2(peso 2): SIM, Q3(peso 3): NÃO
    // total = 6, sim = 2 -> 33.33%
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'NÃO' },
      { ordem: 2, peso: 2, resposta: 'SIM' },
      { ordem: 3, peso: 3, resposta: 'NÃO' }
    ])).toBe(33.33)

    // Q1(peso 1): SIM, Q2(peso 2): SIM, Q3(peso 3): NÃO
    // total = 6, sim = 3 -> 50%
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 2, resposta: 'SIM' },
      { ordem: 3, peso: 3, resposta: 'NÃO' }
    ])).toBe(50)
  })

  it('deve excluir do cálculo (tanto do dividendo quanto do divisor) as perguntas respondidas com N/A', () => {
    // Q1(peso 1): SIM, Q2(peso 2): N/A, Q3(peso 3): NÃO
    // total = 1 + 3 = 4, sim = 1 -> 25%
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 2, resposta: 'N/A' },
      { ordem: 3, peso: 3, resposta: 'NÃO' }
    ])).toBe(25)

    // Q1(peso 1): N/A, Q2(peso 2): SIM, Q3(peso 3): N/A
    // total = 2, sim = 2 -> 100%
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'N/A' },
      { ordem: 2, peso: 2, resposta: 'SIM' },
      { ordem: 3, peso: 3, resposta: 'N/A' }
    ])).toBe(100)
  })

  it('deve considerar 100% se todas as perguntas forem N/A', () => {
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'N/A' },
      { ordem: 2, peso: 2, resposta: 'N/A' },
      { ordem: 3, peso: 3, resposta: 'N/A' }
    ])).toBe(100)
  })

  it('deve considerar perguntas não respondidas (null) no divisor mas não no dividendo', () => {
    // Q1(peso 1): SIM, Q2(peso 2): null, Q3(peso 3): null
    // total = 6, sim = 1 -> 16.67%
    expect(calculatePhaseProgress([
      { ordem: 1, peso: 1, resposta: 'SIM' },
      { ordem: 2, peso: 2, resposta: null },
      { ordem: 3, peso: 3, resposta: null }
    ])).toBe(16.67)
  })
})

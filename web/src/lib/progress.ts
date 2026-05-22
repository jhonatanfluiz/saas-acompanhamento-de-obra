export function calculateExpectedProgress(startDate: Date): number {
  const now = new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  
  const expected = (diffDays / 60) * 100;
  return Math.min(100, Math.round(expected * 100) / 100);
}

export function getStatusPrazo(actualProgress: number, expectedProgress: number): 'em_dia' | 'atrasada' {
  // Margem de tolerância de 1%
  return actualProgress >= (expectedProgress - 1) ? 'em_dia' : 'atrasada';
}

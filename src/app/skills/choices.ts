export type AnswerMode = 'classic' | 'choice';

export const CHOICE_COUNT = 6;

// Risposte sbagliate plausibili: vicine al risultato o tipiche di un
// riporto/prestito dimenticato (+-10, +-100), cosi' la scelta non e' banale.
// preferredOffsets sono errori tipici dell'operazione (es. un gruppo in piu'
// o in meno nella moltiplicazione) e vengono proposti per primi.
export function createChoices(correct: number, preferredOffsets: number[] = []): number[] {
  const offsets = [1, 2, 9, 10, 11, ...(correct >= 100 ? [100] : [])];
  const around = (values: number[]) => shuffle(values.filter((offset) => offset > 0).flatMap((offset) => [correct + offset, correct - offset]));
  const nearby = [...around(preferredOffsets), ...around(offsets)].filter((value) => value >= 0);
  const options = new Set<number>([correct]);
  for (const value of nearby) {
    if (options.size === CHOICE_COUNT) {
      break;
    }
    options.add(value);
  }
  while (options.size < CHOICE_COUNT) {
    options.add(Math.max(0, correct - 20) + Math.floor(Math.random() * 41));
  }
  return shuffle([...options]);
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

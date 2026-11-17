/**
 * Układ startowy „Kolejności” (Z-122, C2b): żaden element nie stoi na pozycji ze wzorca, więc bez ruchu
 * nie ma ani gotowej odpowiedzi, ani punktów częściowych. Losowanie z powtórzeniem (trafia średnio co
 * trzecie), awaryjnie wzorzec przesunięty o jedno miejsce. `los` do testów.
 */
export function ukladPozaWzorcem<T extends { id: string }>(items: T[], correctOrder: string[], los: () => number = Math.random): T[] {
  if (items.length < 2) return [...items];
  const tasuj = (list: T[]) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(los() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const naWzorcu = (list: T[]) => list.some((item, i) => item.id === correctOrder[i]);
  for (let proba = 0; proba < 50; proba++) {
    const list = tasuj(items);
    if (!naWzorcu(list)) return list;
  }
  const byId = new Map(items.map((item) => [item.id, item] as const));
  const wzorzec = correctOrder.map((id) => byId.get(id)).filter((item): item is T => !!item);
  return wzorzec.length === items.length ? [...wzorzec.slice(1), wzorzec[0]] : tasuj(items);
}

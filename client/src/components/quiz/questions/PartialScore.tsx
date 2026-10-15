/** Wynik częściowy — spokojna linia z liczbami, bez kolorowego bloku */
export default function PartialScore({
  score,
  correct,
  total,
  noun = "poprawnie",
}: {
  score: number;
  correct?: number;
  total?: number;
  noun?: string;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-[var(--line)] pt-4 text-[15px] text-[var(--txt2)]">
      <span className="label">Wynik częściowy</span>
      <span className="num text-[var(--txt)]">{Math.round(score * 100)}%</span>
      {correct !== undefined && total !== undefined && (
        <span>
          {correct} z {total} {noun}
        </span>
      )}
    </p>
  );
}

import { Check, Circle, CircleDot, Minus } from "lucide-react";
import { feedbackStatusLabel, normalizeFeedbackStatus, type FeedbackStatus } from "@shared/feedback";

const STYLE: Record<FeedbackStatus, string> = {
  nowe: "border-[var(--line2)] text-[var(--txt2)]",
  w_analizie: "border-[var(--txt3)] text-[var(--txt)]",
  wdrozone: "border-[var(--puls-deep)] bg-[var(--tint)] text-[var(--puls)]",
  odrzucone: "border-[var(--line2)] text-[var(--txt3)]",
};

const ICON: Record<FeedbackStatus, typeof Check> = {
  nowe: Circle,
  w_analizie: CircleDot,
  wdrozone: Check,
  odrzucone: Minus,
};

/** Status zgłoszenia: kolor + ikona + słowo (nie tylko kolor) */
export default function FeedbackStatusPill({ status, className = "" }: { status: string; className?: string }) {
  const s = normalizeFeedbackStatus(status);
  const Icon = ICON[s];
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-mono text-[11px] uppercase tracking-[.12em] ${STYLE[s]} ${className}`}
      data-testid={`feedback-status-${s}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {feedbackStatusLabel(s)}
    </span>
  );
}

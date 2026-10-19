import { motion } from "framer-motion";
import { EkgCanvas, type Rhythm } from "@/components/ekg/EkgCanvas";
import { rise, stagger } from "@/lib/motion";

/** Nagłówek wykładu jak hero na landingu: etykieta, tytuł, moduł, meta i żywy pasek EKG */
export function LectureHero({
  label,
  title,
  moduleName,
  meta,
  rhythm,
  rhythmLabel,
}: {
  label: string;
  title: string;
  moduleName: string;
  /** np. „5 rozdziałów · ~18 min czytania”; null, dopóki nie znamy rozdziałów */
  meta: string | null;
  rhythm: Rhythm;
  /** Podpis rytmu tylko wtedy, gdy zapis odpowiada tematowi */
  rhythmLabel: boolean;
}) {
  return (
    <motion.header className="mt-6 mb-10 grid gap-4" variants={stagger(0.05)} initial="hidden" animate="show">
      <motion.p variants={rise} className="label">
        {label}
      </motion.p>
      <motion.h1 variants={rise} className="h1" data-testid="lecture-title">
        {title}
      </motion.h1>
      <motion.div variants={rise} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="muted text-[15px]">{moduleName}</p>
        <p className="label min-h-[1.4em]" data-testid="lecture-meta">
          {meta ?? ""}
        </p>
      </motion.div>
      <motion.div variants={rise} className="mt-3">
        <EkgCanvas rhythm={rhythm} height={90} label={rhythmLabel} />
      </motion.div>
    </motion.header>
  );
}

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { sanitizeMarkdown } from "@/lib/sanitize";
import { rise, stagger } from "@/lib/motion";

type Dokument = { id: string; wersja: string; tytul: string; tresc: string };

/** Tabele szersze niż telefon przewijają się w poziomie we własnym pudełku, a nie całą stronę */
const zTabelamiPrzewijanymi = (h: { __html: string }) => ({
  __html: h.__html.replace(/<table/g, '<div class="overflow-x-auto" tabindex="0" role="region" aria-label="Tabela, przewiń w poziomie"><table').replace(/<\/table>/g, "</table></div>"),
});

/** Regulamin bety i polityka prywatności (Markdown z serwera, publiczne po akceptacji JK) */
export default function DokumentPage({ id }: { id: "regulamin_bety" | "polityka_prywatnosci" }) {
  const { data, isLoading, isError } = useQuery<Dokument>({
    queryKey: ["/api/dokumenty", id],
    queryFn: async () => {
      const res = await fetch(`/api/dokumenty/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="wrap">
        <div className="mx-auto max-w-[42rem] py-20" role="status">
          <p className="label">Dokument</p>
          <h1 className="h2 mt-4 text-[var(--txt)]">{id === "regulamin_bety" ? "Regulamin bety" : "Polityka prywatności"}</h1>
          <p className="lead mt-4">Dokument jest w przygotowaniu. Pytania: kontakt@helloekg.pl</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <motion.article
        className="mx-auto max-w-[42rem] py-16 sm:py-20"
        variants={stagger(0.04)}
        initial="hidden"
        animate="show"
        data-testid={`dokument-${id}`}
      >
        <motion.p variants={rise} className="label">Wersja {data.wersja}</motion.p>
        <motion.div
          variants={rise}
          className="prose-hk mt-4"
          dangerouslySetInnerHTML={zTabelamiPrzewijanymi(sanitizeMarkdown(data.tresc))}
        />
      </motion.article>
    </div>
  );
}

import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { rise, stagger } from "@/lib/motion";

export default function NotFound() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="wrap">
      <motion.div
        className="mx-auto max-w-[30rem] py-20 sm:py-28"
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
      >
        <motion.p variants={rise} className="label">Błąd 404</motion.p>
        <motion.h1 variants={rise} className="h2 mt-4 text-[var(--txt)]">
          Nie ma takiej strony
        </motion.h1>
        <motion.p variants={rise} className="lead mt-4">
          {isAuthenticated
            ? "Link mógł się zmienić albo zawiera literówkę. Wróć do kursu i wybierz, co chcesz otworzyć."
            : "Link mógł się zmienić albo zawiera literówkę. Zaloguj się i wybierz temat w kursie."}
        </motion.p>
        <motion.div variants={rise} className="mt-8">
          <Button asChild>
            <Link href={isAuthenticated ? "/modules" : "/?auth=login"}>
              {isAuthenticated ? "Wróć do kursu" : "Zaloguj się"}
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

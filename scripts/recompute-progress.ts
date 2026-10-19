/**
 * Jednorazowe przeliczenie postępu (tabela progress) według OPANOWANIA:
 * completionPercentage = opublikowane pytania sekcji z poprawną OSTATNIĄ próbą / wszystkie opublikowane.
 * Wcześniej postęp liczył pytania, na które ktoś po prostu odpowiedział (także źle).
 * Nie zmienia lastActivity. Można uruchamiać wielokrotnie (zmienia tylko różniące się wiersze).
 *
 *   set -a && . ./.env && set +a && npx tsx scripts/recompute-progress.ts
 */
import { quizService } from "../server/services/quizService";

const result = await quizService.recomputeAllProgress();
console.log(`Przeliczono postęp: ${result.users} kursantów, zmienione wiersze: ${result.rowsChanged}`);
process.exit(0);

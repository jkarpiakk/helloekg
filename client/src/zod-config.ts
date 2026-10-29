import { config } from "zod";

// zod 4 sprawdza, czy wolno mu kompilować kod (new Function), już przy tworzeniu schematów; CSP tego zabrania.
// Tryb bez kompilacji: te same wyniki, bez naruszenia polityki. Import jako pierwszy w main.tsx,
// przed każdym modułem, który definiuje schematy.
config({ jitless: true });

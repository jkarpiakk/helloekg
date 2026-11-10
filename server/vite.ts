import { type Express } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { type Server } from "http";

/**
 * Podgląd lokalny (NODE_ENV=development): klient przez serwer vite z HMR.
 * Importowany dynamicznie tylko w trybie deweloperskim. vite i konfiguracja ładują się przez import(),
 * a ścieżka konfiguracji jest zmienną, żeby esbuild nie wciągnął jej (ani wtyczek vite) do paczki produkcyjnej.
 */
export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer, createLogger } = await import("vite");
  const sciezkaKonfiguracji = "../vite.config";
  const viteConfig = (await import(sciezkaKonfiguracji)).default;
  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${randomUUID()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}


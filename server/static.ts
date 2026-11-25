import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { znanaTrasa } from "@shared/trasy";

/** Produkcja: zbudowany klient z dist/public. Bez vite (to tylko zależność deweloperska). */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed asset files (JS/CSS/images with content hash in filename) — cache for 1 year
  app.use(
    express.static(distPath, {
      maxAge: "1y",
      immutable: true,
      // Do NOT cache index.html — it must always be fresh
      setHeaders(res, filePath) {
        if (path.basename(filePath) === "index.html") {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      },
    })
  );

  // SPA fallback — always return index.html without caching. Adres spoza tras aplikacji: ta sama strona
  // (pokaże „Ten adres nie przewodzi”), ale z kodem 404 dla przeglądarek, wyszukiwarek i monitoringu.
  app.use("*", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    if (!znanaTrasa(req.originalUrl)) res.status(404);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

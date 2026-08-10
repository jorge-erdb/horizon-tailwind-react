import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

/**
 * Mirror the `baseUrl: "src"` behaviour that jsconfig.json gave us under CRA,
 * so existing bare specifiers keep working ("components/card",
 * "views/admin/default", "contexts/AuthContext", ...).
 *
 * Generated from the directory listing rather than hand-written, so adding a
 * new top-level folder under src/ doesn't need a config edit.
 */
const srcAliases = Object.fromEntries(
  fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [entry.name, path.join(srcDir, entry.name)])
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: srcAliases,
  },
  server: {
    // Pinned because Supabase's redirect allow-list is per-origin — a port
    // fallback would silently break every emailed auth link in development.
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
});

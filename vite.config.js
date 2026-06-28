import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works under a GitHub Pages project subpath
  // (https://<user>.github.io/<repo>/) as well as a custom domain / root.
  base: "./",
  server: {
    host: "127.0.0.1"
  },
  preview: {
    host: "127.0.0.1"
  },
  build: {
    chunkSizeWarningLimit: 900
  }
});

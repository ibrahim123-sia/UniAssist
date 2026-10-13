import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: they rarely change, so browsers keep them
        // cached across app deploys, and the entry chunk stays under 500 kB.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          state: ["@reduxjs/toolkit", "react-redux", "axios"],
          markdown: ["react-markdown"],
          moment: ["moment"],
        },
      },
    },
  },
});

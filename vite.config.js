import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @vitejs/plugin-react enables the automatic JSX runtime so components
// don't need `import React from "react"` just to use JSX.
export default defineConfig({
  plugins: [react()],
});

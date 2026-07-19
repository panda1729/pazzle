/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages のサブパス (https://panda1729.github.io/pazzle/) 配信に合わせる
  base: "/pazzle/",
  plugins: [react()],
  server: {
    // WSL2 の /mnt/* (Windowsドライブ) では inotify が効かず HMR が変更を拾えないため、ポーリングで監視する
    watch: {
      usePolling: true,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

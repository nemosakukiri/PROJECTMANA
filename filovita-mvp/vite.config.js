import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages（/PROJECTMANA/配下）とVercel（ドメイン直下）の両方で
// 同じビルドが動くよう、相対パスにする。開発サーバーには影響させない。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "./" : "/",
}));

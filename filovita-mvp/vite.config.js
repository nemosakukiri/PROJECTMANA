import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pagesはリポジトリ名配下（/PROJECTMANA/）で配信されるため、
// ビルド時のみbaseを合わせる。開発サーバーには影響させない。
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/PROJECTMANA/" : "/",
}));

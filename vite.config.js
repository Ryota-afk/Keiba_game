import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// src/ をソースルートに、自己完結の単一 index.html を dist/ へ出力する。
// dist/ の中身をGitHub Actionsがそのまま配信する（リポジトリに成果物は置かない）。
export default defineConfig({
  root: "src",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    // 単一ファイル化：チャンク分割を抑止し全アセットをインライン
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});

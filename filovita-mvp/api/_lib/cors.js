// GitHub Pagesにデプロイした本体アプリから、別オリジンのこの関数を呼ぶために必要
// (静的ホスティングのGitHub Pagesにはサーバー機能が無いため、APIだけをここに置いている)
const ALLOWED_ORIGINS = [
  "https://nemosakukiri.github.io",
  "http://localhost:5173", "http://localhost:5900",
];

export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || (origin && origin.endsWith(".vercel.app"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

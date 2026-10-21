/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// 开发模式：Next.js 的 webpack HMR 运行时依赖 eval() 与 WebSocket，
// 若 CSP 不放行 'unsafe-eval' 与 ws:，浏览器会拦掉全部客户端 JS，
// 表现为页面能显示（SSR 输出）但按钮点击毫无反应。
// 生产构建不使用 eval，因此仍保持严格策略。
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const connectSrc = isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  connectSrc,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  // 开发体验：关闭无意义的缓存告警（受限文件系统下 webpack 无法快照依赖）
  webpack: (config, { dev }) => {
    if (dev) config.infrastructureLogging = { level: "error" };
    return config;
  },
  reactStrictMode: true,
  // Zero-trust: never expose server internals
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};
module.exports = nextConfig;

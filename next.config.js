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
  experimental: {
    // 存在自定义 webpack 配置时 Next 默认不使用 build worker；
    // 此处显式声明以避免在受限环境中尝试 fork 子进程。
    webpackBuildWorker: false,
  },
  // Zero-trust: never expose server internals
  poweredByHeader: false,
  async redirects() {
    // Cookie 按 host 隔离：若用户从 localhost 访问、而 OIDC 回调落在 127.0.0.1，
    // 会话 Cookie 会因域名不一致而丢失（表现为登录成功但所有 API 401）。
    // 统一收敛到 127.0.0.1。
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "localhost" }],
        destination: "http://127.0.0.1:3000/:path*",
        permanent: false,
      },
    ];
  },
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

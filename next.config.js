/** @type {import('next').NextConfig} */
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
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" }
        ]
      }
    ];
  }
};
module.exports = nextConfig;

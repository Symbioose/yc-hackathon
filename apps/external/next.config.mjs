/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@altai/contracts", "@altai/fixtures", "@altai/tools", "@altai/agents", "@altai/crypto"],
  async rewrites() {
    const internal = process.env.INTERNAL_URL ?? "http://localhost:3100";
    return [{ source: "/bank/:path*", destination: `${internal}/bank/:path*` }];
  },
};

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@periscope/contracts", "@periscope/fixtures"],
  async rewrites() {
    const internal = process.env.INTERNAL_URL ?? "http://localhost:3100";
    return [{ source: "/bank/:path*", destination: `${internal}/bank/:path*` }];
  },
};

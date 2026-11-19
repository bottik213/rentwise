import type { NextConfig } from "next";

// Every page lives under a locale (/ru, /kk, /en). Old links land in Russian; Next keeps the query, the browser keeps the #fragment.
const OLD = ["/analyze", "/results", "/performance", "/compare", "/r", "/report/:id"];

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/", destination: "/ru", permanent: false }, ...OLD.map((p) => ({ source: p, destination: `/ru${p}`, permanent: false }))];
  },
};

export default nextConfig;



/** @type {import("next").NextConfig} */
const nextConfig = {
  // En producción: NEXT_PUBLIC_BASE_PATH=/agenda (la app vive en new.aasolutionsllc.com/agenda).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;

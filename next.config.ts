import type { NextConfig } from "next";

// Export statique : pas de Server Components de données, pas de route API,
// pas de middleware. Tout passe par le client Supabase navigateur et les policies RLS.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;

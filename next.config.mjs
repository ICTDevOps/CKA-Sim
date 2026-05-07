import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // These packages ship native bindings or large model loaders that
  // Turbopack can't bundle into a route handler — keep them external
  // so they're require()'d at runtime from node_modules.
  serverExternalPackages: [
    "better-sqlite3",
    "sqlite-vec",
    "@huggingface/transformers",
    "onnxruntime-node"
  ]
};

export default withNextIntl(nextConfig);

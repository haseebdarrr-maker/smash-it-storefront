const fs = require("node:fs/promises");
const path = require("node:path");

const sourceDirectory = __dirname;
const outputDirectory = path.join(sourceDirectory, "dist");
const apiUrlValue = process.env.SMASH_IT_API_URL || "https://smash-it-3xzp.onrender.com";

let apiUrl;
try {
  apiUrl = new URL(apiUrlValue);
} catch {
  throw new Error("SMASH_IT_API_URL must be a valid HTTPS URL.");
}

if (
  apiUrl.protocol !== "https:" ||
  apiUrl.username ||
  apiUrl.password ||
  apiUrl.pathname !== "/" ||
  apiUrl.search ||
  apiUrl.hash
) {
  throw new Error("SMASH_IT_API_URL must be the HTTPS origin of the API service without a path, query, or credentials.");
}

async function build() {
  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all(["index.html", "script.js", "style.css"].map((file) =>
    fs.copyFile(path.join(sourceDirectory, file), path.join(outputDirectory, file))
  ));

  const apiOrigin = apiUrl.origin;
  const redirects = [
    `/health ${apiOrigin}/health 200`,
    `/auth/* ${apiOrigin}/auth/:splat 200`,
    `/products ${apiOrigin}/products 200`,
    `/products/* ${apiOrigin}/products/:splat 200`,
    `/orders ${apiOrigin}/orders 200`,
    `/orders/* ${apiOrigin}/orders/:splat 200`,
    `/uploads/products ${apiOrigin}/uploads/products 200`,
    `/uploads/products/* ${apiOrigin}/uploads/products/:splat 200`
  ];
  await fs.writeFile(path.join(outputDirectory, "_redirects"), `${redirects.join("\n")}\n`, "utf8");
  console.log(`Built Netlify storefront and API proxy for ${apiOrigin}`);
}

build().catch((error) => {
  console.error("Netlify build failed:", error.message);
  process.exitCode = 1;
});

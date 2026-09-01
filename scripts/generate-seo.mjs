import { mkdir, writeFile } from "node:fs/promises";

const configuredUrl = process.env.VITE_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const isProductionUrl = configuredUrl && /^https:\/\//i.test(configuredUrl) && !/localhost|127\.0\.0\.1/i.test(configuredUrl);
const publicPages = [
  "/", "/services", "/services/electrician", "/services/plumber", "/services/ac-service",
  "/services/refrigerator-repair", "/services/washing-machine-repair", "/services/water-purifier",
  "/services/bathroom-cleaning", "/services/home-cleaning", "/services/pest-control", "/services/appliance-repair",
  "/services/car-service", "/services/bike-service", "/services/mechanic", "/services/home-salon",
  "/services/moving-and-packing", "/services/delivery", "/services/gardening", "/services/home-maintenance", "/support",
];

await mkdir("public", { recursive: true });

const privatePaths = ["/admin/", "/customer/", "/employee/", "/driver/", "/booking", "/orders/", "/track/", "/ride/"];
const robots = isProductionUrl
  ? ["User-agent: *", "Allow: /", ...privatePaths.map((path) => `Disallow: ${path}`), "", `Sitemap: ${configuredUrl}/sitemap.xml`, ""].join("\n")
  : ["User-agent: *", "Disallow: /", ""].join("\n");
const sitemap = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">", ...(isProductionUrl ? publicPages.map((path) => `  <url><loc>${configuredUrl}${path}</loc></url>`) : []), "</urlset>", ""].join("\n");

await Promise.all([
  writeFile("public/robots.txt", robots, "utf8"),
  writeFile("public/sitemap.xml", sitemap, "utf8"),
]);
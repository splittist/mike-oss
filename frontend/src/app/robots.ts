import type { MetadataRoute } from "next";

/**
 * Robots.txt configuration for SEO.
 * Allows all crawlers and points to the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/", "/chat-demo/"],
            },
        ],
        sitemap: "https://openjuris.org/sitemap.xml",
    };
}

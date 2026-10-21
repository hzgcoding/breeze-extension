import process from "node:process";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vueDevTools from "vite-plugin-vue-devtools";
import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import extensionPackage from "../../extension/package.json" with { type: "json" };
import { generateDocsSidebar } from "./sidebar.ts";

const base = process.env.DOCS_BASE || (process.env.NODE_ENV === "production" ? "/breeze/" : "/");
const siteUrl = "https://hzgcoding.github.io/breeze/";

export default defineConfig({
  base,
  cleanUrls: true,
  title: "Breeze",
  description: "Breeze (微风) is a local browser workspace for HTTP headers, request rules, and environment switching.",
  srcExclude: ["superpowers/**"],
  sitemap: {
    hostname: siteUrl,
  },
  vite: {
    resolve: {
      alias: [
        {
          // Replace the switch in desktop, overflow and mobile navigation together.
          find: /^.*\/VPSwitchAppearance\.vue$/,
          replacement: fileURLToPath(new URL("./theme/components/ThemeToggle.vue", import.meta.url)),
        },
      ],
    },
    plugins: [llmstxt(), tailwindcss(), vueDevTools()],
    ssr: { noExternal: ["@breeze/ui"] },
  },
  head: [
    ["link", { rel: "icon", href: `${base}favicon.svg`, type: "image/svg+xml" }],
    ["meta", { property: "og:site_name", content: "Breeze" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:image", content: `${siteUrl}popup-screenshot-small.png` }],
  ],
  themeConfig: {
    editLink: {
      pattern: "https://github.com/hzgcoding/breeze/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },
    nav: [
      { text: "Guide", link: "/start/overview" },
      { text: "Reference", link: "/reference/profiles" },
      { text: "Troubleshooting", link: "/troubleshooting/rule-not-applied" },
      {
        component: "VersionMenu",
        props: {
          version: extensionPackage.version,
          items: [
            {
              text: "Releases",
              link: "https://github.com/hzgcoding/breeze/releases",
            },
            {
              text: "Contributing",
              link: "https://github.com/hzgcoding/breeze/blob/main/.github/CONTRIBUTING.md",
            },
          ],
        },
      },
    ],
    sidebar: generateDocsSidebar(),
    socialLinks: [
      { icon: "github", link: "https://github.com/hzgcoding/breeze" },
    ],
    search: {
      provider: "local",
    },
    outline: { level: [2, 3] },
  },
});

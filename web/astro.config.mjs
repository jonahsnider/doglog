import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";

// https://astro.build/config
export default defineConfig({
  site: "https://doglog.dev",
  integrations: [
    starlight({
      plugins: [starlightLinksValidator()],
      title: "DogLog Docs",
      favicon: "/favicon.ico",
      social: {
        github: "https://github.com/jonahsnider/doglog",
      },
      logo: {
        alt: "DogLog logo",
        src: "./src/assets/logo.svg",
      },
      sidebar: [
        {
          label: "Getting started",
          autogenerate: { directory: "getting-started" },
        },
        {
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
        {
          label: "Javadoc",
          link: "https://javadoc.doglog.dev",
        },
      ],
      customCss: ["/src/styles/custom.css"],
    }),
  ],
});

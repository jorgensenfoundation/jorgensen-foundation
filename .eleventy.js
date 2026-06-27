module.exports = function (eleventyConfig) {
  // Static assets — copied through verbatim, output paths have the "src/" prefix stripped.
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/videos");
  eleventyConfig.addPassthroughCopy("src/img");

  // Legacy pages not yet migrated to the shared layout. Copy them through unchanged
  // so every existing URL keeps working; convert to base.njk later, one at a time.
  // Passthrough (not templating) guarantees byte-identical output.
  eleventyConfig.addPassthroughCopy("src/*.html");

  // ── Site search (build-time index) ───────────────────────────────────────
  // search-index.njk emits /search-index.json so the nav search boxes can run a
  // client-side search with no backend. These two filters keep that template tiny
  // and make it self-maintaining: anything in site.sitemapPages is indexed, so a
  // new public page becomes searchable the moment it's added there (which you do
  // anyway for SEO + the XML sitemap). No search code needs to change.

  // Reduce a page's rendered body (templateContent — layout/nav/footer excluded in
  // 11ty) to clean searchable plain text: drop scripts/styles/svg, strip tags,
  // collapse whitespace, cap length so the index stays small.
  eleventyConfig.addFilter("searchText", (content) => {
    if (!content) return "";
    return String(content)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
  });

  // Pick the pages that belong in the search index: those listed in
  // site.sitemapPages (URLs compared without trailing slash) and not noindex.
  eleventyConfig.addFilter("searchPages", (all, sitemapPages) => {
    const norm = (u) => (u && u !== "/" ? u.replace(/\/$/, "") : u);
    const allow = new Set(sitemapPages || []);
    return (all || []).filter((item) => {
      const data = item.data || {};
      return allow.has(norm(item.url)) && !data.noindex;
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
    },
    htmlTemplateEngine: "njk",
    // Only .njk files are processed as templates; the legacy .html files above
    // are handled purely by passthrough copy and never touched by the engine.
    templateFormats: ["njk"],
  };
};

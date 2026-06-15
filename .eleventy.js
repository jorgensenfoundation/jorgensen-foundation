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

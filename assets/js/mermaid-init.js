// Renders ```mermaid fenced code blocks as diagrams.
// kramdown emits them as <pre><code class="language-mermaid">, which we swap for
// a container mermaid can draw into. Module scripts are deferred, so this runs
// after parsing but before DOMContentLoaded - which is how the replaced blocks
// avoid picking up a "Copy" button from copy-code.js.
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

const diagrams = [];

document.querySelectorAll("pre > code.language-mermaid").forEach((code) => {
  const host = document.createElement("div");
  host.className = "mermaid";
  host.dataset.source = code.textContent;
  host.textContent = code.textContent;
  code.parentElement.replaceWith(host);
  diagrams.push(host);
});

if (diagrams.length) {
  const isDark = () => {
    const chosen = document.documentElement.getAttribute("data-theme");
    if (chosen) return chosen === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  };

  let pending = null;

  const render = () => {
    diagrams.forEach((el) => {
      el.textContent = el.dataset.source;
      el.removeAttribute("data-processed");
    });
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark() ? "dark" : "default",
      securityLevel: "strict",
      flowchart: { useMaxWidth: true, htmlLabels: true },
    });
    pending = mermaid.run({ nodes: diagrams });
    return pending;
  };

  // Re-render on theme change. A MutationObserver keeps this independent of the
  // order the toggle's own click handler happens to be registered in.
  const rerender = () => {
    Promise.resolve(pending).then(render);
  };

  new MutationObserver(rerender).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (!document.documentElement.getAttribute("data-theme")) rerender();
    });

  render();
}

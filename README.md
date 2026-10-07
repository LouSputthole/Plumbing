# Legacy Plumbing Group — website

Static site, no build step. Edit the HTML/CSS, push to `main`, Netlify deploys.

- `index.html` — the site. `book.html` — Cal.com estimate booking. `thank-you.html`, `404.html`.
- `styles.css` — all styling. `assets/` — photos (already compressed; keep new ones under ~500 KB).
- `netlify.toml` — redirects + headers. Forms are Netlify Forms (`data-netlify`), nothing to run.
- `docs/PLAN.md` — the ops/automation plan and launch checklist. Read it.

Before launch, replace every placeholder:

```
grep -rn "REPLACE_" --include=*.html .
```

Local preview: `python -m http.server 8765` then open http://localhost:8765/ (the form only
works on Netlify).

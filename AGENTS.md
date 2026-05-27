<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Situational Unawareness — the AI-stack map

A Next.js app that renders the AI supply-chain stack as a 3D force graph.
The data behind it lives in `/data` (`companies.yml` + `deals/*.yml`).

**Adding deals or companies?** Read **`data/AGENTS.md`** — it has the schema,
the layer taxonomy, and step-by-step instructions (including how to place a new
company on the correct layer). The dataset is plain YAML in this repo: edit,
commit, push, and Vercel redeploys automatically.

Verify data changes with `npm run build` (validates every record; watch for
`[data] skipping …` warnings) and check the company/deal counts on the map.

#!/usr/bin/env node
/**
 * Fetches the OpenAPI spec from the running backend and generates a Markdown
 * page for each API tag group at docs/api/endpoints/<tag>.md
 *
 * Usage:
 *   node docs-site/scripts/fetch-openapi.js
 *
 * Requires the backend to be running at http://localhost:8000.
 * Run `make dev-backend` first, then run this script, then `make docs`.
 */

const http = require('http')
const fs = require('fs')
const path = require('path')

const OPENAPI_URL = 'http://localhost:8000/openapi.json'
const OUT_DIR = path.join(__dirname, '..', 'docs', 'api', 'endpoints')

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Failed to parse JSON: ${e.message}`)) }
      })
    }).on('error', reject)
  })
}

function httpMethodLabel(method) {
  return method.toUpperCase()
}

function renderParams(params) {
  if (!params || params.length === 0) return ''
  const rows = params
    .map((p) => `| \`${p.name}\` | ${p.in} | ${p.required ? 'Yes' : 'No'} | ${p.schema?.type ?? ''} | ${p.description ?? ''} |`)
    .join('\n')
  return `\n**Parameters**\n\n| Name | In | Required | Type | Description |\n|------|-----|----------|------|-------------|\n${rows}\n`
}

function renderBody(requestBody) {
  if (!requestBody) return ''
  const content = requestBody.content?.['application/json']
  if (!content?.schema) return ''
  const props = content.schema.properties ?? {}
  const required = content.schema.required ?? []
  const rows = Object.entries(props)
    .map(([name, schema]) => `| \`${name}\` | ${required.includes(name) ? 'Yes' : 'No'} | ${schema.type ?? ''} | ${schema.description ?? ''} |`)
    .join('\n')
  if (!rows) return ''
  return `\n**Request body**\n\n| Field | Required | Type | Description |\n|-------|----------|------|-------------|\n${rows}\n`
}

function renderResponses(responses) {
  if (!responses) return ''
  const lines = Object.entries(responses).map(([code, resp]) => {
    return `- **${code}** — ${resp.description ?? ''}`
  })
  return `\n**Responses**\n\n${lines.join('\n')}\n`
}

async function main() {
  console.log(`Fetching OpenAPI spec from ${OPENAPI_URL} ...`)
  let spec
  try {
    spec = await fetch(OPENAPI_URL)
  } catch (e) {
    console.error(`\nError: could not reach ${OPENAPI_URL}`)
    console.error('Make sure the backend is running: make dev-backend')
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Group paths by their first tag
  const byTag = {}
  for (const [route, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        const tag = (op.tags?.[0] ?? 'misc').toLowerCase().replace(/\s+/g, '-')
        if (!byTag[tag]) byTag[tag] = []
        byTag[tag].push({ route, method, op })
      }
    }
  }

  for (const [tag, endpoints] of Object.entries(byTag)) {
    const lines = [
      `---`,
      `title: ${tag.charAt(0).toUpperCase() + tag.slice(1)} endpoints`,
      `sidebar_label: ${tag.charAt(0).toUpperCase() + tag.slice(1)}`,
      `---`,
      ``,
      `# ${tag.charAt(0).toUpperCase() + tag.slice(1)} API`,
      ``,
      `> Auto-generated from the OpenAPI spec. Run \`node docs-site/scripts/fetch-openapi.js\` to regenerate.`,
      ``,
    ]

    for (const { route, method, op } of endpoints) {
      lines.push(`## \`${httpMethodLabel(method)} ${route}\``)
      lines.push(``)
      if (op.summary) lines.push(op.summary)
      if (op.description) lines.push(`\n${op.description}`)
      lines.push(``)
      lines.push(renderParams(op.parameters))
      lines.push(renderBody(op.requestBody))
      lines.push(renderResponses(op.responses))
      lines.push(`---`)
      lines.push(``)
    }

    const outFile = path.join(OUT_DIR, `${tag}.md`)
    fs.writeFileSync(outFile, lines.join('\n'))
    console.log(`  Wrote ${path.relative(process.cwd(), outFile)} (${endpoints.length} endpoints)`)
  }

  console.log(`\nDone. ${Object.keys(byTag).length} tag files written to ${path.relative(process.cwd(), OUT_DIR)}/`)
  console.log('Add the generated files to docs-site/sidebars.ts under the API Reference category.')
}

main()

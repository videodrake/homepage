import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProfiles } from './profiles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- CLI args --------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [[m[1], m[2] ?? true]] : [];
  })
);

const MODE = args.mode || 'sample';           // sample | full
const COUNT = Number(args.count) || (MODE === 'sample' ? 5 : 100);
const SEED = Number(args.seed) || 42;
const CONCURRENCY = Number(args.concurrency) || 2;
const PROMPT = args.prompt;                   // required for full mode
const MODEL =
  args.model ||
  (MODE === 'sample' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6');

// --- API client ------------------------------------------------------------
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Put it in tools/generate-reviews/.env');
  process.exit(1);
}
const client = new Anthropic();

// --- Prompt loading --------------------------------------------------------
function stripFrontmatter(md) {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  return end === -1 ? md : md.slice(end + 4).replace(/^\s+/, '');
}

function loadShared() {
  const path = join(__dirname, 'prompts', '_shared.md');
  return existsSync(path) ? stripFrontmatter(readFileSync(path, 'utf8')) : '';
}

function loadPrompt(name) {
  const path = join(__dirname, 'prompts', `${name}.md`);
  const body = stripFrontmatter(readFileSync(path, 'utf8'));
  const shared = loadShared();
  return shared ? `${shared}\n\n---\n\n${body}` : body;
}

function listPrompts() {
  return readdirSync(join(__dirname, 'prompts'))
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => basename(f, '.md'));
}

function renderPrompt(template, profile) {
  return template.replace('{{PROFILE_JSON}}', JSON.stringify(profile, null, 2));
}

// --- API call with retry on 429 --------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateBody(promptText, attempt = 1) {
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: promptText }],
    });
    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return { body: text, usage: resp.usage };
  } catch (err) {
    const status = err?.status || err?.response?.status;
    if ((status === 429 || status === 529 || status >= 500) && attempt < 6) {
      // Use retry-after header if present, else exponential backoff with jitter
      const retryAfter = Number(err?.headers?.['retry-after']) || 0;
      const backoff = retryAfter > 0
        ? retryAfter * 1000
        : Math.min(60000, 2000 * Math.pow(2, attempt - 1)) + Math.random() * 1000;
      await sleep(backoff);
      return generateBody(promptText, attempt + 1);
    }
    throw err;
  }
}

// --- Concurrency pool ------------------------------------------------------
async function pool(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { error: err.message || String(err), item: items[i] };
      }
      process.stdout.write(`\r  ${Math.min(cursor, items.length)}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  process.stdout.write('\n');
  return results;
}

// --- Run one prompt variant ------------------------------------------------
async function runPrompt(promptName, profiles) {
  const template = loadPrompt(promptName);
  let inputTok = 0, outputTok = 0;

  const results = await pool(
    profiles,
    async (profile) => {
      const rendered = renderPrompt(template, profile);
      const { body, usage } = await generateBody(rendered);
      inputTok += usage.input_tokens || 0;
      outputTok += usage.output_tokens || 0;
      return { profile, body };
    },
    CONCURRENCY
  );

  return { promptName, results, usage: { input: inputTok, output: outputTok } };
}

// --- Cost estimate (USD, rough) --------------------------------------------
const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-4-6':         { input: 3, output: 15 },
  'claude-opus-4-7':           { input: 15, output: 75 },
};
function estimateCost(model, usage) {
  const p = PRICING[model];
  if (!p) return null;
  return (usage.input * p.input + usage.output * p.output) / 1_000_000;
}

// --- Main ------------------------------------------------------------------
async function main() {
  console.log(`mode=${MODE}  count=${COUNT}  model=${MODEL}  seed=${SEED}  concurrency=${CONCURRENCY}`);
  const profiles = buildProfiles(COUNT, SEED);

  if (MODE === 'sample') {
    const prompts = PROMPT ? [PROMPT] : listPrompts();
    const dir = join(__dirname, 'samples');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    for (const name of prompts) {
      console.log(`\n[${name}] generating ${COUNT}...`);
      const run = await runPrompt(name, profiles);
      const path = join(dir, `${name}.json`);
      writeFileSync(path, JSON.stringify(run.results, null, 2));
      const cost = estimateCost(MODEL, run.usage);
      console.log(`  saved ${path}   tokens=${run.usage.input}+${run.usage.output}   est=$${cost?.toFixed(4)}`);
    }
    return;
  }

  if (MODE === 'full') {
    if (!PROMPT) {
      console.error('--prompt=<name> required for full mode. Available:', listPrompts().join(', '));
      process.exit(1);
    }
    const dir = join(__dirname, 'output');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    console.log(`\n[${PROMPT}] generating ${COUNT}...`);
    const run = await runPrompt(PROMPT, profiles);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const path = join(dir, `reviews-${PROMPT}-${stamp}.json`);
    writeFileSync(path, JSON.stringify(run.results, null, 2));
    const cost = estimateCost(MODEL, run.usage);
    console.log(`  saved ${path}   tokens=${run.usage.input}+${run.usage.output}   est=$${cost?.toFixed(4)}`);
    return;
  }

  console.error('unknown --mode:', MODE);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { readFileSync, writeFileSync } from "node:fs";

const path = ".output/server/wrangler.json";
const config = JSON.parse(readFileSync(path, "utf8"));
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Missing public backend deployment settings.");
if (!url.startsWith("https://")) throw new Error("Backend URL must use HTTPS.");
config.vars = { ...config.vars, SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key };
writeFileSync(path, JSON.stringify(config, null, 2));
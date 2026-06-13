const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
];

const aiProviders = [
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "COHERE_API_KEY",
  "XAI_API_KEY",
];

const urls = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_APP_URL"];
const positiveIntegers = [
  "NEXT_PUBLIC_FREE_MESSAGE_LIMIT",
  "CHAT_RATE_LIMIT_REQUESTS",
  "CHAT_RATE_LIMIT_WINDOW_MS",
  "MAX_CHAT_PAYLOAD_BYTES",
  "WEB_SEARCH_TIMEOUT_MS",
];

const missing = required.filter((name) => !process.env[name]?.trim());
const invalid = [];

for (const name of urls) {
  const value = process.env[name];

  if (!value) {
    continue;
  }

  try {
    new URL(value);
  } catch {
    invalid.push(`${name} must be a valid URL.`);
  }
}

for (const name of positiveIntegers) {
  const value = process.env[name];

  if (!value) {
    continue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    invalid.push(`${name} must be a positive integer.`);
  }
}

if (!aiProviders.some((name) => process.env[name]?.trim())) {
  invalid.push(`At least one AI provider key is required: ${aiProviders.join(", ")}.`);
}

if (missing.length > 0 || invalid.length > 0) {
  for (const name of missing) {
    console.error(`Missing required environment variable: ${name}`);
  }

  for (const message of invalid) {
    console.error(message);
  }

  process.exit(1);
}

console.log("Production environment looks ready.");

/**
 * V4 — Optional LLM adapter.
 *
 * This is the ONLY place in V4 that may talk to a language model, and it is
 * OFF by default. Nothing here is required for the engine, the generators or
 * the tests to work: with no provider configured the tooling falls back to
 * the deterministic generators.
 *
 * Rules this module keeps:
 *   - no key, URL, token or endpoint is hardcoded — the endpoint and the key
 *     come from environment variables;
 *   - the key is never logged, never returned and never written to a file;
 *   - when the environment is not configured the adapter reports why, and the
 *     caller falls back to the offline path.
 */

/** The environment variables the adapter reads. */
export const LLM_ENV = {
  endpoint: 'V4_LLM_ENDPOINT',
  key: 'V4_LLM_KEY',
  model: 'V4_LLM_MODEL',
};

/** Why the adapter is unavailable, in words a developer can act on. */
export function unavailableReason(env = process.env, enabled = false) {
  if (!enabled) {
    return `LLM assistance is disabled by default. Set ${LLM_ENV.endpoint} and ${LLM_ENV.key} and enable it explicitly.`;
  }
  const endpoint = env?.[LLM_ENV.endpoint];
  const key = env?.[LLM_ENV.key];
  if (!endpoint) return `${LLM_ENV.endpoint} is not set.`;
  if (!key) return `${LLM_ENV.key} is not set.`;
  if (!/^https?:\/\/[^\s]+$/i.test(String(endpoint))) {
    return `${LLM_ENV.endpoint} must be an http(s) URL.`;
  }
  return null;
}

/** Remove a secret from a string so it can safely be logged. */
export function redact(text, secret) {
  let out = String(text ?? '');
  if (secret) out = out.split(secret).join('[redacted]');
  return out.replace(/(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|Bearer\s+[A-Za-z0-9._-]{10,})/g, '[redacted]');
}

/**
 * Create an LLM adapter.
 *
 * @param {{env?:object, enabled?:boolean, timeoutMs?:number, fetchImpl?:Function}} [opts]
 */
export function createLlmAdapter({
  env = process.env,
  enabled = false,
  timeoutMs = 30000,
  fetchImpl = globalThis.fetch,
} = {}) {
  const secret = () => env?.[LLM_ENV.key] ?? null;

  const adapter = {
    /** Is a provider configured and reachable from this process? */
    status() {
      const reason = unavailableReason(env, enabled);
      if (reason) return { available: false, reason, endpoint: null, model: null };
      return {
        available: true,
        reason: 'configured',
        endpoint: env[LLM_ENV.endpoint],
        model: env[LLM_ENV.model] ?? null,
      };
    },

    /** Convenience predicate for `status().available`. */
    isAvailable() {
      return adapter.status().available;
    },

    /**
     * Send a prompt to the configured provider.
     *
     * Throws when no provider is configured — callers are expected to catch
     * that and fall back to the deterministic generators.
     */
    async complete(prompt, { system = null, model = null } = {}) {
      const status = adapter.status();
      if (!status.available) throw new Error(status.reason);
      if (typeof fetchImpl !== 'function') {
        throw new Error('no fetch implementation available in this runtime');
      }

      const payload = {
        model: model ?? env[LLM_ENV.model] ?? null,
        prompt: String(prompt ?? ''),
      };
      if (system) payload.system = String(system);

      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

      try {
        const response = await fetchImpl(env[LLM_ENV.endpoint], {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${secret()}`,
          },
          body: JSON.stringify(payload),
          signal: controller?.signal,
        });

        const raw = await response.text();
        if (!response.ok) {
          // The key is never part of this message.
          throw new Error(`LLM request failed with status ${response.status}: ${redact(raw, secret())}`);
        }
        return adapter.parse(raw);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },

    /**
     * Pull the text out of a provider response. The wire format differs
     * between providers, so the common shapes are tried in turn and the raw
     * body is returned when none of them fit.
     */
    parse(raw) {
      let doc;
      try {
        doc = JSON.parse(raw);
      } catch {
        return { text: String(raw), raw };
      }
      const candidates = [
        doc?.text,
        doc?.output,
        doc?.output_text,
        doc?.choices?.[0]?.message?.content,
        doc?.choices?.[0]?.text,
        doc?.content?.[0]?.text,
        doc?.result,
      ];
      const text = candidates.find((c) => typeof c === 'string' && c.length);
      return { text: text ?? '', raw: doc };
    },
  };

  return adapter;
}

/**
 * The default adapter: off, and pointed at `process.env`.
 */
export function defaultLlmAdapter(options = {}) {
  return createLlmAdapter(options);
}

/**
 * Run the LLM when it is configured, and fall back to the deterministic
 * generator when it is not. The fallback is always used offline.
 */
export async function withLlm({ prompt, fallback, adapter = defaultLlmAdapter() } = {}) {
  if (!adapter.isAvailable()) {
    const result = await fallback();
    return { source: 'fallback', reason: adapter.status().reason, result };
  }
  try {
    const result = await adapter.complete(prompt);
    return { source: 'llm', reason: null, result };
  } catch (err) {
    const result = await fallback();
    return { source: 'fallback', reason: redact(err?.message ?? String(err)), result };
  }
}

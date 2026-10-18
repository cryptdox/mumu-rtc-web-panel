import type { ReactNode } from "react";
import { CodeBlock } from "@/components/ui";
import { config } from "@/config";

const api = config.apiUrl;

const serverToken = `# On your backend — never in the browser
curl -X POST ${api}/api/server/token \\
  -u "$MUMU_API_KEY:$MUMU_API_SECRET" \\
  -H "content-type: application/json" \\
  -d '{ "externalUserId": "user-42", "channelName": "team-standup", "role": "PUBLISHER", "ttlSeconds": 3600 }'`;

const clientJoin = `// In the client
const res = await fetch("${api}/api/rtc/join", {
  method: "POST",
  headers: { authorization: \`Bearer \${rtcToken}\`, "content-type": "application/json" },
  body: JSON.stringify({ region: "ap-south-1" }), // optional
});
const { data } = await res.json();
// data.wsUrl, data.joinToken (valid 60s), data.iceServers
const ws = new WebSocket(\`\${data.wsUrl}?token=\${data.joinToken}\`);`;

const verifyWebhook = `import crypto from "node:crypto";

// Express: app.post("/mumu/webhook", express.raw({ type: "application/json" }), handler)
function verify(rawBody, signatureHeader, secret) {
  const [, t, v1] = /^t=(\\d+),v1=([0-9a-f]+)$/.exec(signatureHeader) ?? [];
  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5 min tolerance
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`;

const selfSign = `import jwt from "jsonwebtoken";

// Optional: sign RTC tokens yourself, no API call needed
const token = jwt.sign({ ch: "team-standup", role: "PUBLISHER" }, MUMU_API_SECRET, {
  algorithm: "HS256",
  keyid: MUMU_API_KEY,
  issuer: "mumu-rtc",
  subject: "user-42",
  jwtid: crypto.randomUUID(),
  expiresIn: 3600,
});`;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function Docs() {
  const toc = [
    ["concepts", "Concepts"],
    ["token", "1. Issue a token"],
    ["join", "2. Join from the client"],
    ["webhooks", "3. Receive webhooks"],
    ["self-sign", "Signing tokens yourself"],
    ["recording", "Recording"],
  ];
  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-4 py-12">
      <aside className="sticky top-20 hidden h-fit w-48 shrink-0 text-sm md:block">
        <p className="mb-2 font-semibold">Quickstart</p>
        <ul className="space-y-1.5">
          {toc.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="text-slate-600 hover:text-brand-600 dark:text-slate-400">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </aside>

      <article className="min-w-0 flex-1 space-y-10 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Quickstart</h1>
          <p className="mt-2">From zero to a working call. Create a project in the console first to get your API key and secret.</p>
        </header>

        <Section id="concepts" title="Concepts">
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Project</b>: one app. Owns an API key (public) and API secret (server only).</li>
            <li><b>Channel</b>: a named room inside a project. Created automatically on first join.</li>
            <li><b>RTC token</b>: a short-lived JWT your backend issues for one user in one channel.</li>
            <li><b>Media node</b>: the server that carries the audio/video. Assigned for you on join.</li>
          </ul>
        </Section>

        <Section id="token" title="1. Issue a token from your backend">
          <p>Authenticate with HTTP Basic using your API key and secret. The response contains <code>data.token</code>.</p>
          <CodeBlock language="bash" code={serverToken} />
        </Section>

        <Section id="join" title="2. Join from the client">
          <p>Send the token to <code>/api/rtc/join</code>. You get the media node to connect to, a 60-second join token and ICE servers (STUN/TURN).</p>
          <CodeBlock language="js" code={clientJoin} />
        </Section>

        <Section id="webhooks" title="3. Receive webhooks">
          <p>
            Add an endpoint in the console. Every request carries <code>x-mumu-signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> — an
            HMAC-SHA256 of <code>"&lt;t&gt;.&lt;raw body&gt;"</code> with your endpoint secret. Return any 2xx to acknowledge; failures are
            retried with exponential backoff. Delivery order isn't guaranteed — use <code>createdAt</code>.
          </p>
          <CodeBlock language="js" code={verifyWebhook} />
          <p>
            Event types: <code>CHANNEL_CREATED</code>, <code>CHANNEL_DELETED</code>, <code>SESSION_STARTED</code>, <code>SESSION_ENDED</code>,{" "}
            <code>USER_JOINED</code>, <code>USER_LEFT</code>, <code>RECORDING_STARTED</code>, <code>RECORDING_COMPLETED</code>,{" "}
            <code>RECORDING_FAILED</code>.
          </p>
        </Section>

        <Section id="self-sign" title="Signing tokens yourself">
          <p>Tokens are standard HS256 JWTs, so your backend can mint them without calling the API. Self-signed tokens can't be revoked individually — rotate the secret instead.</p>
          <CodeBlock language="js" code={selfSign} />
        </Section>

        <Section id="recording" title="Recording">
          <p>
            Start a recording while a channel is live, from the console or with <code>POST /api/server/recording</code> and{" "}
            <code>{`{ "channelName": "team-standup" }`}</code>. You'll get <code>RECORDING_STARTED</code> and later{" "}
            <code>RECORDING_COMPLETED</code> with the storage path.
          </p>
        </Section>
      </article>
    </div>
  );
}

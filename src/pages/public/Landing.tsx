import { Link } from "react-router";
import { Button } from "@/components/ui";

const features = [
  { title: "Video, voice & live", body: "One SDK for 1:1 calls, group rooms and live streams, routed through a scalable SFU." },
  { title: "Signed tokens", body: "Your backend issues short-lived RTC tokens. Revoke any of them instantly." },
  { title: "Smart placement", body: "Rooms land on the least-loaded media node in the closest region — and stay there." },
  { title: "Cloud recording", body: "Start and stop recordings from the console or your server API." },
  { title: "Signed webhooks", body: "Users joined, rooms ended, recordings ready — delivered with retries and HMAC signatures." },
  { title: "Usage metering", body: "Per-project minutes and storage, with summaries ready for billing." },
];

const steps = [
  { n: "1", title: "Create a project", body: "Get an API key and secret for your app." },
  { n: "2", title: "Issue a token", body: "Your backend calls POST /api/server/token for each user." },
  { n: "3", title: "Join", body: "The client SDK exchanges the token for a media node and connects." },
  { n: "4", title: "Listen", body: "Receive webhooks and watch usage in the console." },
];

export default function Landing() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
        <p className="text-sm font-medium text-brand-600">Real-time communication platform</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Add live video and voice to your app in an afternoon
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          MUMU RTC gives you tokens, media servers, recording, webhooks and usage metering — you bring the product.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register">
            <Button className="px-5 py-2.5">Start building</Button>
          </Link>
          <Link to="/docs">
            <Button variant="secondary" className="px-5 py-2.5">
              Read the quickstart
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{s.n}</span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Ready when you are</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Create a free account and your first project.</p>
        <Link to="/register" className="mt-6 inline-block">
          <Button className="px-5 py-2.5">Create account</Button>
        </Link>
      </section>
    </>
  );
}

import Link from "next/link";
import { ArrowRight, Check, FileSearch, FileUp, ListOrdered, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { linkButton } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/badges";
import { APP, PLANS } from "@/config/app";

const STEPS = [
  { Icon: FileUp, title: "Upload your documents", body: "PRDs, plans, budgets, contracts, spreadsheets. PDF, DOCX, XLSX, CSV, TXT and Markdown." },
  { Icon: FileSearch, title: "Blindspot reads them together", body: "It looks for what's assumed but unstated, what's missing, and where documents disagree. Every finding links to the passage behind it." },
  { Icon: ListOrdered, title: "Get a ranked list", body: "Findings are scored by impact, likelihood, irreversibility, proximity and cost to fix, so you know what to ask first." },
];

const USE_CASES = [
  { role: "Project manager", body: "Check the plan, budget and contract agree before the kickoff, not after the first missed date." },
  { role: "Business analyst", body: "Find the requirements nobody wrote down and the questions stakeholders haven't been asked." },
  { role: "Founder", body: "Stress-test a launch plan and budget before you commit money and a team to them." },
  { role: "Consultant", body: "Review a client's documents quickly and walk into the first meeting with specific questions." },
];

const FAQ = [
  { q: "Is my data used to train models?", a: "No. Your documents are never used to train models. You can delete a project, or all of your data, at any time and the files and extracted text are removed." },
  { q: "How is this different from a risk register?", a: "A risk register lists risks someone has already thought of. Blindspot looks for the ones that aren't written anywhere: a missing rollback plan, a date that disagrees with another document, a vendor dependency nobody owns." },
  { q: "How do I know a finding is real?", a: "Each finding shows the quotes or cells it is based on. For things that are missing, it lists the documents it checked. It also tells you what would prove it wrong, and you can mark it rejected with a reason." },
  { q: "What file types can I upload?", a: "PDF, DOCX, XLSX, CSV, TXT and Markdown, up to 25 MB each. Scanned PDFs without selectable text can't be read." },
  { q: "Will it find everything?", a: "No. It reduces blind spots; it doesn't remove them. Treat findings as questions to ask, not verdicts." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <a href="#pricing" className="t-fast hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground sm:block">
            Pricing
          </a>
          <a href="#faq" className="t-fast hidden rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground sm:block">
            FAQ
          </a>
          <ThemeToggle />
          <Link href="/sign-in" className={linkButton({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Find what your project documents leave out</h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted">{APP.tagline}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/sign-up" className={linkButton({ size: "lg" })}>
              Try a free scan <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-subtle">
            <Lock aria-hidden className="size-3.5" /> {APP.privacyStatement}
          </p>
        </section>

        <section aria-labelledby="example" className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 id="example" className="sr-only">
            Example finding
          </h2>
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-sm sm:p-6">
            <p className="mb-3 text-xs font-medium text-subtle">Example from the sample project in the app</p>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity="CRITICAL" />
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-inset ring-border">Contradiction</span>
              <span className="text-xs text-muted">Evidence-backed</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold leading-snug">The PRD commits to go-live on 15 March 2027, but the migration plan schedules cutover for 30 April 2027</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <blockquote className="rounded-lg border border-border p-3 text-sm">
                “Go-live is 15 March 2027, which is the date we have committed to the finance leadership team.”
                <footer className="mt-1.5 text-xs text-subtle">Meridian-Billing-PRD.md · lines 8-9</footer>
              </blockquote>
              <blockquote className="rounded-lg border border-border p-3 text-sm">
                “Cutover weekend and go-live: 30 April 2027”
                <footer className="mt-1.5 text-xs text-subtle">Meridian-Migration-Plan.md · lines 5-9</footer>
              </blockquote>
            </div>
            <p className="mt-4 text-sm text-muted">
              <span className="font-medium text-foreground">Ask:</span> Which go-live date is real, and has finance been told about the six-week gap?
            </p>
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="how" className="text-center text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ Icon, title, body }, i) => (
              <li key={title} className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
                <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">
                  {i + 1}. {title}
                </h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="who" className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 id="who" className="text-center text-2xl font-semibold tracking-tight">
              Who it&apos;s for
            </h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((u) => (
                <li key={u.role}>
                  <h3 className="text-base font-semibold">{u.role}</h3>
                  <p className="mt-1.5 text-sm text-muted">{u.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" aria-labelledby="pricing-h" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 id="pricing-h" className="text-center text-2xl font-semibold tracking-tight">
            Pricing
          </h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((k) => {
              const p = PLANS[k];
              return (
                <li key={k} className={`rounded-[var(--radius-card)] border bg-surface p-6 ${k === "PRO" ? "border-accent ring-1 ring-accent" : "border-border"}`}>
                  <h3 className="text-base font-semibold">{p.label}</h3>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{p.price}</p>
                  <p className="mt-1 text-sm text-muted">{p.blurb}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    <li className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok-fg" /> {p.maxProjects} projects
                    </li>
                    <li className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok-fg" /> {p.maxDocsPerMonth} documents a month
                    </li>
                    <li className="flex gap-2">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok-fg" /> PDF and CSV export
                    </li>
                  </ul>
                  <Link href="/sign-up" className={linkButton({ variant: k === "PRO" ? "primary" : "secondary" }) + " mt-6 w-full"}>
                    {k === "FREE" ? "Start free" : `Choose ${p.label}`}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-center text-xs text-subtle">Paid plans are listed for planning. Billing isn&apos;t connected yet, so every new account starts on Free.</p>
        </section>

        <section id="faq" aria-labelledby="faq-h" className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <h2 id="faq-h" className="text-center text-2xl font-semibold tracking-tight">
            Questions
          </h2>
          <div className="mt-8 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="t-fast flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-lg leading-none text-subtle transition-transform duration-150 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="measure mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-subtle sm:px-6">
          <span>
            © {new Date().getFullYear()} {APP.name}
          </span>
          <span className="flex items-center gap-1.5">
            <Lock aria-hidden className="size-3.5" /> {APP.privacyStatement}
          </span>
          <a href={`mailto:${APP.supportEmail}`} className="hover:text-foreground">
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
}

import { PoseReadinessCheck } from "@/components/pose-readiness-check";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 sm:px-10">
        <p className="mb-5 text-sm font-semibold tracking-[0.22em] text-emerald-400 uppercase">
          Golf Swing Analyser
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Understand the movement behind your swing.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Upload a face-on swing video to review pose tracking, timing, movement
          data, and evidence-linked AI observations. Video processing stays on
          your device.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Upload", "Choose a short, face-on swing video."],
            ["2", "Review", "Inspect tracked movement and mark key phases."],
            [
              "3",
              "Understand",
              "Read a grounded report linked to the evidence.",
            ],
          ].map(([number, title, description]) => (
            <section
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
              key={number}
            >
              <span className="text-sm font-semibold text-emerald-400">
                {number}
              </span>
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {description}
              </p>
            </section>
          ))}
        </div>
        <PoseReadinessCheck />
        <p className="mt-10 text-sm text-slate-500">
          Technical foundation in progress. Club and ball-flight metrics are not
          inferred from body pose.
        </p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold tracking-wide">TABLE PLUS WEB</h1>
      </header>

      <main className="grid h-[calc(100vh-49px)] grid-cols-[280px_1fr]">
        <aside className="border-r border-zinc-800 p-3">
          <p className="mb-3 text-xs uppercase tracking-wide text-zinc-400">
            Items
          </p>
          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">
            Planejamento concluido.
            <br />
            Proxima etapa: integrar File System Access API + SQLite WASM.
          </div>
        </aside>

        <section className="p-3">
          <div className="h-full rounded-md border border-zinc-800 bg-zinc-900/60" />
        </section>
      </main>
    </div>
  );
}

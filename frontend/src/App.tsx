import { Routes, Route, Navigate } from 'react-router-dom';

type PlaceholderPageProps = {
  title: string;
};

function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">SOFEM MES v6</p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-neutral-400">This page is wired and ready for feature implementation.</p>
      </section>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PlaceholderPage title="Login" />} />
      <Route path="/admin" element={<PlaceholderPage title="Admin Dashboard" />} />
      <Route path="/operator" element={<PlaceholderPage title="Operator Dashboard" />} />
    </Routes>
  );
}

export default App;

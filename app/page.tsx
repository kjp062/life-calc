import LifeCalculator from './components/LifeCalculator';

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-16">
      <div className="w-full max-w-3xl mx-auto space-y-10">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Life Calculator
          </h1>
          <p className="text-lg text-slate-500">
            See what your money makes possible — and build a life you actually want.
          </p>
        </div>

        <LifeCalculator />
      </div>
    </main>
  );
}

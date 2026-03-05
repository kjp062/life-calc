import LifeCalculator from './components/LifeCalculator';

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <div className="space-y-1.5 pt-2">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Life Calculator
          </h1>
          <p className="text-base text-stone-500">
            See what your money makes possible.
          </p>
        </div>

        <LifeCalculator />
      </div>
    </main>
  );
}

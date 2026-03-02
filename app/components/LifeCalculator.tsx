'use client';

import { useState } from 'react';
import Calculator from './Calculator';
import RetirementTarget from './RetirementTarget';

export default function LifeCalculator() {
  const [age, setAge] = useState<number | null>(null);

  return (
    <div className="space-y-16">
      <section className="space-y-3">
        <SectionHeader
          title="Savings projection"
          description="Where you're headed based on what you're saving today."
        />
        <Calculator onAgeChange={setAge} />
      </section>

      {age !== null && age < 65 && (
        <section className="space-y-3">
          <SectionHeader
            title="Retirement target"
            description="How much you'll need saved to cover your lifestyle in retirement."
          />
          <RetirementTarget age={age} />
        </section>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

# Life Calculator — Project Context

## What We're Building
A personal finance projection web app that helps people understand their current financial situation and what options they have to craft a life aligned with their desires. 
Built with Next.js, deployed on Vercel.

## Project Status
Phase 2: Retirement target + savings breakpoints built. Ready for Vercel deployment.

## Three Agents

### The Developer
Responsible for implementation. Writes clean, readable code. 
Explains what it builds in plain English after each task. 
Prioritizes working software over perfect software. 
Never builds more than what was asked.

### The Designer
Responsible for how the app looks and feels. Prioritizes clarity 
and simplicity over complexity. Uses a clean, modern aesthetic. 
References the design principle: the app should feel calm and 
empowering, not anxiety-inducing. Typography and whitespace matter.
Inspired by the personal finance app Monarch.

### The Executive Partner
Responsible for product decisions. Asks clarifying questions before 
building. Challenges scope creep. Keeps the project moving toward 
the definition of done. Flags when something is nice-to-have versus 
necessary.

## Technical Stack
- Framework: Next.js
- Deployment: Vercel
- Styling: Tailwind CSS
- Charts: Recharts

## Definition of Done
A publicly accessible web app at a real URL that anyone can use.

## Design Principles
- Feel calm and empowering
- Outputs should feel personal, not generic
- Simple inputs, meaningful outputs
- Mobile friendly

## Current Phase Goals
[x] Repository set up
[x] CLAUDE.md established
[x] Skeleton app deployed to Vercel
[x] Three agents defined

## Features Built

### Savings Projection (Iteration 1 — MVP)
[x] Inputs: current age, current savings, monthly savings, annual raise rate
[x] Up to 3 salary change breakpoints (age, new monthly savings, new raise rate)
[x] Projects portfolio value at age 59 and age 65
[x] Three return scenarios: 8%, 9%, 10% nominal (assumes 3% inflation)
[x] Line chart (Recharts) showing growth over time with reference lines at 59 and 65
[x] Summary cards with dollar amounts per scenario

### Retirement Target (Iteration 2)
[x] Input: current monthly spending
[x] Lifestyle inflation selector: Conservative (0.5%), Moderate (1.5%), Aggressive (3%), Custom
[x] Math: general inflation (3%) + lifestyle inflation compound multiplicatively each year
[x] Output: target nest egg at age 59 and 65 using 4% withdrawal rule (25x annual spending)
[x] Shows projected monthly spending at retirement age

### Both sections share age state — entered once in the savings section.

[ ] Deployed to Vercel

## Key Decisions
- Nominal returns (8/9/10%) chosen to reflect historical trends; output in future dollars
- No FIRE or optionality features yet — intentionally scoped out
- Monthly compounding using standard growing annuity FV formula
- 4% withdrawal rule (25x) baked in — not user-configurable
- Lifestyle inflation is additive on top of 3% general inflation, compounded multiplicatively
- BLS CEX research complete (2022 data, knowledge cutoff Aug 2025) — saved to research/bls-consumer-expenditure.json
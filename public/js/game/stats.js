export function computeRankings(world) {
  const countries = world.countries;
  const make = (key) => countries
    .map(c => ({ id: c.id, name: c.shortName, value: key(c) }))
    .filter(r => typeof r.value === 'number' && isFinite(r.value))
    .sort((a, b) => b.value - a.value);

  // Кэш военной мощи — чтобы не считать 150 раз в sort
  const milPowerCache = new Map(countries.map(c => [c.id, computeMilitaryPower(c)]));

  return {
    // Экономика
    gdp: make(c => c.gdp || 0),
    gdpPerCapita: make(c => c.gdpPerCapita || 0),
    gdpGrowth: make(c => (c.growth || 0) * 12 * 100),
    economicFreedom: make(c => computeEconomicFreedom(c)),
    budget: make(c => c.budget || 0),
    debt: make(c => c.debt || 0),
    debtRatio: make(c => (c.gdp > 0 ? (c.debt / c.gdp) * 100 : 0)),
    inflation: make(c => (c.inflation || 0) * 100),
    unemployment: make(c => (c.unemployment || 0) * 100),
    poverty: make(c => (c.poverty || 0) * 100),

    // География
    area: make(c => c.area || 0),
    population: make(c => c.population || 0),
    density: make(c => (c.area > 0 ? c.population / c.area : 0)),

    // Общество
    education: make(c => c.educationLevel || 0),
    healthcare: make(c => c.healthcareLevel || 0),
    literacy: make(c => (c.literacy || 0) * 100),
    lifeExpectancy: make(c => c.lifeExpectancy || 0),
    crime: make(c => -(c.crimeRate || 0)),   // меньше — лучше
    inequality: make(c => -(c.inequality || 0)),   // меньше — лучше
    happiness: make(c => c.happiness || 0),

    // Политика
    approval: make(c => c.approval || 0),
    stability: make(c => c.stability || 0),
    democracy: make(c => computeDemocracy(c)),
    corruption: make(c => -(c.corruption || 0)),   // меньше — лучше
    pressFreedom: make(c => c.pressFreedom || 0),
    judicialIndependence: make(c => c.judicialIndependence || 0),
    humanRights: make(c => c.humanRights || 0),

    // Военная мощь
    military: make(c => c.military?.personnel || 0),
    militaryBudget: make(c => (c.spending?.military || 0) * (c.gdp || 0)),
    militaryPower: make(c => milPowerCache.get(c.id) || 0),

    // Международные
    influence: make(c => c.influence || 0),
    reputation: make(c => c.reputation || 0),
    hdi: make(c => computeHDI(c)),
  };
}

export function computeHDI(c) {
  const life = Math.min(c.lifeExpectancy || 0, 85) / 85;
  const edu = Math.min(c.educationLevel || 0, 100) / 100;
  const income = Math.log10(Math.max(c.gdpPerCapita || 100, 100)) / Math.log10(40000);
  return Math.round(((life + edu + Math.min(income, 1)) / 3) * 100) / 100;
}

export function computeDemocracy(c) {
  return Math.round(
    (c.pressFreedom || 0) * 0.25 +
    (c.judicialIndependence || 0) * 0.25 +
    (c.humanRights || 0) * 0.25 +
    (100 - (c.corruption || 0)) * 0.15 +
    (100 - (c.discontent || 0)) * 0.10
  );
}

export function computeEconomicFreedom(c) {
  const t = c.taxes || {};
  return Math.round(
    (1 - (t.income || 0)) * 30 +
    (1 - (t.corporate || 0)) * 25 +
    (1 - (c.corruption || 0) / 100) * 25 +
    (1 - (c.shadowEconomy || 0)) * 20
  );
}

// Военная мощь — комплексная (0–100), откалибровано под 1936
export function computeMilitaryPower(c) {
  const m = c.military || {};
  const personnel = m.personnel || 0;
  const readiness = m.readiness || 0;
  const industry = m.industry || 0;
  const budget = (c.spending?.military || 0) * (c.gdp || 0);
  const tech = c.technology || 0;

  // Нормализуем: personnel от 0 до ~5 млн → 0..40
  const personnelScore = Math.min(40, personnel / 125000);
  // Бюджет 0..2 млрд → 0..20 (калибровка 1936, а не 0..200)
  const budgetScore = Math.min(20, budget / 0.1);
  // Готовность 0..100 → 0..15
  const readinessScore = readiness * 0.15;
  // Промышленность 0..100 → 0..15
  const industryScore = industry * 0.15;
  // Технологии 0..100 → 0..10
  const techScore = tech * 0.10;

  return Math.round(personnelScore + budgetScore + readinessScore + industryScore + techScore);
}

export function recordHistory(game) {
  const c = game.getPlayer();
  if (!c) return;
  c.history = c.history || [];
  const last = c.history[c.history.length - 1];
  const isNewYear = !last || last.year !== game.date.year;
  if (!isNewYear) return;

  const world = game.world;
  const popRank = [...world.countries].sort((a, b) => b.population - a.population).findIndex(x => x.id === c.id) + 1;
  const gdpRank = [...world.countries].sort((a, b) => b.gdp - a.gdp).findIndex(x => x.id === c.id) + 1;

  // Кэш военной мощи — один вызов на страну вместо O(n log n)
  const milPowers = new Map(world.countries.map(x => [x.id, computeMilitaryPower(x)]));
  const milRank = [...world.countries]
    .sort((a, b) => milPowers.get(b.id) - milPowers.get(a.id))
    .findIndex(x => x.id === c.id) + 1;

  c.history.push({
    year: game.date.year,
    gdp: c.gdp || 0,
    gdpPerCapita: c.gdpPerCapita || 0,
    population: c.population || 0,
    area: c.area || 0,
    density: c.area > 0 ? c.population / c.area : 0,
    approval: c.approval || 0,
    stability: c.stability || 0,
    influence: c.influence || 0,
    hdi: computeHDI(c),
    militaryPower: computeMilitaryPower(c),
    unemployment: c.unemployment || 0,
    inflation: c.inflation || 0,
    poverty: c.poverty || 0,
    lifeExpectancy: c.lifeExpectancy || 0,
    democracy: computeDemocracy(c),
    corruption: c.corruption || 0,
    popRank,
    gdpRank,
    milRank,
  });
  if (c.history.length > 60) c.history.shift();
}
// ============================================================
// СИНХРОНИЗАЦИЯ: ФИЛЬТРАЦИЯ WORLD ДЛЯ ИГРОКА (v3.0, D+C)
// ============================================================

export function filterWorldForPlayer(engine, playerId) {
  const player = engine.getCountry(playerId);
  // FIX: fallback на полный мир, если playerId битый
  if (!player) {
    return {
      countries: engine.world.countries || [],
      organizations: engine.world.organizations || [],
    };
  }

  const countries = engine.world.countries.map(c => {
    if (c.id === playerId) {
      // Своя страна — полностью
      return c;
    }
    // Чужая — фильтруем
    return {
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      capital: c.capital,
      flag: c.flag,
      area: c.area,
      population: c.population,
      government: c.government,
      system: c.system,
      ideology: c.ideology,
      isPlayer: c.isPlayer,
      gdp: c.gdp,
      gdpPerCapita: c.gdpPerCapita,
      military: c.military,
      influence: c.influence,
      reputation: c.reputation,
      approval: c.approval,
      stability: c.stability,
      // relations — только отношения к игроку
      relations: { [playerId]: c.relations?.[playerId] ?? 0 },
      // публичные
      parties: (c.parties || []).map(p => ({
        id: p.id, name: p.name, ideology: p.ideology, color: p.color,
        spectrum: p.spectrum, spectrumColor: p.spectrumColor, spectrumShort: p.spectrumShort,
        seats: p.seats, support: p.support, symbol: p.symbol,
        leader: p.leader ? { id: p.leader.id, name: p.leader.name, ideology: p.leader.ideology } : null,
        // deputies — НЕ отправляем
      })),
      laws: c.laws,
      // cabinet — НЕ отправляем
      // espionage — НЕ отправляем
      treaties: c.treaties,
      wars: c.wars,
      alliances: c.alliances,
      sanctions: c.sanctions,
      bases: c.bases,
      recognized: c.recognized,
      // прочее — не отправляем (экономика, общество, политика)
    };
  });

  return {
    countries,
    organizations: engine.world.organizations || [],
  };
}
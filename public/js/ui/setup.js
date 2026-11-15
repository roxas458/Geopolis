import { qs, qsa, el, mount, toast } from '../core/dom.js';
import { flagStyle } from '../core/util.js';
import { random } from '../core/rng.js';
import { COUNTRY_PRESETS } from '../game/names.js';
import { GOVERNMENTS, SYSTEMS, IDEOLOGIES, createCountry, createPresetCountry } from '../game/state.js';
import { getHeadOfState, POSITIONS } from '../game/politics.js';

let selectedPresetId = null;
let setupInitialized = false;

function safeValue(id, fallback = '') {
  const node = qs(id);
  return node ? node.value : fallback;
}

function safeNum(id, fallback = 0, min = 0) {
  const v = Number(safeValue(id, ''));
  return Number.isFinite(v) && v >= min ? v : fallback;
}

function ideoName(id) {
  const m = {
    liberal: 'Либеральная', conservative: 'Консервативная',
    social_democrat: 'Социал-демократическая', socialist: 'Социалистическая',
    communist: 'Коммунистическая', nationalist: 'Националистическая',
    centrist: 'Центристская', monarchist: 'Монархическая',
    agrarian: 'Аграрная', libertarian: 'Либертарианская',
  };
  return m[id] || id;
}

function isOneParty(country) {
  return country.system === 'one_party' || country.system === 'authoritarian';
}

// FIX: безопасное получение главы государства — не падает, если head = null
function safeHead(country) {
  return getHeadOfState(country) || { position: null, person: null };
}

// ============================================================
// СБОР ПЕРСОНАЖЕЙ (вариант C)
// ============================================================
function collectCharacters(country) {
  const chars = [];
  const seen = new Set();
  const add = (person, roleLabel, partyId) => {
    if (!person?.id || seen.has(person.id)) return;
    seen.add(person.id);
    chars.push({ person, roleLabel, partyId: partyId || null });
  };
  add(country.president, 'Президент', country.president?.partyId);
  add(country.primeMinister, 'Премьер-министр', country.primeMinister?.partyId);
  add(country.monarch, 'Монарх', null);
  add(country.speaker, 'Спикер парламента', country.speaker?.partyId);
  for (const p of country.parties || []) {
    if (p.leader) add(p.leader, `Лидер «${p.name}»`, p.id);
  }
  return chars;
}

function applyCharacterChoice(country, char) {
  country.playerPersonId = char.person.id;
  country.playerPartyId = char.partyId || null;
  // FIX: guard от null head
  const head = safeHead(country);
  if (head.person?.id === char.person.id) {
    country.playerRole = head.position;
    country.playerInPower = true;
  } else {
    country.playerRole = null;
    country.playerInPower = false;
  }
}

// ============================================================
// МОДАЛКА ВЫБОРА РЕЖИМА (A / B / C)
// ============================================================
function openStartModeModal(country, onConfirm) {
  const modal = document.getElementById('event-modal');
  if (!modal) {
    // fallback: играем за государство
    country.playerPartyId = null;
    country.playerPersonId = null;
    country.playerRole = null;
    country.playerInPower = true;
    onConfirm();
    return;
  }
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  // FIX: guard от null head
  const head = safeHead(country);
  const characters = collectCharacters(country);

  const finish = () => {
    selectedPresetId = null;
    close();
    onConfirm();
  };

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', {}, '🎮 Как вы хотите играть?'),
      el('p', { class: 'muted small' }, `${country.name} · ${country.parties?.length || 0} партий · ${characters.length} персонажей`),

      el('div', { class: 'modal-choices' },
        // A — государство
        el('button', { class: 'choice-btn', onclick: () => {
          country.playerPartyId = null;
          country.playerPersonId = null;
          country.playerRole = null;
          country.playerInPower = true;
          finish();
        } },
          el('div', { style: { fontWeight: '700' } }, '🌍 Играть за государство'),
          el('small', {}, 'Классический режим. Вы — страна, а не человек.')
        ),

        // B — партия (если не one_party и есть >1 партии)
        !isOneParty(country) && (country.parties?.length > 1) ? el('button', { class: 'choice-btn', onclick: () => {
          close();
          openPartySelectModal(country, finish);
        } },
          el('div', { style: { fontWeight: '700' } }, '🎮 Играть за партию'),
          el('small', {}, `Вы — партия. Проигрыш выборов → оппозиция.`)
        ) : null,

        // C — персонаж (если есть персонажи)
        characters.length > 0 ? el('button', { class: 'choice-btn', onclick: () => {
          close();
          openCharacterSelectModal(country, characters, finish);
        } },
          el('div', { style: { fontWeight: '700' } }, '👤 Играть за персонажа'),
          el('small', {}, `Вы — ${POSITIONS[head.position]?.name || 'глава'}, министр или лидер партии.`)
        ) : null
      ),

      el('div', { class: 'mt-16' },
        el('button', { class: 'btn small', onclick: () => { selectedPresetId = null; close(); } }, '← Назад')
      )
    )
  );
}

// ============================================================
// ВЫБОР ПАРТИИ (вариант B)
// ============================================================
function openPartySelectModal(country, onConfirm) {
  const modal = document.getElementById('event-modal');

  // Однопартийная / авторитарная — выбор не нужен
  if (isOneParty(country) || !country.parties || country.parties.length <= 1) {
    country.playerPartyId = country.parties?.[0]?.id || country.rulingPartyId || null;
    country.playerPersonId = null;
    country.playerRole = null;
    country.playerInPower = true;
    if (modal) { modal.classList.add('hidden'); mount(modal, ''); }
    onConfirm();
    return;
  }

  if (!modal) {
    country.playerPartyId = country.rulingPartyId || country.parties[0].id;
    country.playerPersonId = null;
    country.playerRole = null;
    country.playerInPower = true;
    onConfirm();
    return;
  }
  modal.classList.remove('hidden');

  const close = () => modal.classList.add('hidden');
  const sorted = [...(country.parties || [])].sort((a, b) => (b.seats || 0) - (a.seats || 0));

  const choose = (p) => {
    country.playerPartyId = p.id;
    country.playerPersonId = null;
    country.playerRole = null;
    // FIX: coalition может быть массивом id или объектов — поддерживаем оба
    const inCoalition = (country.coalition || []).some(x =>
      (typeof x === 'string' ? x : x?.partyId) === p.id
    );
    country.playerInPower = (p.id === country.rulingPartyId) || inCoalition;
    selectedPresetId = null;
    close();
    onConfirm();
  };

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', {}, '🎮 Выберите партию'),
      el('p', { class: 'muted small' },
        `Вы будете играть за выбранную партию. ${country.parties.length} партий в парламенте.`),
      el('div', { class: 'modal-choices', style: { maxHeight: '60vh', overflowY: 'auto' } },
        ...sorted.map(p => el('button', { class: 'choice-btn', onclick: () => choose(p) },
          el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' } },
            el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
              el('span', { style: { fontSize: '18px' } }, p.symbol || '⚖️'),
              el('div', {},
                el('div', { style: { fontWeight: '700' } }, p.name),
                el('div', { class: 'muted small' }, `${ideoName(p.ideology)} · ${p.seats} мест · ${Math.round(p.support || 0)}%`)
              )
            ),
            (p.id === country.rulingPartyId)
              ? el('span', { class: 'badge good' }, 'правящая')
              : el('span', { class: 'badge info' }, 'оппозиция')
          )
        ))
      ),
      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small primary', onclick: () => {
          country.playerPartyId = country.rulingPartyId || country.parties[0].id;
          country.playerPersonId = null;
          country.playerRole = null;
          country.playerInPower = true;
          selectedPresetId = null;
          close();
          onConfirm();
        } }, '▶ Играть за правящую'),
        el('button', { class: 'btn small', onclick: () => {
          selectedPresetId = null;
          close();
        } }, '← Назад')
      )
    )
  );
}

// ============================================================
// ВЫБОР ПЕРСОНАЖА (вариант C)
// ============================================================
function openCharacterSelectModal(country, characters, onConfirm) {
  const modal = document.getElementById('event-modal');
  if (!modal) { onConfirm(); return; }
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');

  // FIX: guard от null head
  const head = safeHead(country);

  const choose = (char) => {
    applyCharacterChoice(country, char);
    close();
    onConfirm();
  };

  mount(modal,
    el('div', { class: 'modal-card', style: { maxHeight: '90vh', overflowY: 'auto' } },
      el('h2', {}, '👤 Выберите персонажа'),
      el('p', { class: 'muted small' }, `Вы будете играть за выбранного человека. ${characters.length} доступно.`),
      el('div', { class: 'modal-choices', style: { maxHeight: '60vh', overflowY: 'auto' } },
        ...characters.map(ch => {
          const isHead = head.person?.id === ch.person.id;
          return el('button', { class: 'choice-btn', onclick: () => choose(ch) },
            el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' } },
              el('div', {},
                el('div', { style: { fontWeight: '700' } }, ch.person.name),
                el('div', { class: 'muted small' },
                  `${ch.roleLabel} · ${ideoName(ch.person.ideology)} · ${ch.person.age} лет`)
              ),
              isHead ? el('span', { class: 'badge good' }, '👑 глава') : null
            )
          );
        })
      ),
      el('div', { class: 'mt-16 flex gap-8 wrap' },
        el('button', { class: 'btn small', onclick: () => {
          close();
          openStartModeModal(country, onConfirm);
        } }, '← Назад')
      )
    )
  );
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
export function initSetup() {
  if (setupInitialized) return;

  // ==== SELECT'ы ====
  const gov = qs('#f-gov');
  const sys = qs('#f-sys');
  const ideo = qs('#f-ideo');

  if (gov && gov.options.length <= 1) {
    GOVERNMENTS.forEach(g => gov.appendChild(el('option', { value: g.id }, g.name)));
    gov.value = 'republic';
  }
  if (sys && sys.options.length <= 1) {
    SYSTEMS.forEach(s => sys.appendChild(el('option', { value: s.id }, s.name)));
    sys.value = 'presidential';
  }
  if (ideo && ideo.options.length <= 1) {
    IDEOLOGIES.forEach(i => ideo.appendChild(el('option', { value: i.id }, i.name)));
    ideo.value = 'centrist';
  }

  // ==== TABS ====
  qsa('.stab').forEach(t => t.addEventListener('click', () => {
    qsa('.stab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    qsa('.setup-panel').forEach(p => p.classList.remove('active'));
    const target = qs(t.dataset.mode === 'custom' ? '#setup-custom' : '#setup-preset');
    if (target) target.classList.add('active');
  }));

  // ==== FLAG PREVIEW ====
  const updateFlag = () => {
    const preview = qs('#flag-preview');
    if (!preview) return;
    const colors = [safeValue('#f-c1', '#1e3a8a'), safeValue('#f-c2', '#ffffff'), safeValue('#f-c3', '#b91c1c')];
    const pattern = safeValue('#f-pattern', 'horizontal');
    try {
      preview.style.background = flagStyle({ colors, pattern });
    } catch (err) {
      console.warn('[Geopolis] Ошибка флага', err);
    }
  };
  ['#f-c1', '#f-c2', '#f-c3', '#f-pattern'].forEach(s => {
    const input = qs(s);
    if (input) input.addEventListener('input', updateFlag);
  });
  updateFlag();

  // ==== PRESET LIST ====
  const list = qs('#preset-list');
  if (list) {
    list.innerHTML = '';
    COUNTRY_PRESETS.forEach(p => {
      const card = el('div', {
        class: 'preset-card', dataset: { id: p.id },
        onclick: () => {
          qsa('.preset-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedPresetId = p.id;
        }
      },
        el('div', { class: 'flag-box', style: { background: flagStyle(p.flag) } }),
        el('div', {},
          el('div', { class: 'pc-name' }, p.name),
          el('div', { class: 'pc-sub' }, `${p.short} · ${(p.population / 1e6).toFixed(0)} млн · ${p.capital}`)
        )
      );
      list.appendChild(card);
    });
  }

  // ==== RANDOM ====
  const btnRandom = qs('#btn-random');
  if (btnRandom) btnRandom.addEventListener('click', () => {
    const govIds = GOVERNMENTS.map(g => g.id);
    const sysIds = SYSTEMS.map(s => s.id);
    const ideoIds = IDEOLOGIES.map(i => i.id);
    const pickA = a => a[Math.floor(random() * a.length)];
    const setVal = (id, v) => { const n = qs(id); if (n) n.value = v; };

    const fullName = pickA(['Республика','Королевство','Федерация','Империя','Союз']) + ' ' +
      pickA(['Аврора','Валенция','Нордхейм','Люминия','Терра','Стелла','Каскадия','Вердана','Аквилия']);
    setVal('#f-name', fullName);
    setVal('#f-short', fullName.split(' ').slice(1).join(' ') || fullName);
    setVal('#f-capital', pickA(['Новоград','Сент-Клер','Люминис','Авалон','Драконья Крепость','Солнечный Город','Нордфорт']));
    setVal('#f-area', Math.round(50000 + random() * 5000000));
    setVal('#f-pop', Math.round(1000000 + random() * 150000000));
    setVal('#f-gdp', Math.round(50 + random() * 850));
    setVal('#f-gov', pickA(govIds));
    setVal('#f-sys', pickA(sysIds));
    setVal('#f-ideo', pickA(ideoIds));

    const randColor = () => '#' + Math.floor(random() * 16777215).toString(16).padStart(6, '0');
    setVal('#f-c1', randColor());
    setVal('#f-c2', randColor());
    setVal('#f-c3', randColor());
    updateFlag();
  });

  // ==== START CUSTOM ====
  const btnStart = qs('#btn-start');
  if (btnStart) btnStart.addEventListener('click', () => {
    if (typeof window.__startGame !== 'function') {
      toast('Ошибка: игра не инициализирована', 'error');
      return;
    }
    const name = (safeValue('#f-name') || '').trim() || 'Новое государство';
    const shortName = (safeValue('#f-short') || '').trim() || name;
    const capital = (safeValue('#f-capital') || '').trim() || 'Столица';
    const diff = safeValue('#f-diff', 'normal');
    const dev = diff === 'easy' ? 0.7 : diff === 'hard' ? 0.25 : 0.5;

    const country = createCountry({
      id: 'player',
      name, shortName, capital,
      area: Math.max(1000, safeNum('#f-area', 500000, 1000)),
      population: Math.max(100000, safeNum('#f-pop', 20000000, 100000)),
      gdpPerCapita: safeNum('#f-gdp', 600, 50),
      government: safeValue('#f-gov', 'republic'),
      system: safeValue('#f-sys', 'presidential'),
      ideology: safeValue('#f-ideo', 'centrist'),
      flag: {
        colors: [safeValue('#f-c1', '#1e3a8a'), safeValue('#f-c2', '#ffffff'), safeValue('#f-c3', '#b91c1c')],
        pattern: safeValue('#f-pattern', 'horizontal'),
      },
      dev,
    });
    country.isPlayer = true;

    openStartModeModal(country, () => {
      selectedPresetId = null;
      try { window.__startGame(country); }
      catch (err) {
        console.error('[Geopolis] Ошибка запуска игры', err);
        toast('Не удалось запустить игру: ' + err.message, 'error');
      }
    });
  });

  // ==== START PRESET ====
  const btnStartPreset = qs('#btn-start-preset');
  if (btnStartPreset) btnStartPreset.addEventListener('click', () => {
    if (!selectedPresetId) {
      toast('Выберите государство из списка', 'warn');
      return;
    }
    const preset = COUNTRY_PRESETS.find(p => p.id === selectedPresetId);
    if (!preset) {
      toast('Государство не найдено', 'error');
      return;
    }
    const country = createPresetCountry(preset, true);
    if (typeof window.__startGame !== 'function') {
      toast('Ошибка: игра не инициализирована', 'error');
      return;
    }

    openStartModeModal(country, () => {
      selectedPresetId = null;
      try { window.__startGame(country); }
      catch (err) {
        console.error('[Geopolis] Ошибка запуска игры', err);
        toast('Не удалось запустить игру: ' + err.message, 'error');
      }
    });
  });

  setupInitialized = true;
}
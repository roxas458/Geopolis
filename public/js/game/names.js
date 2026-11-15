// Вымышленные, но узнаваемые государства и люди
export const COUNTRY_PRESETS = [
  // ===== БАЗОВЫЕ 18 СТРАН =====
  // gdpPerCapita = номинал 1936 (в $)
  { id:'ardenia',  name:'Федеративная Республика Ардения', short:'Ардения',  capital:'Нью-Колумбия', flag:{colors:['#1e3a8a','#ffffff','#b91c1c'],pattern:'horizontal'}, area:9833000, population:128000000, government:'federal_republic', system:'presidential', ideology:'liberal', gdpPerCapita:600 },
  { id:'albion',   name:'Соединённое Королевство Альбион', short:'Альбион',  capital:'Темзборо',     flag:{colors:['#b91c1c','#ffffff','#1e3a8a'],pattern:'cross'},       area:244000,  population:47000000,  government:'constitutional_monarchy', system:'parliamentary', ideology:'conservative', gdpPerCapita:650 },
  { id:'gallia',   name:'Республика Галлия',               short:'Галлия',   capital:'Лютеция',      flag:{colors:['#1e3a8a','#ffffff','#b91c1c'],pattern:'vertical'},    area:551000,  population:42000000,  government:'republic', system:'semi_presidential', ideology:'centrist', gdpPerCapita:550 },
  { id:'teutonia', name:'Республика Тевтония',             short:'Тевтония', capital:'Беренталь',    flag:{colors:['#111111','#d4181f','#f2c230'],pattern:'horizontal'},  area:470000,  population:67000000,  government:'republic', system:'parliamentary', ideology:'nationalist', gdpPerCapita:480 },
  { id:'vespania', name:'Республика Веспания',             short:'Веспания', capital:'Мадригаль',    flag:{colors:['#b91c1c','#f2c230','#b91c1c'],pattern:'horizontal'},  area:505000,  population:25000000,  government:'republic', system:'parliamentary', ideology:'conservative', gdpPerCapita:330 },
  { id:'romania',  name:'Королевство Романия',             short:'Романия',  capital:'Аврелия',      flag:{colors:['#1f8a4c','#ffffff','#b91c1c'],pattern:'vertical'},    area:310000,  population:42000000,  government:'constitutional_monarchy', system:'parliamentary', ideology:'nationalist', gdpPerCapita:280 },
  { id:'rusinia',  name:'Социалистическая Республика Русиния', short:'Русиния', capital:'Новоград',  flag:{colors:['#c0141c','#c0141c','#f2c230'],pattern:'gradient'},    area:21000000,population:168000000, government:'socialist_republic', system:'one_party', ideology:'communist', gdpPerCapita:200 },
  { id:'xin',      name:'Республика Синь',                 short:'Синь',     capital:'Ханьцзин',     flag:{colors:['#c0141c','#f2c230','#c0141c'],pattern:'canton'},      area:9600000, population:500000000, government:'republic', system:'authoritarian', ideology:'nationalist', gdpPerCapita:60 },
  { id:'yamato',   name:'Империя Ямато',                   short:'Ямато',    capital:'Сакура',       flag:{colors:['#ffffff','#c0141c','#ffffff'],pattern:'canton'},      area:378000,  population:70000000,  government:'constitutional_monarchy', system:'parliamentary', ideology:'nationalist', gdpPerCapita:350 },
  { id:'osmania',  name:'Республика Османия',              short:'Османия',  capital:'Анкария',      flag:{colors:['#c0141c','#ffffff','#c0141c'],pattern:'horizontal'},  area:780000,  population:17000000,  government:'republic', system:'presidential', ideology:'nationalist', gdpPerCapita:120 },
  { id:'persida',  name:'Шахство Персида',                 short:'Персида',  capital:'Персеполь',    flag:{colors:['#1f8a4c','#ffffff','#c0141c'],pattern:'horizontal'},  area:1648000, population:15000000,  government:'absolute_monarchy', system:'authoritarian', ideology:'monarchist', gdpPerCapita:100 },
  { id:'bharat',   name:'Федерация Бхарат',                short:'Бхарат',   capital:'Раджапур',     flag:{colors:['#f08a24','#ffffff','#1f8a4c'],pattern:'horizontal'},  area:3287000, population:380000000, government:'federal_republic', system:'parliamentary', ideology:'centrist', gdpPerCapita:50 },
  { id:'borealia', name:'Доминион Бореалия',               short:'Бореалия', capital:'Норд-Бей',     flag:{colors:['#b91c1c','#ffffff','#b91c1c'],pattern:'canton'},      area:9985000, population:11000000,  government:'dominion', system:'parliamentary', ideology:'liberal', gdpPerCapita:550 },
  { id:'australia',name:'Доминион Аустралия',              short:'Аустралия',capital:'Порт-Юг',      flag:{colors:['#1e3a8a','#ffffff','#b91c1c'],pattern:'canton'},      area:7692000, population:7000000,   government:'dominion', system:'parliamentary', ideology:'liberal', gdpPerCapita:700 },
  { id:'platina',  name:'Республика Платина',              short:'Платина',  capital:'Ла-Плата',     flag:{colors:['#7cb6e6','#ffffff','#7cb6e6'],pattern:'horizontal'}, area:2780000, population:13000000,  government:'republic', system:'presidential', ideology:'conservative', gdpPerCapita:420 },
  { id:'kemetia',  name:'Королевство Кеметия',             short:'Кеметия',  capital:'Мемфис',       flag:{colors:['#1f8a4c','#ffffff','#c0141c'],pattern:'horizontal'},  area:1002000, population:16000000,  government:'constitutional_monarchy', system:'parliamentary', ideology:'monarchist', gdpPerCapita:100 },
  { id:'zarinia',  name:'Республика Зариния',              short:'Зариния',  capital:'Зари',         flag:{colors:['#1f8a4c','#ffffff','#1f8a4c'],pattern:'vertical'},    area:923000,  population:20000000,  government:'republic', system:'presidential', ideology:'nationalist', gdpPerCapita:70 },
  { id:'azania',   name:'Доминион Азания',                 short:'Азания',   capital:'Аврора',       flag:{colors:['#e07a1f','#ffffff','#1e3a8a'],pattern:'horizontal'},  area:1221000, population:9000000,   government:'dominion', system:'parliamentary', ideology:'conservative', gdpPerCapita:250 },

  // ===== ДОПОЛНИТЕЛЬНЫЕ 12 СТРАН (v1.1) =====
  { id:'nordia',   name:'Королевство Нордия',              short:'Нордия',   capital:'Хельгфорд',    flag:{colors:['#1e3a8a','#ffffff','#1e3a8a'],pattern:'cross'},       area:449000,  population:3100000,   government:'constitutional_monarchy', system:'parliamentary', ideology:'social_democrat', gdpPerCapita:650 },
  { id:'helvetia', name:'Конфедерация Гельвеция',          short:'Гельвеция',capital:'Бернбург',     flag:{colors:['#c0141c','#ffffff','#c0141c'],pattern:'cross'},       area:41000,   population:4200000,   government:'federal_republic', system:'semi_presidential', ideology:'centrist', gdpPerCapita:700 },
  { id:'baltia',   name:'Республика Балтия',               short:'Балтия',   capital:'Ригас',        flag:{colors:['#8a1a3a','#ffffff','#8a1a3a'],pattern:'horizontal'},  area:65000,   population:1900000,   government:'republic', system:'parliamentary', ideology:'liberal', gdpPerCapita:300 },
  { id:'polonia',  name:'Республика Полония',              short:'Полония',  capital:'Варшавия',     flag:{colors:['#ffffff','#c0141c','#c0141c'],pattern:'horizontal'},  area:389000,  population:34000000,  government:'republic', system:'semi_presidential', ideology:'conservative', gdpPerCapita:220 },
  { id:'magyaria', name:'Королевство Магьярия',            short:'Магьярия', capital:'Будапешт',     flag:{colors:['#c0141c','#ffffff','#1f8a4c'],pattern:'horizontal'},  area:93000,   population:9000000,   government:'constitutional_monarchy', system:'parliamentary', ideology:'nationalist', gdpPerCapita:250 },
  { id:'bulgaria', name:'Царство Булгария',                short:'Булгария', capital:'София',        flag:{colors:['#ffffff','#1f8a4c','#c0141c'],pattern:'horizontal'},  area:111000,  population:6200000,   government:'absolute_monarchy', system:'authoritarian', ideology:'monarchist', gdpPerCapita:150 },
  { id:'hellada',  name:'Республика Эллада',               short:'Эллада',   capital:'Афиния',       flag:{colors:['#1e3a8a','#ffffff','#1e3a8a'],pattern:'bands'},       area:132000,  population:7000000,   government:'republic', system:'parliamentary', ideology:'liberal', gdpPerCapita:280 },
  { id:'iberia',   name:'Республика Иберия',               short:'Иберия',   capital:'Лиссабон',     flag:{colors:['#1f8a4c','#c0141c','#c0141c'],pattern:'vertical'},    area:92000,   population:7200000,   government:'republic', system:'semi_presidential', ideology:'centrist', gdpPerCapita:200 },
  { id:'columbia', name:'Федерация Колумбия',              short:'Колумбия', capital:'Богота',       flag:{colors:['#f2c230','#1e3a8a','#c0141c'],pattern:'horizontal'},  area:1140000, population:12000000,  government:'federal_republic', system:'presidential', ideology:'liberal', gdpPerCapita:150 },
  { id:'peruvia',  name:'Республика Перувия',              short:'Перувия',  capital:'Лима',         flag:{colors:['#c0141c','#ffffff','#c0141c'],pattern:'vertical'},    area:1285000, population:6800000,   government:'republic', system:'presidential', ideology:'conservative', gdpPerCapita:130 },
  { id:'mexica',   name:'Соединённые Штаты Мексика',       short:'Мексика',  capital:'Мехико',       flag:{colors:['#1f8a4c','#ffffff','#c0141c'],pattern:'vertical'},    area:1972000, population:19000000,  government:'federal_republic', system:'presidential', ideology:'centrist', gdpPerCapita:160 },
  { id:'nipponia', name:'Империя Ниппония',                short:'Ниппония', capital:'Киото',        flag:{colors:['#ffffff','#c0141c','#ffffff'],pattern:'canton'},       area:377000,  population:71000000,  government:'constitutional_monarchy', system:'parliamentary', ideology:'nationalist', gdpPerCapita:350 },
];

export const FIRST_M = ['Александр','Виктор','Дмитрий','Карл','Эдвард','Генри','Луи','Мигель','Хуан','Пётр','Иван','Сергей','Томас','Джон','Роберт','Франц','Отто','Пабло','Антонио','Марк','Юлий','Харуки','Чен','Раджеш','Ахмед','Омар','Мустафа','Тарквиний','Никола','Габриэль','Лоренцо','Фердинанд'];
export const FIRST_F = ['Анна','Мария','Елена','Элеонора','Виктория','Изабелла','Клара','София','Луиза','Александра','Екатерина','Ольга','Ирина','Марта','Грета','Клаудия','Паула','Ханна','Юлия','Светлана','Татьяна','Аюми','Мэй','Прия','Фатима','Лейла','Аида','Роксана'];
export const LAST = ['Вальмонт','Дюваль','Риверс','Блэквуд','Стоун','Хартли','Маркес','Сантос','Ортега','Волков','Соколов','Морозов','Ковач','Шмидт','Бергер','Росси','Феррара','Коломбо','Таннер','Уайт','Грин','Хан','Ли','Чжоу','Патель','Сингх','Рао','Ахмед','Хассан','аль-Рашид','Драган','Петрович','Новак','Ковальски','Мартинес','Эрнандес','Лопес','Браун','Кроу','Лонг'];

export const PARTY_NAMES = {
  liberal:        ['Партия Свободы','Либеральный Союз','Прогрессивная партия','Радикальная партия'],
  conservative:   ['Консервативная партия','Национальный Союз','Партия Порядка','Союз Традиций'],
  social_democrat:['Социал-демократическая партия','Партия Справедливости','Трудовой Союз'],
  socialist:      ['Социалистическая партия','Рабочий Фронт','Партия Труда'],
  communist:      ['Коммунистическая партия','Партия Рабочих','Красный Союз'],
  nationalist:    ['Национальный Фронт','Партия Родины','Народный Союз','Патриотический Блок'],
  centrist:       ['Центристская партия','Гражданский Союз','Партия Реформ'],
  monarchist:     ['Партия Трона','Монархический Союз','Союз Короны'],
  agrarian:       ['Аграрная партия','Крестьянский Союз','Народная Партия'],
  libertarian:    ['Либертарианский Союз','Партия Свободного Рынка'],
};

export const PARTY_NAMES_EXTRA = {
  liberal:        ['Партия Свободной Инициативы','Союз Граждан','Либеральный Фронт'],
  conservative:   ['Партия Стабильности','Союз Порядка и Традиций','Национальное Единство'],
  social_democrat:['Партия Социальной Справедливости','Рабочий Союз','Социал-Демократический Фронт'],
  socialist:      ['Партия Трудящихся','Народный Фронт','Социалистический Союз'],
  communist:      ['Коммунистический Авангард','Партия Пролетариата','Красная Партия'],
  nationalist:    ['Партия Национального Возрождения','Патриотический Союз','Союз Отечества'],
  centrist:       ['Партия Центра','Гражданская Коалиция','Союз Реформ'],
  monarchist:     ['Партия Короны','Монархический Фронт','Союз Трона'],
  agrarian:       ['Партия Земли','Союз Крестьян','Аграрный Фронт'],
  libertarian:    ['Партия Свободы','Либертарианский Фронт'],
};

export const PARTY_COLORS = {
  liberal:'#4a7dff', conservative:'#2f6bd8', social_democrat:'#e0559a',
  socialist:'#e04b3a', communist:'#b0141c', nationalist:'#8a6a1f',
  centrist:'#7a8fb5', monarchist:'#a06bd8', agrarian:'#3ea868', libertarian:'#e6b84c',
};

export const ETHNICITIES = ['авронцы','веспы','галлийцы','тевтоны','русины','синьцы','яматийцы','османы','персы','бхаратцы','платинцы','кеметы','зарины','азанцы'];
export const RELIGIONS = ['авронская церковь','солнечный культ','восточное христианство','западное христианство','ислам','индуизм','буддизм','иудаизм','анимизм'];

// v1.7: валюта — доллары
export const CURRENCIES = ['$', 'USD', 'долл.'];

// ============================================================
// ПОЛИТИЧЕСКИЙ СПЕКТР (v1.6)
// ============================================================
export const SPECTRUM_MAP = {
  communist:       { position: -9, label: 'Крайне левые',     short: 'КЛ', color: '#b0141c' },
  socialist:       { position: -6, label: 'Левые',            short: 'Л',  color: '#e04b3a' },
  social_democrat: { position: -3, label: 'Левоцентристы',    short: 'ЛЦ', color: '#e0559a' },
  centrist:        { position: 0,  label: 'Центристы',        short: 'Ц',  color: '#7a8fb5' },
  agrarian:        { position: -1, label: 'Аграрные',         short: 'А',  color: '#3ea868' },
  liberal:         { position: 2,  label: 'Правоцентристы',   short: 'ПЦ', color: '#4a7dff' },
  libertarian:     { position: 3,  label: 'Либертарианцы',    short: 'ЛБ', color: '#e6b84c' },
  conservative:    { position: 5,  label: 'Правые',           short: 'П',  color: '#2f6bd8' },
  nationalist:     { position: 8,  label: 'Крайне правые',    short: 'КП', color: '#8a6a1f' },
  monarchist:      { position: 9,  label: 'Ультраправые',     short: 'УП', color: '#a06bd8' },
};

export function getSpectrum(ideology) {
  return SPECTRUM_MAP[ideology] || SPECTRUM_MAP.centrist;
}
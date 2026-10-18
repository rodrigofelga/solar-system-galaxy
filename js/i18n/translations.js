export const translations = {
  en: {
    title: "Solar System & Milky Way Explorer",
    solarSystem: "Solar System",
    milkyWay: "Milky Way",
    explorePlanets: "Explore Planets",
    galaxyOverview: "Galaxy Overview",
    play: "Play",
    pause: "Pause",
    reset: "Reset",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit Fullscreen",
    showLabels: "Show Labels",
    hideLabels: "Hide Labels",
    sun: "Sun",
    moon: "Moon",
    earth: "Earth",
    mercury: "Mercury",
    venus: "Venus",
    mars: "Mars",
    jupiter: "Jupiter",
    saturn: "Saturn",
    uranus: "Uranus",
    neptune: "Neptune"
  },

  "pt-BR": {
    title: "Explorador do Sistema Solar e da Via Láctea",
    solarSystem: "Sistema Solar",
    milkyWay: "Via Láctea",
    explorePlanets: "Explorar Planetas",
    galaxyOverview: "Visão Geral da Galáxia",
    play: "Reproduzir",
    pause: "Pausar",
    reset: "Reiniciar",
    fullscreen: "Tela Cheia",
    exitFullscreen: "Sair da Tela Cheia",
    showLabels: "Mostrar Rótulos",
    hideLabels: "Ocultar Rótulos",
    sun: "Sol",
    moon: "Lua",
    earth: "Terra",
    mercury: "Mercúrio",
    venus: "Vênus",
    mars: "Marte",
    jupiter: "Júpiter",
    saturn: "Saturno",
    uranus: "Urano",
    neptune: "Netuno"
  }
};

export const t = (language, key) =>
  translations[language]?.[key] ??
  translations.en[key] ??
  key;
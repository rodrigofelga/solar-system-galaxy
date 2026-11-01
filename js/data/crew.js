// Facts checked against the NASA and CSA biographies linked here; see ASSET_ATTRIBUTION.md.
export const CREW_TEXT = {
  en: {
    eyebrow: 'THE PEOPLE ABOARD ORION',
    title: 'Meet the Artemis II Crew',
    intro: 'Four astronauts launched on 1 April 2026 and splashed down on 10 April, after a nearly 10-day journey that took them 406,771 km (252,756 miles) from Earth.',
    groupLabel: 'Artemis II crew profiles',
    factsLabel: 'Did you know?',
    officialBio: 'Official biography',
    newTab: 'opens in a new tab',
    bioOf: (name, agency) => `${agency} biography of ${name}`,
    socialOf: (name, network) => `${name} on ${network}`,
    portraitOf: (name, role) => `Official portrait of ${name}, Artemis II ${role}, in a NASA spacesuit.`,
    credit: 'Portraits: NASA/Josh Valcarcel. Biographies are summarised from NASA and Canadian Space Agency sources. Social links are the accounts those agencies list for each astronaut. This independent educational project is not produced, sponsored, or endorsed by NASA or the Canadian Space Agency.',
  },
  'pt-BR': {
    eyebrow: 'AS PESSOAS A BORDO DA ORION',
    title: 'Conheça a Tripulação da Artemis II',
    intro: 'Quatro astronautas decolaram em 1º de abril de 2026 e pousaram no mar em 10 de abril, após uma jornada de quase 10 dias que os levou a 406.771 km (252.756 milhas) da Terra.',
    groupLabel: 'Perfis da tripulação da Artemis II',
    factsLabel: 'Você sabia?',
    officialBio: 'Biografia oficial',
    newTab: 'abre em uma nova aba',
    bioOf: (name, agency) => `Biografia de ${name} na ${agency}`,
    socialOf: (name, network) => `${name} no ${network}`,
    portraitOf: (name, role) => `Retrato oficial de ${name}, ${role} da Artemis II, com traje espacial da NASA.`,
    credit: 'Retratos: NASA/Josh Valcarcel. As biografias foram resumidas de fontes da NASA e da Agência Espacial Canadense. Os links de redes sociais são as contas que essas agências indicam para cada astronauta. Este projeto educacional independente não é produzido, patrocinado nem endossado pela NASA ou pela Agência Espacial Canadense.',
  },
};

export const CREW = [
  {
    name: 'Reid Wiseman',
    portrait: 'assets/crew/wiseman.jpg',
    agency: 'NASA',
    bioUrl: 'https://www.nasa.gov/people/reid-wiseman/',
    social: { Instagram: 'https://www.instagram.com/astro_reid/', X: 'https://x.com/astro_reid' },
    en: {
      role: 'Commander',
      agencyName: 'NASA',
      bio: 'A U.S. Navy aviator, test pilot, and engineer, Reid Wiseman spent 165 days aboard the International Space Station in 2014, working on hundreds of experiments and making two spacewalks. He later served as chief of NASA’s Astronaut Office. As Artemis II commander, he led the crew around the Moon.',
      facts: ['He has spent 175 days in space across his two missions.', 'He was at sea with an F/A-18F Super Hornet squadron when NASA selected him as an astronaut in 2009.'],
    },
    'pt-BR': {
      role: 'Comandante',
      agencyName: 'NASA',
      bio: 'Aviador da Marinha dos EUA, piloto de testes e engenheiro, Reid Wiseman passou 165 dias a bordo da Estação Espacial Internacional em 2014, trabalhando em centenas de experimentos e realizando duas caminhadas espaciais. Depois, foi chefe do Escritório de Astronautas da NASA. Como comandante da Artemis II, liderou a tripulação ao redor da Lua.',
      facts: ['Ele passou 175 dias no espaço em suas duas missões.', 'Ele estava no mar, em um esquadrão de caças F/A-18F Super Hornet, quando a NASA o selecionou como astronauta em 2009.'],
    },
  },
  {
    name: 'Victor Glover',
    portrait: 'assets/crew/glover.jpg',
    agency: 'NASA',
    bioUrl: 'https://www.nasa.gov/humans-in-space/astronauts/victor-j-glover/',
    social: { Instagram: 'https://www.instagram.com/astrovicglover/', X: 'https://x.com/AstroVicGlover' },
    en: {
      role: 'Pilot',
      agencyName: 'NASA',
      bio: 'A naval aviator, engineer, and test pilot, Victor Glover piloted NASA’s SpaceX Crew-1 mission and spent 168 days in space during his stay on the International Space Station, completing four spacewalks. On Artemis II, he served as pilot of the Orion spacecraft.',
      facts: ['Artemis II’s Orion spacecraft was named Integrity.', 'Before NASA, he logged more than 4,000 flight hours in over 40 aircraft.'],
    },
    'pt-BR': {
      role: 'Piloto',
      agencyName: 'NASA',
      bio: 'Aviador naval, engenheiro e piloto de testes, Victor Glover pilotou a missão SpaceX Crew-1 da NASA e passou 168 dias no espaço durante sua estadia na Estação Espacial Internacional, realizando quatro caminhadas espaciais. Na Artemis II, foi o piloto da espaçonave Orion.',
      facts: ['A espaçonave Orion da Artemis II recebeu o nome de Integrity.', 'Antes da NASA, ele acumulou mais de 4.000 horas de voo em mais de 40 aeronaves.'],
    },
  },
  {
    name: 'Christina Koch',
    portrait: 'assets/crew/koch.jpg',
    agency: 'NASA',
    bioUrl: 'https://www.nasa.gov/people/christina-koch/',
    social: { Instagram: 'https://www.instagram.com/astro_christina/', X: 'https://x.com/Astro_Christina' },
    en: {
      role: 'Mission Specialist',
      agencyName: 'NASA',
      bio: 'An electrical engineer who built instruments for NASA science missions, Christina Koch spent 328 consecutive days aboard the International Space Station and took part in the first all-woman spacewalks. On Artemis II, she flew as a mission specialist.',
      facts: ['She completed six spacewalks, totalling 42 hours and 15 minutes.', 'She spent a full winter at the Amundsen-Scott South Pole Station in Antarctica.'],
    },
    'pt-BR': {
      role: 'Especialista de Missão',
      agencyName: 'NASA',
      bio: 'Engenheira eletricista que construiu instrumentos para missões científicas da NASA, Christina Koch passou 328 dias consecutivos a bordo da Estação Espacial Internacional e participou das primeiras caminhadas espaciais só de mulheres. Na Artemis II, voou como especialista de missão.',
      facts: ['Ela realizou seis caminhadas espaciais, somando 42 horas e 15 minutos.', 'Ela passou um inverno inteiro na Estação Amundsen-Scott, no Polo Sul, na Antártida.'],
    },
  },
  {
    name: 'Jeremy Hansen',
    portrait: 'assets/crew/hansen.jpg',
    agency: 'CSA',
    bioUrl: 'https://www.asc-csa.gc.ca/eng/astronauts/canadian/active/bio-jeremy-hansen.asp',
    social: { Instagram: 'https://www.instagram.com/astrojeremy/', X: 'https://x.com/Astro_Jeremy' },
    en: {
      role: 'Mission Specialist',
      agencyName: 'Canadian Space Agency',
      bio: 'A Canadian astronaut and former CF-18 fighter pilot with a master’s degree in physics, Jeremy Hansen has worked at NASA Mission Control as capcom, the voice between the ground and the International Space Station. On Artemis II, he became the first Canadian to travel around the Moon.',
      facts: ['He is the first non-American to take part in a lunar mission.', 'He grew up on a farm near Ailsa Craig, Ontario.'],
    },
    'pt-BR': {
      role: 'Especialista de Missão',
      agencyName: 'Agência Espacial Canadense',
      bio: 'Astronauta canadense e ex-piloto de caça CF-18, com mestrado em física, Jeremy Hansen trabalhou no Controle da Missão da NASA como capcom, a voz entre a equipe em solo e a Estação Espacial Internacional. Na Artemis II, tornou-se o primeiro canadense a viajar ao redor da Lua.',
      facts: ['Ele é o primeiro não americano a participar de uma missão lunar.', 'Ele cresceu em uma fazenda perto de Ailsa Craig, em Ontário.'],
    },
  },
];

export const SOCIAL_ICONS = {
  Instagram: 'M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9-.1-1.3-.1-1.6-.1-4.8s0-3.6.1-4.8c.1-3.2 1.7-4.8 4.9-4.9 1.2-.1 1.6-.1 4.8-.1zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7C8.3 24 8.7 24 12 24s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.8a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z',
  X: 'M18.2 2.3h3.3l-7.2 8.2 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.3 2.3H8.1l4.7 6.2zm-1.2 17.5h1.8L7.1 4.1h-2z',
};

// Close-up controls and explanation for Sagittarius A*. Facts are from the sources linked below.
const NASA = 'https://science.nasa.gov/universe/black-holes/anatomy/';
const EHT = 'https://eventhorizontelescope.org/blog/astronomers-reveal-first-image-black-hole-heart-our-galaxy';
const JAMES = 'https://iopscience.iop.org/article/10.1088/0264-9381/32/6/065001';

export const BLACK_HOLE_TEXT = {
  en: {
    controlsLabel: 'Black hole animation and camera controls',
    pause: 'Pause light',
    play: 'Play light',
    resume: 'Resume simulation + light',
    speedLabel: 'Flow speed',
    viewLabel: 'View',
    viewCinematic: 'Near edge-on',
    viewThreeQuarter: 'Three-quarter',
    viewFace: 'Face-on',
    viewEdge: 'Edge-on',
    resetCamera: 'Reset camera',
    reducedMotion: 'Paused because your device asks for reduced motion. Press Play light to watch it move.',
    conceptsTitle: 'What you are seeing',
    number: (value) => String(value),
    concepts: [
      { label: 'Black hole shadow', text: 'The dark central region. It is larger than the event horizon, because light passing nearby is bent or captured: for a non-rotating black hole, its radius is about 2.6 times the horizon’s. The Event Horizon Telescope image shows a bright ring around a central dark region related to this shadow.', source: EHT, sourceLabel: 'EHT Collaboration' },
      { label: 'Event horizon', text: 'The boundary from which nothing can return. It gives off no light and cannot be seen directly; it lies inside the shadow. For Sagittarius A*, its radius is roughly 12 million km.', source: NASA, sourceLabel: 'NASA' },
      { label: 'Accretion disk', text: 'Hot gas spiralling inward. Sagittarius A* feeds weakly and is dim for its size, and its gas is thought to form a faint, puffed-up flow. The bright, thin disk drawn here is a conceptual illustration, not what it is observed to have.', source: NASA, sourceLabel: 'NASA' },
      { label: 'Gravitational lensing', text: 'Gravity bends light. The arcs above and below the shadow are the far side of the disk, seen by light that curved over and under the black hole. Here, each pixel’s ray is bent by solving the path of light around a non-rotating black hole; Sagittarius A*’s real spin is not modelled.', source: JAMES, sourceLabel: 'James et al., 2015' },
      { label: 'Doppler effects', text: 'Gas moving toward us looks brighter and hotter, and gas moving away looks dimmer and redder, which is why one side of the disk outshines the other. The effect is calculated from the gas’s orbital speed, then softened and recoloured for display.', source: NASA, sourceLabel: 'NASA' },
      { label: 'Illustrative or measured?', text: 'Measured: the mass of about four million Suns, the distance of about 26,000 light-years, and the ring’s size of about 52 microarcseconds. Illustrative: the disk’s thinness, brightness, colours, streams and speed, and the background sky. This is an original real-time model, not telescope footage or a measured gas flow.', source: EHT, sourceLabel: 'EHT Collaboration' },
    ],
  },
  'pt-BR': {
    controlsLabel: 'Controles de animação e de câmera do buraco negro',
    pause: 'Pausar luz',
    play: 'Reproduzir luz',
    resume: 'Retomar simulação + luz',
    speedLabel: 'Velocidade do fluxo',
    viewLabel: 'Vista',
    viewCinematic: 'Quase de perfil',
    viewThreeQuarter: 'Três quartos',
    viewFace: 'De frente para o disco',
    viewEdge: 'De perfil',
    resetCamera: 'Reiniciar câmera',
    reducedMotion: 'Pausado porque seu dispositivo pede menos movimento. Pressione Reproduzir luz para vê-la em movimento.',
    conceptsTitle: 'O que você está vendo',
    number: (value) => String(value).replace('.', ','),
    concepts: [
      { label: 'Sombra do buraco negro', text: 'A região central escura. Ela é maior que o horizonte de eventos, porque a luz que passa por perto é desviada ou capturada: em um buraco negro sem rotação, seu raio é cerca de 2,6 vezes o do horizonte. A imagem do Event Horizon Telescope mostra um anel brilhante ao redor de uma região central escura relacionada a essa sombra.', source: EHT, sourceLabel: 'Colaboração EHT' },
      { label: 'Horizonte de eventos', text: 'O limite do qual nada pode retornar. Ele não emite luz e não pode ser visto diretamente; fica dentro da sombra. Em Sagittarius A*, seu raio é de aproximadamente 12 milhões de km.', source: NASA, sourceLabel: 'NASA' },
      { label: 'Disco de acreção', text: 'Gás quente que espirala para dentro. Sagittarius A* se alimenta pouco e é fraco para o seu tamanho, e acredita-se que seu gás forme um fluxo tênue e inflado. O disco fino e brilhante desenhado aqui é uma ilustração conceitual, não o que se observa nele.', source: NASA, sourceLabel: 'NASA' },
      { label: 'Lente gravitacional', text: 'A gravidade desvia a luz. Os arcos acima e abaixo da sombra são o lado distante do disco, vistos pela luz que se curvou por cima e por baixo do buraco negro. Aqui, o raio de cada pixel é desviado resolvendo o caminho da luz ao redor de um buraco negro sem rotação; a rotação real de Sagittarius A* não é modelada.', source: JAMES, sourceLabel: 'James et al., 2015' },
      { label: 'Efeitos Doppler', text: 'O gás que se aproxima de nós parece mais brilhante e mais quente, e o que se afasta parece mais fraco e mais avermelhado, e por isso um lado do disco brilha mais que o outro. O efeito é calculado a partir da velocidade orbital do gás e depois suavizado e recolorido para exibição.', source: NASA, sourceLabel: 'NASA' },
      { label: 'Ilustrativo ou medido?', text: 'Medidos: a massa de cerca de quatro milhões de Sóis, a distância de cerca de 26.000 anos-luz e o tamanho do anel, de cerca de 52 microssegundos de arco. Ilustrativos: a pouca espessura do disco, seu brilho, cores, fluxos e velocidade, além do céu de fundo. Este é um modelo original em tempo real, não uma filmagem de telescópio nem um fluxo de gás medido.', source: EHT, sourceLabel: 'Colaboração EHT' },
    ],
  },
};

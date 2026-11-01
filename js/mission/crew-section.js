import { CREW, CREW_TEXT, SOCIAL_ICONS } from '../data/crew.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function externalLink(href, className, label) {
  const link = element('a', className);
  link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', label);
  return link;
}

function createCard(member, copy, text) {
  const card = element('article', 'crew-card');
  const portrait = element('img', 'crew-portrait');
  portrait.src = member.portrait; portrait.width = 480; portrait.height = 640; portrait.loading = 'lazy'; portrait.decoding = 'async';
  portrait.alt = text.portraitOf(member.name, copy.role);
  const identity = element('div', 'crew-identity');
  identity.append(element('h4', '', member.name), element('p', 'crew-role', copy.role), element('p', 'crew-agency', copy.agencyName));
  const facts = element('div', 'crew-facts');
  const list = element('ul');
  copy.facts.forEach((fact) => list.append(element('li', '', fact)));
  facts.append(element('p', 'crew-facts-label', text.factsLabel), list);
  const links = element('div', 'crew-links');
  const bio = externalLink(member.bioUrl, 'crew-bio-link', `${text.bioOf(member.name, copy.agencyName)} (${text.newTab})`);
  bio.textContent = text.officialBio;
  links.append(bio);
  for (const [network, href] of Object.entries(member.social)) {
    const link = externalLink(href, 'crew-social-link', `${text.socialOf(member.name, network)} (${text.newTab})`);
    const icon = document.createElementNS(SVG_NS, 'svg');
    icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(SVG_NS, 'path');
    shape.setAttribute('d', SOCIAL_ICONS[network]); icon.append(shape);
    link.append(icon); links.append(link);
  }
  card.append(portrait, identity, element('p', 'crew-bio', copy.bio), facts, links);
  return card;
}

export function renderCrewSection(language) {
  const section = document.querySelector('#crew-section');
  if (!section) return;
  const text = CREW_TEXT[language] ?? CREW_TEXT.en;
  section.querySelector('#crew-eyebrow').textContent = text.eyebrow;
  section.querySelector('#crew-title').textContent = text.title;
  section.querySelector('#crew-intro').textContent = text.intro;
  section.querySelector('#crew-credit').textContent = text.credit;
  const grid = section.querySelector('#crew-grid');
  grid.setAttribute('aria-label', text.groupLabel);
  grid.replaceChildren(...CREW.map((member) => createCard(member, member[language] ?? member.en, text)));
}

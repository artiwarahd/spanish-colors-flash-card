const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
  const classes = new Set();
  return {
    children: [], hidden: false,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name)
    },
    style: { setProperty() {} },
    append(child) { this.children.push(child); this.firstElementChild ??= child; },
    replaceChildren(...children) { this.children = children; this.firstElementChild = children[0]; },
    setAttribute(name, value) { this[name] = value; },
    addEventListener(name, handler) { this[name] = handler; },
    querySelector(selector) { return this[selector]; },
    querySelectorAll(selector) { return selector === '.card__number' ? this.numberLabels : []; },
    focus() { this.focused = true; },
    set innerHTML(html) {
      this.html = html;
      this['.card__wait'] = element();
      this['.card__name'] = element();
      this['.card__name'].hidden = true;
      this.numberLabels = [element(), element()];
    }
  };
}

const nodes = Object.fromEntries(['#cards', '#count', '#dots', '#reset'].map(id => [id, element()]));
nodes['#reset'].hidden = true;
const jobs = new Map();
let nextJob = 0;
const spoken = [];
let cancellations = 0;
const maleSpanishVoice = { lang: 'es-ES', name: 'Microsoft Alvaro' };
const femaleSpanishVoice = { lang: 'es-ES', name: 'Microsoft Helena' };
let availableVoices = [maleSpanishVoice, femaleSpanishVoice];
class Utterance { constructor(text) { this.text = text; } }
const speech = {
  getVoices: () => availableVoices,
  speak: utterance => spoken.push(utterance),
  cancel: () => cancellations++
};
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(script, {
  document: { querySelector: selector => nodes[selector], createElement: element },
  window: { speechSynthesis: speech, SpeechSynthesisUtterance: Utterance },
  SpeechSynthesisUtterance: Utterance,
  Math: { floor: Math.floor, random: () => 0.999999 },
  setTimeout(fn, delay) { assert.equal(delay, 3000); jobs.set(++nextJob, fn); return nextJob; },
  clearTimeout(id) { jobs.delete(id); }
});

const cards = [...nodes['#cards'].children];
assert.equal(cards.length, 10);
assert(!cards[0].html.includes('blanco'));
cards.forEach((card, index) => {
  assert.equal(card['aria-label'], `Card ${index + 1} of 10. Tap to reveal the color.`);
  assert(card.numberLabels.every(label => label.textContent === `${String(index + 1).padStart(2, '0')} / 10`));
});
const blanco = cards.find(card => card.html.includes('blanco'));
blanco.click();
assert.equal(nodes['#count'].textContent, 1);
assert.equal(blanco['.card__name'].hidden, true);
assert.equal(spoken.length, 0);
const firstJob = jobs.get(1);
jobs.delete(1);
firstJob();
assert.equal(blanco['.card__name'].hidden, false);
assert.match(blanco['aria-label'], /blanco/);
assert.equal(spoken[0].text, 'blanco');
assert.equal(spoken[0].lang, 'es-ES');
assert.equal(spoken[0].voice, femaleSpanishVoice);
availableVoices = [maleSpanishVoice];
cards.filter(card => card !== blanco).forEach(card => card.click());
const [fallbackJobId, fallbackJob] = jobs.entries().next().value;
jobs.delete(fallbackJobId);
fallbackJob();
assert.equal(spoken[1].voice, maleSpanishVoice);
assert.equal(spoken[1].pitch, 1.25);
assert.equal(nodes['#reset'].hidden, false);
nodes['#reset'].click();
assert.equal(nodes['#count'].textContent, '0');
assert.equal(nodes['#reset'].hidden, true);
assert.equal(jobs.size, 0);
assert.equal(cancellations, 1);
assert(cards.every(card => !card.classList.contains('is-flipped') && card['.card__name'].hidden));
assert(nodes['#cards'].children.some((card, index) => card !== cards[index]));
nodes['#cards'].children.forEach((card, index) => {
  assert.equal(card['aria-label'], `Card ${index + 1} of 10. Tap to reveal the color.`);
  assert(card.numberLabels.every(label => label.textContent === `${String(index + 1).padStart(2, '0')} / 10`));
});
cards[0].click();
assert.equal(nodes['#count'].textContent, 1);
assert(nodes['#dots'].children[0].classList.contains('on'));
const previousOrder = [...nodes['#cards'].children];
nodes['#cards'].children.forEach(card => card.click());
nodes['#reset'].click();
assert(nodes['#cards'].children.some((card, index) => card !== previousOrder[index]));
console.log('Flash card reveal, speech, first-round shuffle, reset, and replay checks passed.');

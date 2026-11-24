const menu = document.querySelector('.menu');
const nav = document.querySelector('#site-nav');
const compact = window.matchMedia('(max-width: 800px)');

function syncMenu() {
  menu.hidden = !compact.matches;
  nav.hidden = compact.matches && menu.getAttribute('aria-expanded') === 'false';
}

function setMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  syncMenu();
}

menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
nav.addEventListener('click', event => {
  if (event.target.closest('a') && compact.matches) setMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && compact.matches && !nav.hidden) {
    setMenu(false);
    menu.focus();
  }
});
compact.addEventListener('change', () => setMenu(false));
syncMenu();

const form = document.querySelector('#demo-form');
const requestButton = document.querySelector('#request-button');
requestButton.disabled = false;
const status = document.querySelector('#form-status');
const contact = window.PREMADESK_CONTACT_EMAIL;
const hasEmail = typeof contact === 'string' && /^[\w.+-]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(contact);
if (hasEmail) {
  const email = document.createElement('a');
  email.href = 'mailto:' + contact;
  email.textContent = contact;
  const contactLine = document.querySelector('#contact-email');
  contactLine.append(email);
  contactLine.hidden = false;
  requestButton.textContent = 'Open email draft →';
  document.querySelector('#form-help').textContent = 'Opens a draft in your email app. Review it there and select Send.';
} else {
  document.querySelector('#form-help').textContent = 'An email address is not configured. You can download your request as a draft.';
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const fields = new FormData(form);
  const message = [
    'I would like to request a PremaDesk demo.',
    '',
    'Name: ' + fields.get('name').trim(),
    'Property: ' + fields.get('property').trim(),
    'Email: ' + fields.get('email').trim(),
    '',
    fields.get('message').trim(),
  ].join('\r\n');
  if (hasEmail) {
    const query = 'subject=' + encodeURIComponent('PremaDesk demo request') + '&body=' + encodeURIComponent(message);
    status.textContent = 'Review and send the draft from your email app.';
    window.location.href = 'mailto:' + contact + '?' + query;
    return;
  }
  const url = URL.createObjectURL(new Blob([message], { type: 'text/plain' }));
  const download = document.createElement('a');
  download.href = url;
  download.download = 'PremaDesk-demo-request.txt';
  download.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Draft downloaded. Your request has not been sent.';
});

const slideshow = document.querySelector('.hero-slideshow');
const slides = [...document.querySelectorAll('.hero-photo')];
const slideButtons = [...slideshow.querySelectorAll('[data-slide]')];
const slideCaption = slideshow.querySelector('.slide-caption');
const toggle = slideshow.querySelector('.slide-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const captions = ['Hotel reception', 'Guest rooms', 'Reservations'];
let currentSlide = 0;
let playing = !reducedMotion.matches;
let timer;

function showSlide(index) {
  currentSlide = index;
  slides.forEach((slide, position) => {
    const selected = position === index;
    slide.classList.toggle('is-active', selected);
    slideButtons[position].setAttribute('aria-pressed', String(selected));
  });
  slideCaption.textContent = captions[index];
}

function updatePlayback() {
  window.clearInterval(timer);
  toggle.textContent = playing ? 'Pause' : 'Play';
  toggle.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
  slideCaption.setAttribute('aria-live', playing ? 'off' : 'polite');
  if (playing && !document.hidden) {
    timer = window.setInterval(() => showSlide((currentSlide + 1) % slides.length), 6500);
  }
}

slideButtons.forEach((button, index) => button.addEventListener('click', () => {
  playing = false;
  updatePlayback();
  showSlide(index);
}));
toggle.addEventListener('click', () => {
  playing = !playing;
  updatePlayback();
});
reducedMotion.addEventListener('change', event => {
  if (event.matches) playing = false;
  updatePlayback();
});
document.addEventListener('visibilitychange', updatePlayback);
slideshow.hidden = false;
updatePlayback();

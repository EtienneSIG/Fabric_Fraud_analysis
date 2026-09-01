import { runPopupRelay } from '@azure/msal-browser/popup-relay';
import i18n, { i18nReady } from '@/i18n/i18n';

await i18nReady;

const title = document.querySelector<HTMLElement>('[data-auth-title]');
const button = document.querySelector<HTMLButtonElement>('[data-auth-continue]');

document.title = i18n.t('authRelay.title');
if (title) title.textContent = i18n.t('authRelay.title');
if (!button) throw new Error('Authentication relay button is missing.');

button.textContent = i18n.t('authRelay.continue');
button.hidden = false;
button.addEventListener('click', () => {
	button.disabled = true;
	button.textContent = i18n.t('authRelay.signingIn');
	runPopupRelay();
}, { once: true });
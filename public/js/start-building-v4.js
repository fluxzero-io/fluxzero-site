const DEV_SESSION_COOKIE = 'fluxzero_dev_session';
const SESSION_EVENT = 'fluxzero:sessionchange';

function hasDevSession() {
    return document.cookie
        .split(';')
        .map((part) => part.trim())
        .some((part) => part === `${DEV_SESSION_COOKIE}=1`);
}

function setDevSession(active) {
    const maxAge = active ? 60 * 60 * 24 * 30 : 0;
    document.cookie = `${DEV_SESSION_COOKIE}=${active ? '1' : ''}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

function initPreviewSession() {
    const previewEnabled = document.body.dataset.previewEnabled === 'true';
    const signedOutView = document.querySelector('[data-auth-view="signed-out"]');
    const signedInView = document.querySelector('[data-auth-view="signed-in"]');
    const signInButtons = document.querySelectorAll('[data-dev-sign-in]');
    if (!signedOutView || !signedInView) return;

    const render = () => {
        const isSignedIn = previewEnabled && hasDevSession();
        signedOutView.hidden = isSignedIn;
        signedInView.hidden = !isSignedIn;
        document.body.classList.toggle('is-preview-signed-in', isSignedIn);
    };

    signInButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (!previewEnabled) return;
            setDevSession(true);
            render();
            window.dispatchEvent(new Event(SESSION_EVENT));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    window.addEventListener(SESSION_EVENT, render);
    render();
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } finally {
        textarea.remove();
    }
    return copied;
}

function initPromptCopy() {
    const prompt = document.querySelector('[data-agent-prompt]');
    const button = document.querySelector('[data-copy-prompt]');
    const status = document.querySelector('[data-copy-status]');
    if (!prompt || !button || !status) return;

    let resetTimer = 0;
    const setStatus = (message, isError = false) => {
        window.clearTimeout(resetTimer);
        status.textContent = message;
        status.classList.toggle('is-error', isError);
        button.classList.toggle('is-copied', !isError);
        button.setAttribute('aria-label', isError ? 'Try copying again' : 'Copied');
        button.setAttribute('title', isError ? 'Try copying again' : 'Copied');

        resetTimer = window.setTimeout(() => {
            status.textContent = '';
            status.classList.remove('is-error');
            button.classList.remove('is-copied');
            button.setAttribute('aria-label', 'Copy instruction');
            button.setAttribute('title', 'Copy instruction');
        }, 2500);
    };

    button.addEventListener('click', async () => {
        const promptText = prompt.textContent || '';
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(promptText);
            } else if (!fallbackCopy(promptText)) {
                throw new Error('Copy command was not available');
            }
            setStatus('');
        } catch {
            setStatus('Copy failed. Select the text and copy it manually.', true);
        }
    });
}

initPreviewSession();
initPromptCopy();

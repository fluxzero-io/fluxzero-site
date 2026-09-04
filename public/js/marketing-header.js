const FLUXZERO_DEV_SESSION_COOKIE = 'fluxzero_dev_session';
const FLUXZERO_SESSION_EVENT = 'fluxzero:sessionchange';

function hasFluxzeroDevSession() {
    return document.cookie
        .split(';')
        .map((part) => part.trim())
        .some((part) => part === `${FLUXZERO_DEV_SESSION_COOKIE}=1`);
}

function clearFluxzeroDevSession() {
    document.cookie = `${FLUXZERO_DEV_SESSION_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function initAccountNavigation(accountNav) {
    const previewEnabled = accountNav.dataset.previewEnabled === 'true';
    const signInLink = accountNav.querySelector('[data-nav-sign-in]');
    const authenticatedNav = accountNav.querySelector('[data-nav-authenticated]');
    const profile = accountNav.querySelector('.nav-profile');
    const profileTrigger = accountNav.querySelector('[data-nav-profile-trigger]');
    const profileMenu = accountNav.querySelector('[data-nav-profile-menu]');
    const signOutButton = accountNav.querySelector('[data-nav-sign-out]');

    if (!signInLink || !authenticatedNav || !profile || !profileTrigger || !profileMenu || !signOutButton) return;

    const closeMenu = ({ restoreFocus = false } = {}) => {
        profileMenu.hidden = true;
        profileTrigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus) profileTrigger.focus();
    };

    const render = () => {
        const isSignedIn = previewEnabled && hasFluxzeroDevSession();
        signInLink.hidden = isSignedIn;
        authenticatedNav.hidden = !isSignedIn;
        if (!isSignedIn) closeMenu();
    };

    profileTrigger.addEventListener('click', () => {
        const willOpen = profileMenu.hidden;
        profileMenu.hidden = !willOpen;
        profileTrigger.setAttribute('aria-expanded', String(willOpen));
        if (willOpen) profileMenu.querySelector('[role="menuitem"]')?.focus();
    });

    signOutButton.addEventListener('click', () => {
        clearFluxzeroDevSession();
        closeMenu();
        window.dispatchEvent(new Event(FLUXZERO_SESSION_EVENT));
    });

    document.addEventListener('pointerdown', (event) => {
        if (!profile.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !profileMenu.hidden) closeMenu({ restoreFocus: true });
    });

    window.addEventListener(FLUXZERO_SESSION_EVENT, render);
    render();
}

document.querySelectorAll('[data-account-nav]').forEach(initAccountNavigation);

import { InMemoryWebStorage, OidcClient, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

type OidcElement = HTMLElement & {
    dataset: DOMStringMap & {
        oidcIssuer?: string;
        oidcClientId?: string;
        oidcResource?: string;
    };
};

const PRESENCE_KEY = 'fluxzero.website.oidc.presence.v1';

function displayName(user: User): string | undefined {
    return [user.profile.name, user.profile.given_name]
        .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
        ?.trim().slice(0, 32);
}

function rememberPresence(user: User | null, element: OidcElement): void {
    try {
        if (!user || user.expired) {
            sessionStorage.removeItem(PRESENCE_KEY);
            return;
        }
        sessionStorage.setItem(PRESENCE_KEY, JSON.stringify({
            version: 1,
            issuer: element.dataset.oidcIssuer,
            clientId: element.dataset.oidcClientId,
            name: displayName(user) ?? '',
            savedAt: Date.now(),
        }));
    } catch {
        // Storage may be unavailable; the normal silent session check still works.
    }
}

function managerFor(element: OidcElement): UserManager {
    const { oidcIssuer: authority, oidcClientId: client_id } = element.dataset;
    if (!authority || !client_id) {
        throw new Error('Website OIDC is not configured');
    }
    const callback = `${window.location.origin}/oidc/callback/`;
    return new UserManager({
        authority,
        client_id,
        redirect_uri: callback,
        silent_redirect_uri: `${window.location.origin}/oidc/silent-callback/`,
        post_logout_redirect_uri: `${window.location.origin}/oidc/logout-callback/`,
        response_type: 'code',
        scope: 'openid profile',
        automaticSilentRenew: false,
        monitorSession: false,
        loadUserInfo: false,
        silentRequestTimeoutInSeconds: 15,
        stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
        userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    });
}

function currentPage(): string {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function authorizationNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safePage(value: unknown): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
    try {
        const target = new URL(value, window.location.origin);
        return target.origin === window.location.origin
            ? `${target.pathname}${target.search}${target.hash}` : '/';
    } catch {
        return '/';
    }
}

function returnPage(state: unknown): string {
    return safePage(state && typeof state === 'object' && 'returnTo' in state ? state.returnTo : undefined);
}

export function initWebsiteOidc(): void {
    const controls = Array.from(document.querySelectorAll<OidcElement>('[data-website-account-controls]'));
    const configured = controls.find((element) => element.hasAttribute('data-website-oidc'));
    if (!configured) return;

    let manager: UserManager;
    try {
        manager = managerFor(configured);
    } catch {
        return;
    }

    let pendingCheck: Promise<void> | null = null;
    let lastCheck = 0;
    let currentUser: User | null = null;
    const render = (user: User | null) => {
        currentUser = user;
        rememberPresence(user, configured);
        const name = user ? displayName(user) : undefined;

        controls.forEach((control) => {
            const dashboard = control.querySelector<HTMLAnchorElement>('[data-website-dashboard]');
            const identity = control.querySelector<HTMLElement>('[data-oidc-identity]');
            const nameElement = control.querySelector<HTMLElement>('[data-oidc-name]');
            const signedIn = control.querySelector<HTMLElement>('[data-oidc-signed-in]');
            const signedOut = control.querySelector<HTMLElement>('[data-oidc-signed-out]');
            const trigger = control.querySelector<HTMLElement>('.website-account-trigger');
            if (dashboard) {
                if (user) dashboard.dataset.oidcState = 'signed-in';
                else dashboard.removeAttribute('data-oidc-state');
                dashboard.setAttribute('aria-label', user ? 'Dashboard, signed in' : 'Dashboard');
            }
            if (identity) identity.hidden = !user;
            if (signedIn) signedIn.hidden = !user;
            if (signedOut) signedOut.hidden = !!user;
            if (nameElement) {
                nameElement.textContent = name ?? '';
                nameElement.hidden = !name;
            }
            if (trigger) {
                if (user) trigger.dataset.oidcState = 'signed-in';
                else trigger.removeAttribute('data-oidc-state');
                trigger.setAttribute('aria-label', name ? `Account, signed in as ${name}` : user ? 'Account, signed in' : 'Account');
            }
        });
    };

    controls.forEach((control) => control.addEventListener('click', (event) => {
        const target = event.target as Element;
        const action = target.closest<HTMLElement>('[data-oidc-create], [data-oidc-login], [data-oidc-logout]');
        if (!action || !control.contains(action)) return;
        event.preventDefault();
        const returnTo = currentPage();
        const resource = configured.dataset.oidcResource;
        const request = async () => {
            if (action.hasAttribute('data-oidc-login')) {
                await manager.signinRedirect({ state: { returnTo }, nonce: authorizationNonce(), ...(resource ? { resource } : {}) });
            } else if (action.hasAttribute('data-oidc-create')) {
                const client = new OidcClient(manager.settings, manager.metadataService);
                const signin = await client.createSigninRequest({
                    request_type: 'si:r', state: { returnTo }, nonce: authorizationNonce(),
                    ...(resource ? { resource } : {}),
                });
                const authorization = new URL(signin.url);
                const issuer = new URL(configured.dataset.oidcIssuer!);
                if (authorization.origin !== issuer.origin || authorization.pathname !== '/oauth2/auth') {
                    throw new Error('Unexpected authorization endpoint for account creation');
                }
                const registration = new URL('/register', issuer);
                registration.searchParams.set('returnTo', `${authorization.pathname}${authorization.search}`);
                window.location.assign(registration.href);
            } else if (action.hasAttribute('data-oidc-logout')) {
                if (!currentUser) await check();
                if (currentUser) await manager.signoutRedirect({ state: { returnTo } });
            }
        };
        void request().catch((error) => {
            if (import.meta.env.DEV) console.debug('Website account action unavailable', error);
        });
    }));
    const check = (): Promise<void> => {
        if (pendingCheck) return pendingCheck;
        lastCheck = Date.now();
        pendingCheck = (async () => {
            try {
                const resource = configured.dataset.oidcResource;
                const user = await manager.signinSilent({
                    forceIframeAuth: true,
                    nonce: authorizationNonce(),
                    ...(resource ? { resource } : {}),
                });
                render(user && !user.expired ? user : null);
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.debug('Website silent OIDC unavailable', error);
                }
                render(null);
            } finally {
                pendingCheck = null;
            }
        })();
        return pendingCheck;
    };

    void check();
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) void check();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastCheck > 30_000) void check();
    });
}

export async function finishInteractiveWebsiteOidc(): Promise<void> {
    const root = document.querySelector<OidcElement>('[data-website-oidc-callback]');
    if (!root) return;
    const responseUrl = window.location.href;
    window.history.replaceState(null, '', window.location.pathname);
    try {
        const user = await managerFor(root).signinRedirectCallback(responseUrl);
        rememberPresence(user, root);
        window.location.replace(returnPage(user.state));
    } catch (error) {
        if (import.meta.env.DEV) console.debug('Website sign-in callback failed', error);
        window.location.replace('/');
    }
}

export async function finishWebsiteLogout(): Promise<void> {
    const root = document.querySelector<OidcElement>('[data-website-oidc-callback]');
    if (!root) return;
    const responseUrl = window.location.href;
    window.history.replaceState(null, '', window.location.pathname);
    rememberPresence(null, root);
    try {
        const response = await managerFor(root).signoutRedirectCallback(responseUrl);
        window.location.replace(returnPage(response.userState));
    } catch (error) {
        if (import.meta.env.DEV) console.debug('Website logout callback failed', error);
        window.location.replace('/');
    }
}

export async function finishSilentWebsiteOidc(): Promise<void> {
    const root = document.querySelector<OidcElement>('[data-website-oidc-callback]');
    if (!root) return;
    const responseUrl = window.location.href;
    window.history.replaceState(null, '', window.location.pathname);
    try {
        await managerFor(root).signinSilentCallback(responseUrl);
    } catch (error) {
        if (import.meta.env.DEV) {
            console.debug('Website silent OIDC callback failed', error);
        }
        // A failed silent check leaves the marketing navigation in its neutral state.
    }
}

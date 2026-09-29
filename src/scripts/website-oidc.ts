import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

type OidcElement = HTMLElement & {
    dataset: DOMStringMap & {
        oidcIssuer?: string;
        oidcClientId?: string;
        oidcResource?: string;
    };
};

function managerFor(element: OidcElement): UserManager {
    const { oidcIssuer: authority, oidcClientId: client_id } = element.dataset;
    if (!authority || !client_id) {
        throw new Error('Website OIDC is not configured');
    }
    const callback = `${window.location.origin}/oidc/silent-callback/`;
    return new UserManager({
        authority,
        client_id,
        redirect_uri: callback,
        silent_redirect_uri: callback,
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

    let checking = false;
    let lastCheck = 0;
    const render = (user: User | null) => {
        const name = user
            ? [user.profile.given_name, user.profile.name]
                .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
                ?.trim().slice(0, 32)
            : undefined;

        controls.forEach((control) => {
            const dashboard = control.querySelector<HTMLAnchorElement>('[data-website-dashboard]');
            const identity = control.querySelector<HTMLElement>('[data-oidc-identity]');
            const nameElement = control.querySelector<HTMLElement>('[data-oidc-name]');
            const accountLink = control.querySelector<HTMLAnchorElement>('[data-oidc-account-link]');
            const trigger = control.querySelector<HTMLElement>('.website-account-trigger');
            if (dashboard) {
                if (user) dashboard.dataset.oidcState = 'signed-in';
                else dashboard.removeAttribute('data-oidc-state');
                dashboard.setAttribute('aria-label', user ? 'Dashboard, signed in' : 'Dashboard');
            }
            if (identity) identity.hidden = !user;
            if (nameElement) {
                nameElement.textContent = name ?? '';
                nameElement.hidden = !name;
            }
            if (accountLink) {
                const label = user ? 'Open dashboard' : 'Sign in';
                accountLink.textContent = label;
                accountLink.setAttribute('aria-label', label);
            }
            if (trigger) trigger.setAttribute('aria-label', name ? `Account, signed in as ${name}` : user ? 'Account, signed in' : 'Account');
        });
    };
    const check = async () => {
        if (checking) return;
        checking = true;
        lastCheck = Date.now();
        try {
            const resource = configured.dataset.oidcResource;
            const user = await manager.signinSilent({
                forceIframeAuth: true,
                ...(resource ? { resource } : {}),
            });
            render(user && !user.expired ? user : null);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.debug('Website silent OIDC unavailable', error);
            }
            render(null);
        } finally {
            checking = false;
        }
    };

    void check();
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) void check();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastCheck > 30_000) void check();
    });
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

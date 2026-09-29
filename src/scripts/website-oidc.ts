import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts';

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

export function initWebsiteOidc(link: HTMLAnchorElement): void {
    let manager: UserManager;
    try {
        manager = managerFor(link);
    } catch {
        return;
    }

    let checking = false;
    let lastCheck = 0;
    const nameElement = link.querySelector<HTMLElement>('[data-oidc-name]');
    const reset = () => {
        link.removeAttribute('data-oidc-state');
        if (nameElement) {
            nameElement.hidden = true;
            nameElement.textContent = '';
        }
        link.removeAttribute('aria-label');
    };
    const check = async () => {
        if (checking) return;
        checking = true;
        lastCheck = Date.now();
        reset();
        try {
            const resource = link.dataset.oidcResource;
            const user = await manager.signinSilent({
                forceIframeAuth: true,
                ...(resource ? { resource } : {}),
            });
            if (!user || user.expired) return;
            link.dataset.oidcState = 'signed-in';
            const name = [user.profile.given_name, user.profile.name]
                .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
                ?.trim().slice(0, 32);
            if (name && nameElement) {
                nameElement.textContent = name;
                nameElement.hidden = false;
                link.setAttribute('aria-label', `Dashboard, signed in as ${name}`);
            } else {
                link.setAttribute('aria-label', 'Dashboard, signed in');
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.debug('Website silent OIDC unavailable', error);
            }
            reset();
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

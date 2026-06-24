const BUILD_PROMPT_STORAGE_KEY = 'fluxzeroBuildPrompt';
const BUILD_READY_PROMPT_STORAGE_KEY = 'fluxzeroBuildReadyPrompt';
const CODEX_HANDOFF_STORAGE_KEY = 'fluxzeroCodexHandoff';
const FLUXZERO_SESSION_READY_KEY = 'fluxzeroSessionReady';

function readStoredPrompt() {
    try {
        return localStorage.getItem(BUILD_PROMPT_STORAGE_KEY) || '';
    } catch (error) {
        return '';
    }
}

function saveStoredPrompt(value) {
    try {
        localStorage.setItem(BUILD_PROMPT_STORAGE_KEY, value);
        localStorage.setItem('fluxzeroBuildPromptUpdatedAt', new Date().toISOString());
    } catch (error) {
        /* The form remains usable when storage is unavailable. */
    }
}

function saveBuildReadyPrompt(value) {
    const payload = {
        prompt: value,
        source: 'fluxzero-start-building',
        updatedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(BUILD_READY_PROMPT_STORAGE_KEY, value);
        localStorage.setItem(CODEX_HANDOFF_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        /* The visible prompt remains available when storage is unavailable. */
    }

    window.dispatchEvent(new CustomEvent('fluxzero:codex-prompt-ready', { detail: payload }));
}

function readPromptFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('idea') || '';
}

function hasFluxzeroSession() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fluxzeroLogin') === 'success') {
        try {
            localStorage.setItem(FLUXZERO_SESSION_READY_KEY, 'true');
        } catch (error) {
            /* Query param is enough for this page load. */
        }
        return true;
    }

    try {
        if (localStorage.getItem(FLUXZERO_SESSION_READY_KEY) === 'true') return true;
    } catch (error) {
        /* Ignore blocked storage. */
    }

    return Boolean(window.FluxzeroSession && window.FluxzeroSession.isAuthenticated === true);
}

function buildPromptText({ idea, agent, direction }) {
    const normalizedIdea = idea || 'A platform that helps...';
    const normalizedAgent = agent || 'Claude Code';
    const normalizedDirection = {
        builderType: direction.builderType || 'Solo',
        projectStage: direction.projectStage || 'Prototype',
        experienceLevel: direction.experienceLevel || 'Non-technical',
        role: direction.role || 'Founder'
    };

    return `Original idea:
${normalizedIdea}

Project brief additions:
Selected agent:
${normalizedAgent}

Builder type:
${normalizedDirection.builderType}

Project stage:
${normalizedDirection.projectStage}

Experience level:
${normalizedDirection.experienceLevel}

Role:
${normalizedDirection.role}

Fluxzero automatically handles:
- Project structure
- Database
- Base interface
- Deployment preparation

You stay in control of:
- Content
- Features
- Adjustments
- Launch`;
}

function initStartBuildingPage() {
    const ideaField = document.querySelector('[data-brief-idea]');
    const promptEditButton = document.querySelector('[data-prompt-edit]');
    const directionFields = Array.from(document.querySelectorAll('[data-direction-field]'));
    const agentOptions = Array.from(document.querySelectorAll('[data-agent-option]'));
    const agentDropdown = document.querySelector('[data-agent-dropdown]');
    const agentSelectedIcon = document.querySelector('[data-agent-selected-icon]');
    const agentSelectedName = document.querySelector('[data-agent-selected-name]');
    const agentDownloadLink = document.querySelector('[data-agent-download-link]');
    const agentDownloadName = document.querySelector('[data-agent-download-name]');
    const agentDownloadCopy = document.querySelector('[data-agent-download-copy]');
    const agentOtherNote = document.querySelector('[data-agent-other-note]');
    const combinedPrompt = document.querySelector('[data-combined-prompt]');
    const copyButton = document.querySelector('[data-copy-build-prompt]');
    const copyMessage = document.querySelector('[data-copy-message]');
    const handoff = document.querySelector('[data-start-handoff]');
    const codexButton = document.querySelector('[data-codex-button]');
    const handoffMessage = document.querySelector('[data-handoff-message]');

    if (!ideaField || !combinedPrompt) return;

    const initialPrompt = readPromptFromUrl().trim() || readStoredPrompt().trim();
    if (initialPrompt) {
        ideaField.value = initialPrompt;
        saveStoredPrompt(initialPrompt);
    }

    function getSelectedAgentOption() {
        return agentOptions.find(option => option.querySelector('input')?.checked) || agentOptions[0] || null;
    }

    function getSelectedAgent() {
        const option = getSelectedAgentOption();
        return option ? option.dataset.agentName || 'Claude Code' : 'Claude Code';
    }

    function syncAgentPicker(closeDropdown = false) {
        const option = getSelectedAgentOption();
        if (!option) return;

        const name = option.dataset.agentName || 'Claude Code';
        const href = option.dataset.agentHref || '';
        const icon = option.querySelector('.agent-option__icon');

        if (agentSelectedName) agentSelectedName.textContent = name;
        if (agentSelectedIcon && icon) agentSelectedIcon.innerHTML = icon.innerHTML;
        if (agentDownloadName) agentDownloadName.textContent = name;

        const isOther = option.dataset.agentId === 'other';
        if (agentDownloadCopy) agentDownloadCopy.hidden = isOther;
        if (agentDownloadLink) {
            agentDownloadLink.hidden = isOther;
            if (href && !isOther) {
                agentDownloadLink.href = href;
            } else {
                agentDownloadLink.removeAttribute('href');
            }
        }
        if (agentOtherNote) agentOtherNote.hidden = !isOther;
        if (closeDropdown && agentDropdown) agentDropdown.open = false;
    }

    function getDirectionData() {
        return directionFields.reduce((data, field) => {
            const key = field.dataset.directionKey;
            if (key) data[key] = field.value.trim();
            return data;
        }, {});
    }

    function getBriefData() {
        return {
            idea: ideaField.value.trim(),
            agent: getSelectedAgent(),
            direction: getDirectionData()
        };
    }

    function renderPrompt() {
        const data = getBriefData();
        const promptText = buildPromptText(data);
        combinedPrompt.textContent = promptText;
        saveBuildReadyPrompt(promptText);

        saveStoredPrompt(data.idea);
        if (copyMessage) copyMessage.textContent = '';
    }

    [ideaField, ...directionFields].filter(Boolean).forEach(field => {
        field.addEventListener('input', renderPrompt);
        field.addEventListener('change', renderPrompt);
    });

    agentOptions.forEach(option => {
        const input = option.querySelector('input');
        if (!input) return;
        input.addEventListener('change', () => {
            syncAgentPicker(true);
            renderPrompt();
        });
    });

    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(combinedPrompt.textContent || '');
                if (copyMessage) copyMessage.textContent = 'Copied.';
            } catch (error) {
                if (copyMessage) copyMessage.textContent = 'Copy failed. Select the prompt manually.';
            }
        });
    }

    if (promptEditButton) {
        promptEditButton.addEventListener('click', () => {
            const isEditing = ideaField.readOnly;
            ideaField.readOnly = !isEditing;
            promptEditButton.setAttribute('aria-pressed', String(isEditing));
            promptEditButton.setAttribute('aria-label', isEditing ? 'Lock prompt' : 'Edit prompt');
            promptEditButton.classList.toggle('is-editing', isEditing);
            if (isEditing) ideaField.focus();
        });
    }

    function setHandoffMessage(message) {
        if (!handoffMessage) return;
        handoffMessage.textContent = message || '';
        handoffMessage.classList.toggle('show', Boolean(message));
    }

    function setHandoffReady(isReady) {
        if (handoff) handoff.classList.toggle('is-login-ready', isReady);
        if (codexButton) codexButton.textContent = 'Open project';

        if (isReady) {
            setHandoffMessage('Fluxzero is connected. Your project is ready to open.');
        } else {
            setHandoffMessage('');
        }
    }

    async function openProject() {
        const promptText = combinedPrompt.textContent || '';
        saveBuildReadyPrompt(promptText);

        const handoffPayload = {
            prompt: promptText,
            source: 'fluxzero-start-building',
            updatedAt: new Date().toISOString()
        };

        if (window.FluxzeroCodexHandoff && typeof window.FluxzeroCodexHandoff.open === 'function') {
            await window.FluxzeroCodexHandoff.open(handoffPayload);
            setHandoffMessage('Opening your project with the build-ready prompt.');
            return;
        }

        try {
            await navigator.clipboard.writeText(promptText);
            setHandoffMessage('Prompt prepared. The integration hook is ready; clipboard fallback copied the prompt.');
        } catch (error) {
            setHandoffMessage('Prompt prepared. The integration hook is ready for your team to connect.');
        }
    }

    if (codexButton) {
        codexButton.addEventListener('click', async () => {
            if (!hasFluxzeroSession()) {
                setHandoffMessage('Log in to Fluxzero before opening this project.');
                return;
            }

            await openProject();
        });
    }

    window.addEventListener('fluxzero:login-ready', () => {
        try {
            localStorage.setItem(FLUXZERO_SESSION_READY_KEY, 'true');
        } catch (error) {
            /* The visible state still updates. */
        }
        setHandoffReady(true);
    });

    syncAgentPicker(false);
    renderPrompt();
    setHandoffReady(hasFluxzeroSession());
}

initStartBuildingPage();

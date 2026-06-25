const BUILD_PROMPT_STORAGE_KEY = 'fluxzeroBuildPrompt';
const BUILD_READY_PROMPT_STORAGE_KEY = 'fluxzeroBuildReadyPrompt';
const CODEX_HANDOFF_STORAGE_KEY = 'fluxzeroCodexHandoff';
const LAST_AGENT_CODE_STORAGE_KEY = 'fluxzeroLastAgentCode';
const GENERATED_PROJECT_ENDPOINT = 'https://api.dashboard.fluxzero.io/generate-project/new';
const DEFAULT_PROJECT_TITLE = 'Patient Portal';
const DEFAULT_PRODUCT_IDEA = 'Patient portal for visits, notes, updates, and invoices.';
const FALLBACK_PROJECT_DEFAULTS = {
    groupId: 'com.example',
    selectedTemplate: 'flux-basic-java',
    buildTool: 'maven'
};

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

function readStoredAgentCode() {
    try {
        return localStorage.getItem(LAST_AGENT_CODE_STORAGE_KEY) || '';
    } catch (error) {
        return '';
    }
}

function saveStoredAgentCode(value) {
    try {
        if (value) localStorage.setItem(LAST_AGENT_CODE_STORAGE_KEY, value);
    } catch (error) {
        /* Agent selection falls back to the default when storage is unavailable. */
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

function readProjectTitleFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('title') || params.get('projectTitle') || '';
}

function readUserEmailFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || params.get('userEmail') || '';
}

function readPlatformOverrideFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const value = (params.get('platform') || params.get('device') || params.get('fluxzeroPlatform') || '').trim().toLowerCase();
    const aliases = {
        mac: 'macos',
        osx: 'macos',
        macos: 'macos',
        win: 'windows',
        windows: 'windows',
        iphone: 'ios',
        ipad: 'ios',
        ios: 'ios',
        android: 'android',
        linux: 'linux',
        ubuntu: 'linux',
        other: 'other',
        zip: 'other',
        'non-mac': 'other',
        'non-macos': 'other'
    };

    return aliases[value] || '';
}

function buildPromptText({ idea }) {
    return idea || DEFAULT_PRODUCT_IDEA;
}

function initStartBuildingPage() {
    const projectTitleField = document.querySelector('[data-project-title]');
    const ideaField = document.querySelector('[data-brief-idea]');
    const userEmailField = document.querySelector('[data-user-email]');
    const productField = ideaField ? ideaField.closest('.brief-field--prompt') : null;
    const promptEditButton = document.querySelector('[data-prompt-edit]');
    const agentOptions = Array.from(document.querySelectorAll('[data-agent-option]'));
    const agentStep = document.querySelector('[data-agent-step]');
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
    const codexButton = document.querySelector('[data-codex-button]');
    const handoffMessage = document.querySelector('[data-handoff-message]');
    const installerStep = document.querySelector('[data-installer-step]');
    const fluxzeroDownloadAction = document.querySelector('[data-fluxzero-download-action]');
    const fluxzeroDownloadLink = document.querySelector('[data-fluxzero-download]');
    const installerNote = document.querySelector('[data-installer-note]');
    const generatorAdvanced = document.querySelector('[data-generator-advanced]');
    const generatorGroupField = document.querySelector('[data-generator-group]');
    const generatorArtifactField = document.querySelector('[data-generator-artifact]');
    const generatorLanguageOptions = Array.from(document.querySelectorAll('[data-generator-language]'));
    const generatorBuildToolOptions = Array.from(document.querySelectorAll('[data-generator-build-tool]'));

    let artifactIdManuallyEdited = false;
    let buildToolManuallyEdited = false;
    let isGeneratingProject = false;
    let handoffMessageTimer = 0;

    if (!projectTitleField || !ideaField || !combinedPrompt || !userEmailField) return;

    const initialProjectTitle = readProjectTitleFromUrl().trim();
    const initialPrompt = readPromptFromUrl().trim();
    const initialEmail = readUserEmailFromUrl().trim();
    if (initialProjectTitle) projectTitleField.value = initialProjectTitle;
    if (initialEmail) userEmailField.value = initialEmail;
    if (initialPrompt) {
        ideaField.value = initialPrompt;
        saveStoredPrompt(initialPrompt);
    }

    function detectClientPlatform() {
        const override = readPlatformOverrideFromUrl();
        if (override) return override;

        const ua = window.navigator.userAgent || '';
        const platform = window.navigator.userAgentData?.platform || window.navigator.platform || '';
        const maxTouchPoints = Number(window.navigator.maxTouchPoints || 0);
        const isIPadOS = /mac/i.test(platform) && maxTouchPoints > 1;

        if (/iphone|ipad|ipod/i.test(ua) || isIPadOS) return 'ios';
        if (/android/i.test(ua) || /android/i.test(platform)) return 'android';
        if (/win/i.test(platform) || /windows/i.test(ua)) return 'windows';
        if (/mac/i.test(platform)) return 'macos';
        if (/linux|x11/i.test(platform) || /linux/i.test(ua)) return 'linux';
        return 'other';
    }

    function renumberVisibleSteps() {
        Array.from(document.querySelectorAll('.start-step:not([hidden]) .start-step__number')).forEach((number, index) => {
            number.textContent = String(index + 1);
        });
    }

    function syncInstallerAvailability() {
        const platform = detectClientPlatform();
        const hasLaunchpad = platform === 'macos';
        document.body.dataset.clientPlatform = platform;
        document.body.dataset.projectDelivery = hasLaunchpad ? 'launchpad' : 'zip';

        if (agentStep) agentStep.hidden = !hasLaunchpad;
        if (installerStep) installerStep.hidden = !hasLaunchpad;
        if (fluxzeroDownloadAction) fluxzeroDownloadAction.hidden = !hasLaunchpad;

        if (installerNote) {
            installerNote.textContent = 'Make sure it is installed before proceeding.';
        }

        renumberVisibleSteps();
    }

    function getGeneratorCore() {
        return window.FluxzeroProjectGenerator;
    }

    function syncProductStateClasses(isEditing) {
        const hasProduct = Boolean(ideaField.value.trim());
        if (productField) {
            productField.classList.toggle('is-editing', isEditing);
            productField.classList.toggle('is-readonly', !isEditing);
            productField.classList.toggle('is-empty', !hasProduct);
        }
    }

    function syncProductFieldHeight() {
        if (!ideaField.readOnly) {
            ideaField.rows = 4;
            ideaField.style.height = '';
            return;
        }

        ideaField.rows = 1;
        ideaField.style.height = 'auto';
        ideaField.style.height = `${Math.max(24, ideaField.scrollHeight)}px`;
    }

    function setProductEditing(isEditing, shouldFocus = false) {
        const hasProduct = Boolean(ideaField.value.trim());
        const shouldEdit = isEditing || !hasProduct;

        ideaField.readOnly = !shouldEdit;
        syncProductStateClasses(shouldEdit);
        syncProductFieldHeight();

        if (promptEditButton) {
            promptEditButton.setAttribute('aria-pressed', String(shouldEdit));
            promptEditButton.setAttribute('aria-label', shouldEdit ? 'Lock product' : 'Edit product');
            promptEditButton.classList.toggle('is-editing', shouldEdit);
        }

        if (shouldEdit && shouldFocus) ideaField.focus();
    }

    function getSelectedAgentOption() {
        return agentOptions.find(option => option.querySelector('input')?.checked) || agentOptions[0] || null;
    }

    function getSelectedAgent() {
        const option = getSelectedAgentOption();
        return option ? option.dataset.agentName || 'Claude Code' : 'Claude Code';
    }

    function getSelectedAgentId() {
        const option = getSelectedAgentOption();
        return option?.dataset.agentId || 'claude';
    }

    function restoreStoredAgentCode() {
        const agentCode = readStoredAgentCode();
        if (!agentCode) return;

        const option = agentOptions.find(candidate => candidate.dataset.agentId === agentCode);
        const input = option?.querySelector('input');
        if (input) input.checked = true;
    }

    function getLaunchpadAgent() {
        switch (getSelectedAgentId()) {
            case 'codex':
                return 'codex';
            case 'cursor':
                return 'cursor';
            case 'claude':
                return 'claude';
            default:
                return 'finder';
        }
    }

    function buildFluxzeroNewProjectUrl(promptText) {
        const params = [
            ['name', projectTitleField.value.trim()],
            ['email', userEmailField.value.trim()],
            ['platform', detectClientPlatform()],
            ['prompt', promptText],
            ['agent', getLaunchpadAgent()]
        ];
        const query = params
            .filter(([, value]) => Boolean(value))
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');

        return `fluxzero://new?${query}`;
    }

    function packageNameForProjectData(projectData) {
        return `${projectData.groupId}.${projectData.artifactId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    }

    function createGeneratedProjectPayload(promptText, projectData) {
        const payload = {
            name: projectTitleField.value.trim(),
            prompt: promptText,
            email: userEmailField.value.trim(),
            platform: detectClientPlatform()
        };

        if (!projectData) {
            return {
                ...payload,
                agent: getLaunchpadAgent()
            };
        }

        return {
            ...payload,
            template: projectData.selectedTemplate,
            groupId: projectData.groupId,
            artifactId: projectData.artifactId,
            packageName: packageNameForProjectData(projectData),
            build: projectData.buildTool,
            git: true
        };
    }

    function recordGeneratedProject(promptText, projectData) {
        fetch(GENERATED_PROJECT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(createGeneratedProjectPayload(promptText, projectData))
        }).catch(() => {
            /* Project delivery should not depend on dashboard recording while this endpoint is still optional. */
        });
    }

    function invokeFluxzeroDeepLink(url) {
        const frame = document.createElement('iframe');
        frame.hidden = true;
        frame.tabIndex = -1;
        frame.setAttribute('aria-hidden', 'true');
        frame.src = url;
        document.body.appendChild(frame);
        window.setTimeout(() => frame.remove(), 1500);
    }

    function syncPrimaryActionLabel() {
        if (!codexButton) return;

        const option = getSelectedAgentOption();
        const agentName = option?.dataset.agentName || '';
        const agentId = option?.dataset.agentId || '';
        const deliveryMode = getDeliveryMode();
        let label = 'Open project';

        if (isGeneratingProject) {
            label = 'Generating...';
        } else if (deliveryMode === 'zip') {
            label = 'Generate project';
        } else if (deliveryMode === 'launchpad' && agentId !== 'other' && agentName) {
            label = `Open in ${agentName}`;
        }

        const codexButtonLabel = codexButton.querySelector('[data-codex-button-label]');

        if (codexButtonLabel) {
            codexButtonLabel.textContent = label;
        } else {
            codexButton.textContent = label;
        }
    }

    function syncAgentPicker(closeDropdown = false) {
        const option = getSelectedAgentOption();
        if (!option) return;

        const name = option.dataset.agentName || 'Claude Code';
        const href = option.dataset.agentHref || '';
        const icon = option.querySelector('.agent-option__icon');

        saveStoredAgentCode(option.dataset.agentId || '');

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
        syncPrimaryActionLabel();
    }

    function getSelectedGeneratorValue(options, fallback) {
        const selected = options.find(option => option.classList.contains('is-active') || option.getAttribute('aria-pressed') === 'true');
        return selected?.value || fallback;
    }

    function setSelectedGeneratorValue(options, value) {
        options.forEach(option => {
            const isSelected = option.value === value;
            option.classList.toggle('is-active', isSelected);
            option.setAttribute('aria-pressed', String(isSelected));
        });
    }

    function getSelectedLanguage() {
        return getSelectedGeneratorValue(generatorLanguageOptions, 'java');
    }

    function getSelectedBuildTool() {
        return getSelectedGeneratorValue(generatorBuildToolOptions, FALLBACK_PROJECT_DEFAULTS.buildTool);
    }

    function selectedTemplateForLanguage(language) {
        const generator = getGeneratorCore();
        if (generator && typeof generator.templateForLanguage === 'function') {
            return generator.templateForLanguage(language);
        }

        return language === 'kotlin' ? 'flux-basic-kotlin' : FALLBACK_PROJECT_DEFAULTS.selectedTemplate;
    }

    function defaultBuildToolForTemplate(templateId) {
        const generator = getGeneratorCore();
        if (generator && typeof generator.defaultBuildToolForTemplate === 'function') {
            return generator.defaultBuildToolForTemplate(templateId);
        }

        return templateId === 'flux-basic-kotlin' ? 'gradle' : FALLBACK_PROJECT_DEFAULTS.buildTool;
    }

    function syncBuildToolForLanguage() {
        if (buildToolManuallyEdited) return;
        const templateId = selectedTemplateForLanguage(getSelectedLanguage());
        setSelectedGeneratorValue(generatorBuildToolOptions, defaultBuildToolForTemplate(templateId));
    }

    function setGeneratorFieldError(fieldName, message) {
        const error = document.querySelector(`[data-generator-error="${fieldName}"]`);
        const input = fieldName === 'groupId' ? generatorGroupField : generatorArtifactField;

        if (error) {
            error.textContent = message || '';
            error.classList.toggle('show', Boolean(message));
        }

        if (input) input.classList.toggle('has-error', Boolean(message));
    }

    function clearGeneratorValidation() {
        setGeneratorFieldError('groupId', '');
        setGeneratorFieldError('artifactId', '');
    }

    function updateArtifactFromProjectTitle() {
        if (!generatorArtifactField || artifactIdManuallyEdited) return;
        generatorArtifactField.value = fallbackArtifactId(projectTitleField.value.trim() || DEFAULT_PROJECT_TITLE);
    }

    function getBriefData() {
        return {
            projectTitle: projectTitleField.value.trim(),
            idea: ideaField.value.trim(),
            agent: getSelectedAgent()
        };
    }

    function renderPrompt() {
        const data = getBriefData();
        const promptText = buildPromptText(data);
        combinedPrompt.textContent = promptText;
        saveBuildReadyPrompt(promptText);

        saveStoredPrompt(data.idea);
        updateArtifactFromProjectTitle();
        syncProductStateClasses(!ideaField.readOnly);
        syncProductFieldHeight();
        if (copyMessage) copyMessage.textContent = '';
        clearGeneratorValidation();
    }

    [projectTitleField, ideaField].filter(Boolean).forEach(field => {
        field.addEventListener('input', renderPrompt);
        field.addEventListener('change', renderPrompt);
    });

    userEmailField.addEventListener('input', () => {
        userEmailField.classList.remove('has-error');
        setHandoffMessage('');
    });

    userEmailField.addEventListener('change', () => {
        userEmailField.classList.remove('has-error');
        setHandoffMessage('');
    });

    agentOptions.forEach(option => {
        const input = option.querySelector('input');
        if (!input) return;
        input.addEventListener('change', () => {
            syncAgentPicker(true);
            renderPrompt();
        });
    });

    generatorLanguageOptions.forEach(option => {
        option.addEventListener('click', () => {
            setSelectedGeneratorValue(generatorLanguageOptions, option.value);
            syncBuildToolForLanguage();
            clearGeneratorValidation();
            setHandoffMessage('');
        });
    });

    generatorBuildToolOptions.forEach(option => {
        option.addEventListener('click', () => {
            buildToolManuallyEdited = true;
            setSelectedGeneratorValue(generatorBuildToolOptions, option.value);
            clearGeneratorValidation();
            setHandoffMessage('');
        });
    });

    if (generatorGroupField) {
        generatorGroupField.addEventListener('input', () => {
            clearGeneratorValidation();
            setHandoffMessage('');
        });
    }

    if (generatorArtifactField) {
        generatorArtifactField.addEventListener('input', () => {
            artifactIdManuallyEdited = true;
            clearGeneratorValidation();
            setHandoffMessage('');
        });
    }

    if (agentDropdown) {
        document.addEventListener('pointerdown', (event) => {
            const target = event.target;
            if (!agentDropdown.open || !(target instanceof Node) || agentDropdown.contains(target)) return;
            agentDropdown.open = false;
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || !agentDropdown.open) return;
            agentDropdown.open = false;
        });
    }

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
            setProductEditing(ideaField.readOnly, true);
            renderPrompt();
        });
    }

    function setHandoffMessage(message, tone = 'neutral', options = {}) {
        if (!handoffMessage) return;
        window.clearTimeout(handoffMessageTimer);
        handoffMessageTimer = 0;

        const autoDismissMs = Number(options.autoDismissMs || 0);
        handoffMessage.textContent = message || '';
        handoffMessage.classList.toggle('show', Boolean(message));
        handoffMessage.classList.toggle('is-error', Boolean(message) && tone === 'error');
        handoffMessage.classList.toggle('is-success', Boolean(message) && tone === 'success');
        handoffMessage.classList.toggle('is-busy', Boolean(message) && tone === 'busy');
        handoffMessage.classList.toggle('is-transient', Boolean(message) && autoDismissMs > 0);

        if (message && autoDismissMs > 0) {
            handoffMessageTimer = window.setTimeout(() => {
                if (handoffMessage.textContent === message) {
                    setHandoffMessage('');
                }
            }, autoDismissMs);
        }
    }

    function setProjectGenerationLoading(isLoading) {
        isGeneratingProject = isLoading;
        if (codexButton) codexButton.disabled = isLoading;
        syncPrimaryActionLabel();
    }

    function ensureProjectTitle() {
        if (projectTitleField.value.trim()) return true;
        setHandoffMessage('Add a project title before continuing.', 'error');
        projectTitleField.focus();
        return false;
    }

    function ensureUserEmail() {
        const value = userEmailField.value.trim();
        if (value && userEmailField.validity.valid) {
            userEmailField.classList.remove('has-error');
            return true;
        }

        userEmailField.classList.add('has-error');
        setHandoffMessage(value ? 'Use a valid email before continuing.' : 'Add your email before continuing.', 'error');
        userEmailField.focus();
        return false;
    }

    function getDeliveryMode() {
        return document.body.dataset.projectDelivery || (detectClientPlatform() === 'macos' ? 'launchpad' : 'zip');
    }

    function fallbackArtifactId(projectName) {
        const generator = window.FluxzeroProjectGenerator;
        if (generator && typeof generator.convertToArtifactId === 'function') {
            return generator.convertToArtifactId(projectName) || 'fluxzero-project';
        }

        return projectName
            .toLowerCase()
            .replace(/[^a-z0-9\s\-_]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '') || 'fluxzero-project';
    }

    function createFallbackProjectData() {
        const projectName = projectTitleField.value.trim();
        const language = getSelectedLanguage();
        const selectedTemplate = selectedTemplateForLanguage(language);

        return {
            projectName,
            groupId: generatorGroupField?.value.trim() || FALLBACK_PROJECT_DEFAULTS.groupId,
            artifactId: generatorArtifactField?.value.trim() || fallbackArtifactId(projectName),
            selectedTemplate,
            buildTool: getSelectedBuildTool() || defaultBuildToolForTemplate(selectedTemplate)
        };
    }

    async function downloadFallbackProject(promptText) {
        const generator = window.FluxzeroProjectGenerator;
        if (!generator || typeof generator.downloadProject !== 'function') {
            setHandoffMessage('Project generator is still loading. Try again in a moment.', 'error');
            return;
        }

        const projectData = createFallbackProjectData();
        const missingArtifact = !projectData.artifactId;
        const errors = typeof generator.validateAll === 'function' ? generator.validateAll(projectData) : {};
        if (missingArtifact) errors.artifactId = 'Artifact ID is required';
        const hasErrors = typeof generator.hasValidationErrors === 'function'
            ? generator.hasValidationErrors(errors)
            : Object.values(errors).some(Boolean);

        setGeneratorFieldError('groupId', errors.groupId);
        setGeneratorFieldError('artifactId', errors.artifactId);

        if (hasErrors) {
            const message = typeof generator.firstValidationError === 'function'
                ? generator.firstValidationError(errors)
                : 'Check the project title before continuing.';
            setHandoffMessage(message || 'Check the project title before continuing.', 'error');
            if (generatorAdvanced) generatorAdvanced.open = true;
            return;
        }

        setProjectGenerationLoading(true);
        setHandoffMessage('Generating project zip...', 'busy');
        recordGeneratedProject(promptText, projectData);
        try {
            await generator.downloadProject(projectData);
            setHandoffMessage('Project zip downloaded.', 'success', { autoDismissMs: 3200 });
        } catch (error) {
            setHandoffMessage('Project zip could not be generated. Please try again.', 'error');
        } finally {
            setProjectGenerationLoading(false);
        }
    }

    async function openProject() {
        if (!ensureProjectTitle()) return;
        if (!ensureUserEmail()) return;

        const promptText = combinedPrompt.textContent || '';
        saveBuildReadyPrompt(promptText);

        if (getDeliveryMode() === 'zip') {
            await downloadFallbackProject(promptText);
            return;
        }

        recordGeneratedProject(promptText);

        try {
            navigator.clipboard?.writeText(promptText).catch(() => {});
        } catch (error) {
            /* The deep link remains the primary handoff. */
        }

        setHandoffMessage('Opening Fluxzero Launchpad...', 'success', { autoDismissMs: 3200 });
        invokeFluxzeroDeepLink(buildFluxzeroNewProjectUrl(promptText));
    }

    if (codexButton) {
        codexButton.addEventListener('click', async () => {
            await openProject();
        });
    }

    restoreStoredAgentCode();
    syncAgentPicker(false);
    setProductEditing(!initialPrompt);
    updateArtifactFromProjectTitle();
    syncBuildToolForLanguage();
    syncInstallerAvailability();
    renderPrompt();
}

initStartBuildingPage();

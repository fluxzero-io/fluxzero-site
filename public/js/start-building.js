const BUILD_PROMPT_STORAGE_KEY = 'fluxzeroBuildPrompt';
const BUILD_READY_PROMPT_STORAGE_KEY = 'fluxzeroBuildReadyPrompt';
const CODEX_HANDOFF_STORAGE_KEY = 'fluxzeroCodexHandoff';
const FLUXZERO_SESSION_READY_KEY = 'fluxzeroSessionReady';
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
        linux: 'other',
        other: 'other',
        zip: 'other',
        'non-mac': 'other',
        'non-macos': 'other'
    };

    return aliases[value] || '';
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

function buildPromptText({ projectTitle, idea, agent }) {
    const normalizedTitle = projectTitle || DEFAULT_PROJECT_TITLE;
    const normalizedIdea = idea || DEFAULT_PRODUCT_IDEA;
    const normalizedAgent = agent || 'Claude Code';

    return `Project title:
${normalizedTitle}

Description:
${normalizedIdea}

Build context:
AI tool:
${normalizedAgent}

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
    const projectTitleField = document.querySelector('[data-project-title]');
    const ideaField = document.querySelector('[data-brief-idea]');
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
    const handoff = document.querySelector('[data-start-handoff]');
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

    if (!projectTitleField || !ideaField || !combinedPrompt) return;

    const initialProjectTitle = readProjectTitleFromUrl().trim();
    const initialPrompt = readPromptFromUrl().trim();
    if (initialProjectTitle) projectTitleField.value = initialProjectTitle;
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

    function setHandoffMessage(message) {
        if (!handoffMessage) return;
        handoffMessage.textContent = message || '';
        handoffMessage.classList.toggle('show', Boolean(message));
    }

    function setHandoffReady(isReady) {
        if (handoff) handoff.classList.toggle('is-login-ready', isReady);
        syncPrimaryActionLabel();
        setHandoffMessage('');
    }

    function setProjectGenerationLoading(isLoading) {
        isGeneratingProject = isLoading;
        if (codexButton) codexButton.disabled = isLoading;
        syncPrimaryActionLabel();
    }

    function ensureProjectTitle() {
        if (projectTitleField.value.trim()) return true;
        setHandoffMessage('Add a project title before continuing.');
        projectTitleField.focus();
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

    async function downloadFallbackProject() {
        const generator = window.FluxzeroProjectGenerator;
        if (!generator || typeof generator.downloadProject !== 'function') {
            setHandoffMessage('Project generator is still loading. Try again in a moment.');
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
            setHandoffMessage(message || 'Check the project title before continuing.');
            if (generatorAdvanced) generatorAdvanced.open = true;
            return;
        }

        setProjectGenerationLoading(true);
        setHandoffMessage('Generating project zip...');
        try {
            await generator.downloadProject(projectData);
            setHandoffMessage('Project zip downloaded.');
        } catch (error) {
            setHandoffMessage('Project zip could not be generated. Please try again.');
        } finally {
            setProjectGenerationLoading(false);
        }
    }

    async function openProject() {
        if (!ensureProjectTitle()) return;

        if (getDeliveryMode() === 'zip') {
            await downloadFallbackProject();
            return;
        }

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
            if (getDeliveryMode() === 'launchpad' && !hasFluxzeroSession()) {
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
    setProductEditing(!initialPrompt);
    updateArtifactFromProjectTitle();
    syncBuildToolForLanguage();
    syncInstallerAvailability();
    renderPrompt();
    setHandoffReady(hasFluxzeroSession());
}

initStartBuildingPage();

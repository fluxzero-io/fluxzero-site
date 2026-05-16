(function () {
    const selectedClasses = ['border-primary-500', 'bg-primary-50', 'dark:bg-primary-900/20'];
    const idleClasses = ['border-gray-200', 'dark:border-gray-700'];
    const selectedDotClasses = ['border-primary-500', 'bg-primary-500'];
    const idleDotClasses = ['border-gray-400'];
    const invalidClasses = ['border-red-500', 'focus:ring-red-500', 'focus:border-red-500'];
    const validClasses = ['border-gray-300', 'dark:border-gray-600', 'focus:ring-primary-500', 'focus:border-primary-500'];
    const successIconPath = 'M5 13l4 4L19 7';
    const errorIconPath = 'M6 18L18 6M6 6l12 12';

    function getCore() {
        return window.FluxzeroProjectGenerator;
    }

    function scoped(root, selector) {
        return root.querySelector(selector);
    }

    function scopedAll(root, selector) {
        return Array.from(root.querySelectorAll(selector));
    }

    function toggleClasses(element, classes, force) {
        classes.forEach(className => element.classList.toggle(className, force));
    }

    function setFieldError(root, fieldName, message) {
        const input = scoped(root, `[data-project-field="${fieldName}"]`);
        const error = scoped(root, `[data-project-error="${fieldName}"]`);

        if (error) {
            error.textContent = message || '';
            error.hidden = !message;
        }

        if (input) {
            toggleClasses(input, invalidClasses, Boolean(message));
            toggleClasses(input, validClasses, !message);
        }
    }

    function showMessage(root, message, type = 'error') {
        const box = scoped(root, '[data-project-message]');
        const text = scoped(root, '[data-project-message-text]');
        const icon = scoped(root, '[data-project-message-icon]');
        if (!box || !text) return;

        text.textContent = message || '';
        box.hidden = !message;
        box.classList.toggle('text-red-600', type === 'error');
        box.classList.toggle('dark:text-red-400', type === 'error');
        box.classList.toggle('text-green-600', type === 'success');
        box.classList.toggle('dark:text-green-400', type === 'success');

        if (icon) {
            icon.setAttribute('d', type === 'success' ? successIconPath : errorIconPath);
        }
    }

    function setLoading(root, isLoading) {
        const button = scoped(root, '[data-project-submit]');
        const icon = scoped(root, '[data-project-submit-icon]');
        const text = scoped(root, '[data-project-submit-text]');
        if (!button || !icon || !text) return;

        root.dataset.loading = String(isLoading);
        button.disabled = isLoading;
        icon.textContent = isLoading ? '↻' : '↓';
        text.textContent = isLoading ? 'Generating...' : 'Generate';
    }

    function setSuccess(root) {
        const icon = scoped(root, '[data-project-submit-icon]');
        const text = scoped(root, '[data-project-submit-text]');

        if (icon) icon.textContent = '✓';
        if (text) text.textContent = 'Downloaded!';

        window.setTimeout(() => setLoading(root, false), 2000);
    }

    function getSelectedTemplate(root) {
        const option = scoped(root, '[data-project-template-option]:checked');
        return option ? option.value : 'flux-basic-java';
    }

    function getBuildTool(root) {
        const option = scoped(root, '[data-project-build-tool]:checked');
        return option ? option.value : 'maven';
    }

    function setBuildTool(root, value) {
        scopedAll(root, '[data-project-build-tool]').forEach(option => {
            option.checked = option.value === value;
        });
    }

    function updateTemplateCards(root) {
        const selectedTemplate = getSelectedTemplate(root);

        scopedAll(root, '[data-project-template-card]').forEach(card => {
            const isSelected = card.dataset.templateId === selectedTemplate;
            const inner = scoped(card, '[data-project-template-inner]');
            const dot = scoped(card, '[data-project-template-dot]');

            if (inner) {
                toggleClasses(inner, selectedClasses, isSelected);
                toggleClasses(inner, idleClasses, !isSelected);
            }

            if (dot) {
                toggleClasses(dot, selectedDotClasses, isSelected);
                toggleClasses(dot, idleDotClasses, !isSelected);
            }
        });
    }

    function updateBuildToolForTemplate(root) {
        const core = getCore();
        if (!core) return;

        const selectedTemplate = getSelectedTemplate(root);
        setBuildTool(root, core.defaultBuildToolForTemplate(selectedTemplate));
    }

    function getGeneratorData(root) {
        return {
            projectName: scoped(root, '[data-project-field="projectName"]')?.value.trim() || '',
            groupId: scoped(root, '[data-project-field="groupId"]')?.value.trim() || '',
            artifactId: scoped(root, '[data-project-field="artifactId"]')?.value.trim() || '',
            selectedTemplate: getSelectedTemplate(root),
            buildTool: getBuildTool(root)
        };
    }

    function showValidation(root, errors) {
        setFieldError(root, 'projectName', errors.projectName);
        setFieldError(root, 'groupId', errors.groupId);
        setFieldError(root, 'artifactId', errors.artifactId);
    }

    function validate(root) {
        const core = getCore();
        if (!core) return false;

        const errors = core.validateAll(getGeneratorData(root));
        showValidation(root, errors);
        return !core.hasValidationErrors(errors);
    }

    function clearMessage(root) {
        showMessage(root, '', 'error');
    }

    function initGenerator(root) {
        const core = getCore();
        if (!core || root.dataset.initialized === 'true') return false;

        root.dataset.initialized = 'true';
        let artifactIdManuallyEdited = false;

        const form = scoped(root, '[data-project-form]');
        const projectName = scoped(root, '[data-project-field="projectName"]');
        const groupId = scoped(root, '[data-project-field="groupId"]');
        const artifactId = scoped(root, '[data-project-field="artifactId"]');

        if (!form || !projectName || !groupId || !artifactId) return true;

        projectName.addEventListener('input', () => {
            if (!artifactIdManuallyEdited) {
                artifactId.value = core.convertToArtifactId(projectName.value);
            }
            validate(root);
            clearMessage(root);
        });

        groupId.addEventListener('input', () => {
            validate(root);
            clearMessage(root);
        });

        artifactId.addEventListener('input', () => {
            artifactIdManuallyEdited = true;
            validate(root);
            clearMessage(root);
        });

        scopedAll(root, '[data-project-template-option]').forEach(option => {
            option.addEventListener('change', () => {
                updateTemplateCards(root);
                updateBuildToolForTemplate(root);
                clearMessage(root);
            });
        });

        form.addEventListener('submit', async event => {
            event.preventDefault();

            const data = getGeneratorData(root);
            const missingName = !data.projectName;
            const missingArtifact = !data.artifactId;

            setFieldError(root, 'projectName', missingName ? 'Project name is required' : null);
            setFieldError(root, 'artifactId', missingArtifact ? 'Artifact ID is required' : null);

            if (missingName || missingArtifact || !data.selectedTemplate) {
                showMessage(root, 'Please fill in all required fields', 'error');
                return;
            }

            const errors = core.validateAll(data);
            showValidation(root, errors);

            if (core.hasValidationErrors(errors)) {
                showMessage(root, core.firstValidationError(errors), 'error');
                return;
            }

            setLoading(root, true);
            clearMessage(root);

            try {
                await core.downloadProject(data);
                showMessage(root, 'Project downloaded successfully!', 'success');
                setSuccess(root);
            } catch (error) {
                setLoading(root, false);
                showMessage(root, 'Failed to generate project. Please try again some time later.', 'error');
                console.error('Project generation error:', error);
            }
        });

        updateTemplateCards(root);
        updateBuildToolForTemplate(root);
        validate(root);
        return true;
    }

    function initAllGenerators() {
        const roots = scopedAll(document, '[data-project-generator]');
        const pending = roots.filter(root => !initGenerator(root));

        if (pending.length) {
            window.setTimeout(initAllGenerators, 50);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllGenerators);
    } else {
        initAllGenerators();
    }
})();

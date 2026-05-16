(function () {
    const templates = {
        'flux-basic-java': {
            name: 'Java Starter',
            description: 'A minimal Fluxzero setup for Java projects.',
            language: 'java',
            defaultBuildTool: 'maven'
        },
        'flux-basic-kotlin': {
            name: 'Kotlin Starter',
            description: 'A minimal Fluxzero setup for Kotlin projects.',
            language: 'kotlin',
            defaultBuildTool: 'gradle'
        },
        gamerental: {
            name: 'GameStore Demo',
            description: 'A complete demo application for game rentals.',
            language: 'java',
            defaultBuildTool: 'maven'
        }
    };

    function validateProjectName(projectName) {
        if (!projectName) return null;
        if (projectName.length > 50) return 'Project name must be 50 characters or less';
        if (!/^[a-zA-Z0-9_\- ]+$/.test(projectName)) {
            return 'Project name can only contain letters, numbers, spaces, hyphens, and underscores';
        }
        return null;
    }

    function validateGroupId(groupId) {
        if (!groupId) return null;
        if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(groupId)) {
            return 'Group ID must follow Maven standards (e.g., com.example or org.mycompany)';
        }
        const segments = groupId.split('.');
        for (const segment of segments) {
            if (segment.startsWith('-') || segment.endsWith('-') || segment === '') {
                return 'Group ID segments cannot start/end with hyphens or be empty';
            }
        }
        return null;
    }

    function validateArtifactId(artifactId) {
        if (!artifactId) return null;
        if (!/^[a-z0-9-]+$/.test(artifactId)) {
            return 'Artifact ID can only contain lowercase letters, numbers, and hyphens';
        }
        if (artifactId.startsWith('-') || artifactId.endsWith('-')) {
            return 'Artifact ID cannot start or end with hyphens';
        }
        return null;
    }

    function validateAll(data) {
        return {
            projectName: validateProjectName(data.projectName),
            groupId: validateGroupId(data.groupId),
            artifactId: validateArtifactId(data.artifactId)
        };
    }

    function hasValidationErrors(errors) {
        return Object.values(errors).some(error => error !== null && error !== undefined);
    }

    function firstValidationError(errors) {
        return Object.values(errors).find(error => error !== null && error !== undefined) || null;
    }

    function convertToArtifactId(projectName) {
        return projectName
            .toLowerCase()
            .replace(/[^a-z0-9\s\-_]/g, '')
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function templateForLanguage(language) {
        return language === 'kotlin' ? 'flux-basic-kotlin' : 'flux-basic-java';
    }

    function defaultBuildToolForTemplate(templateId) {
        return templates[templateId]?.defaultBuildTool || 'maven';
    }

    function createPayload(data) {
        const template = templates[data.selectedTemplate];
        return {
            template: data.selectedTemplate,
            name: data.projectName,
            packageName: `${data.groupId}.${data.artifactId.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            groupId: data.groupId,
            artifactId: data.artifactId,
            buildSystem: data.buildTool,
            description: template?.description || 'A Fluxzero project'
        };
    }

    async function downloadProject(data) {
        const response = await fetch('https://fluxzero-cli-api.fly.dev/api/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(createPayload(data))
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${data.projectName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
    }

    window.FluxzeroProjectGenerator = {
        templates,
        validateProjectName,
        validateGroupId,
        validateArtifactId,
        validateAll,
        hasValidationErrors,
        firstValidationError,
        convertToArtifactId,
        templateForLanguage,
        defaultBuildToolForTemplate,
        createPayload,
        downloadProject
    };
})();

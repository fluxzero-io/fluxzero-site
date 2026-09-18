export {};

const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");
const submitButton = document.getElementById("submitButton");

if (form instanceof HTMLFormElement && status && submitButton instanceof HTMLButtonElement) {
    const buttonLabel = submitButton.querySelector('[data-button-label]') || submitButton;
    const originalButtonText = buttonLabel.textContent || "Send";
    const preview = document.getElementById("previewConfirmation");

    const restoreButton = () => {
        submitButton.disabled = false;
        buttonLabel.textContent = originalButtonText;
        delete submitButton.dataset.state;
        if (preview instanceof HTMLButtonElement) preview.disabled = false;
    };

    const showSuccess = async () => {
        status.textContent = status.dataset.successMessage || "Thanks, your message was sent.";
        status.dataset.state = "success";
        if (submitButton.dataset.confirmation === "true") {
            buttonLabel.textContent = status.textContent;
            submitButton.dataset.state = "success";
            await new Promise(resolve => window.setTimeout(resolve, 2800));
        }
    };

    preview?.addEventListener("click", async () => {
        if (submitButton.disabled) return;
        submitButton.disabled = true;
        if (preview instanceof HTMLButtonElement) preview.disabled = true;
        status.textContent = "";
        await showSuccess();
        restoreButton();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submitButton.disabled) return;

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        submitButton.disabled = true;
        buttonLabel.textContent = "Sending...";
        if (preview instanceof HTMLButtonElement) preview.disabled = true;
        status.textContent = "";
        delete status.dataset.state;

        try {
            const response = await fetch(form.action, {
                method: "POST",
                body: new FormData(form),
            });

            if (response.ok) {
                form.reset();
                await showSuccess();
            } else {
                status.textContent = "Something went wrong. Please try again.";
                status.dataset.state = "error";
            }
        } catch {
            status.textContent = "Network error. Please try again later.";
            status.dataset.state = "error";
        } finally {
            restoreButton();
        }
    });
}

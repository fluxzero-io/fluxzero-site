export {};

const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");
const submitButton = document.getElementById("submitButton");

if (form instanceof HTMLFormElement && status && submitButton instanceof HTMLButtonElement) {
    const originalButtonText = submitButton.textContent || "Send";

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
        status.textContent = "";
        delete status.dataset.state;

        try {
            const response = await fetch(form.action, {
                method: "POST",
                body: new FormData(form),
            });

            if (response.ok) {
                status.textContent = "Thanks, your message was sent.";
                status.dataset.state = "success";
                form.reset();
            } else {
                status.textContent = "Something went wrong. Please try again.";
                status.dataset.state = "error";
            }
        } catch {
            status.textContent = "Network error. Please try again later.";
            status.dataset.state = "error";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
}

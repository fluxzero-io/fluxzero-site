const sky = document.querySelector<HTMLElement>('.about-stars');

if (sky) {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const stars = Array.from(sky.querySelectorAll<SVGCircleElement>('circle'))
        .filter(star => Number(star.getAttribute('r')) < 2)
        .map(element => ({
            element,
            brightness: Number(element.getAttribute('opacity') ?? 1),
            strength: 0.12 + Math.random() * 0.14,
            fastTime: 45 + Math.random() * 55,
            slowTime: 400 + Math.random() * 700,
            fast: 0,
            slow: 0,
            wait: Math.random() * 4000,
            duration: 1800 + Math.random() * 1600,
            progress: 0,
        }));

    // Correlated noise gives each star a continuous, non-repeating light curve.
    // These correlation times are a screen interpretation, not a physical simulation.
    function fluctuate(value: number, elapsed: number, time: number) {
        const memory = Math.exp(-elapsed / time);
        const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 2;
        return memory * value + Math.sqrt(1 - memory * memory) * noise;
    }

    let frame = 0;
    let previousTime: number | null = null;
    let inView = false;
    const meteor = sky.querySelector<HTMLElement>('.about-meteor');
    let meteorAnimation: Animation | undefined;
    let meteorWait = 6000 + Math.random() * 9000;

    function nextMeteorWait() {
        // Irregular gaps averaging 36.25 seconds, with at least five seconds of rest.
        return 5000 - Math.log1p(-Math.random()) * 31250;
    }

    function shootMeteor() {
        if (!meteor || !sky) return;
        const distance = Math.min(280, sky.clientWidth * 0.45);
        const direction = Math.random() < 0.5 ? -1 : 1;
        const slope = 18 + Math.random() * 16;
        const angle = direction > 0 ? slope : 180 - slope;
        const drop = distance * Math.tan(slope * Math.PI / 180);
        const tail = 65 + Math.random() * 35;
        meteor.style.width = `${tail}px`;
        const start = 32 + Math.random() * Math.max(0, sky.clientWidth - distance - tail - 64);
        meteor.style.left = `${start + (direction < 0 ? distance : 0)}px`;
        meteor.style.top = `${90 + Math.random() * 45}px`;
        meteorAnimation = meteor.animate(
            [0, 0.12, 0.7, 1].map((offset, index) => ({
                offset,
                transform: `translate(${direction * distance * offset}px, ${drop * offset}px) rotate(${angle}deg)`,
                opacity: [0, 0.7, 0.45, 0][index],
            })),
            { duration: 250 + Math.random() * 200, easing: 'linear' },
        );
    }

    function render(now: number) {
        const actualElapsed = previousTime === null ? 0 : now - previousTime;
        const elapsed = Math.min(actualElapsed, 64);
        previousTime = now;
        // Only smooth the twinkle simulation; the meteor clock follows real viewing time.
        meteorWait -= actualElapsed;
        if (meteorWait <= 0) {
            shootMeteor();
            meteorWait = nextMeteorWait();
        }
        for (const star of stars) {
            star.wait -= elapsed;
            if (star.wait > 0) continue;

            star.progress += elapsed;
            if (star.progress >= star.duration) {
                star.element.style.removeProperty('opacity');
                star.wait = 3000 + Math.random() * 3000;
                star.duration = 1800 + Math.random() * 1600;
                star.progress = star.fast = star.slow = 0;
                continue;
            }

            star.fast = fluctuate(star.fast, elapsed, star.fastTime);
            star.slow = fluctuate(star.slow, elapsed, star.slowTime);
            // Brief soft edges retain visible shimmer between independent rests.
            const edge = Math.min(1, star.progress / 220, (star.duration - star.progress) / 220);
            const envelope = edge * edge * (3 - 2 * edge);
            const variation = envelope * star.strength * (0.85 * star.fast + 0.15 * star.slow);
            // Keep a steady baseline with occasional glints and no on/off blinking.
            const brightness = star.brightness * Math.exp(variation);
            star.element.style.opacity = Math.min(1, Math.max(star.brightness * 0.55, brightness)).toFixed(3);
        }
        frame = requestAnimationFrame(render);
    }

    function update() {
        cancelAnimationFrame(frame);
        previousTime = null;
        if (reducedMotion.matches || document.hidden || !inView) {
            meteorAnimation?.cancel();
            for (const star of stars) {
                star.element.style.removeProperty('opacity');
                star.fast = star.slow = 0;
                star.progress = 0;
                star.wait = Math.random() * 4000;
            }
            return;
        }
        frame = requestAnimationFrame(render);
    }

    const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        update();
    });
    observer.observe(sky);
    reducedMotion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', () => {
        cancelAnimationFrame(frame);
        meteorAnimation?.cancel();
    });
    window.addEventListener('pageshow', update);
}

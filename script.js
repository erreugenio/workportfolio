// ── Dark mode: apply before paint to avoid flash ──────────────
(function() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
})();

document.addEventListener('DOMContentLoaded', () => {

    // ── Theme toggle ───────────────────────────────────────────
    const toggleBtn  = document.getElementById('themeToggle');
    const themeIcon  = document.getElementById('themeIcon');
    const html       = document.documentElement;

    function applyTheme(theme) {
        html.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
        }
    }

    // Set correct icon on load
    applyTheme(html.getAttribute('data-theme') || 'light');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const current = html.getAttribute('data-theme');
            applyTheme(current === 'dark' ? 'light' : 'dark');
        });
    }

    // ── Mobile Nav Toggle ──────────────────────────────────────
    const hamburger = document.querySelector('.hamburger');
    const navLinks  = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = hamburger.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.replace('ph-list', 'ph-x');
            } else {
                icon.classList.replace('ph-x', 'ph-list');
            }
        });

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                const icon = hamburger.querySelector('i');
                if (icon) icon.classList.replace('ph-x', 'ph-list');
            });
        });
    }

    // ── Copyright year ─────────────────────────────────────────
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ── Scroll reveal (fade-up / fade-left / fade-right / scale-in) ──────
    // Threshold 0.1 — fires earlier for text/card elements
    const fadeEls = document.querySelectorAll('.fade-up, .fade-left, .fade-right, .scale-in');

    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

        fadeEls.forEach(el => io.observe(el));
    } else {
        fadeEls.forEach(el => el.classList.add('in-view'));
    }

    // ── Image reveal-mask observer (threshold 0.25) ──────────────────────
    // .img-reveal elements get the in-view class only when 25% visible,
    // triggering the clip-path bottom→top wipe transition defined in CSS.
    const imgRevealEls = document.querySelectorAll('.img-reveal');

    if ('IntersectionObserver' in window && imgRevealEls.length) {
        const imgIo = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    imgIo.unobserve(entry.target);
                }
            });
        }, { threshold: 0.25 });

        imgRevealEls.forEach(el => imgIo.observe(el));
    }

    // ── Navbar shadow on scroll ────────────────────────────────────────
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.style.boxShadow = window.scrollY > 20
                ? '0 2px 20px rgba(30,17,40,0.08)'
                : 'none';
        }, { passive: true });
    }
});

// ── Lightbox ───────────────────────────────────────────────────
window.openLightbox = function(src) {
    const lb  = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (!lb || !img) return;
    img.src = src;
    lb.style.display = 'flex';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => lb.classList.add('show'));
    });
    document.body.style.overflow = 'hidden';
};

window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.classList.remove('show');
    setTimeout(() => {
        lb.style.display = 'none';
        document.body.style.overflow = '';
    }, 320);
};

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') window.closeLightbox();
});

document.addEventListener('click', e => {
    const lb = document.getElementById('lightbox');
    if (e.target === lb) window.closeLightbox();
});

/* ═══════════════════════════════════════════════════════
   CAROUSEL — Spring physics engine
   stiffness : how fast it accelerates toward target
   damping   : how much velocity bleeds off each frame
   → 0.12 / 0.78 gives a light, weightless bounce
═══════════════════════════════════════════════════════ */
(function initCarousel() {

    // ── DOM refs ────────────────────────────────────────
    const wrapper  = document.getElementById('portfolioCarousel');
    const track    = document.getElementById('carouselTrack');
    const dotsEl   = document.getElementById('carouselDots');
    const btnPrev  = document.getElementById('carouselPrev');
    const btnNext  = document.getElementById('carouselNext');
    if (!wrapper || !track) return;

    // ── Spring constants ────────────────────────────────
    const STIFFNESS = 0.12;
    const DAMPING   = 0.78;
    const THRESHOLD = 0.25; // px — stop loop when delta is negligible

    // ── Carousel state ──────────────────────────────────
    let slides       = [];
    let slideWidth   = 0;
    let visibleCount = 3;
    let totalPages   = 1;
    let currentPage  = 0;

    // Spring animation
    let springPos    = 0;   // current rendered position (px, negative = left)
    let springVel    = 0;   // current velocity
    let springTarget = 0;   // where we want to land
    let rafId        = null;

    // Drag state
    let isDragging  = false;
    let dragStartX  = 0;
    let dragOrigin  = 0;   // springPos at drag start
    let lastX       = 0;
    let dragVel     = 0;   // running velocity estimate (px/ms)
    let lastTime    = 0;

    // ── Measure layout ──────────────────────────────────
    function measure() {
        slides = Array.from(track.querySelectorAll('.carousel-slide'));
        if (!slides.length) return;

        const ww = wrapper.clientWidth;
        // Padding left/right is on the wrapper; track itself is edge-to-edge inside
        // Read computed padding to find the usable width
        const style = getComputedStyle(wrapper);
        const pl = parseFloat(style.paddingLeft)  || 0;
        const pr = parseFloat(style.paddingRight) || 0;
        const usable = ww - pl - pr;

        const gap = 24; // px — must match CSS gap

        // Detect how many slides are visible at current breakpoint
        if (window.innerWidth <= 640)       visibleCount = 1;
        else if (window.innerWidth <= 960)  visibleCount = 2;
        else                                visibleCount = 3;

        slideWidth  = (usable + gap) / visibleCount;
        totalPages  = Math.max(1, slides.length - visibleCount + 1);
        currentPage = Math.min(currentPage, totalPages - 1);

        // Apply the measured width to each slide
        slides.forEach(s => {
            s.style.minWidth = (slideWidth - gap) + 'px';
        });

        // Instantly reposition without animation
        springTarget = springPos = -currentPage * slideWidth;
        track.style.transform = `translateX(${springPos}px)`;
        updateDots();
        updateButtons();
    }

    // ── Spring loop ─────────────────────────────────────
    function springLoop() {
        const delta    = springTarget - springPos;
        springVel      = (springVel + delta * STIFFNESS) * DAMPING;
        springPos     += springVel;

        track.style.transform = `translateX(${springPos}px)`;

        if (Math.abs(springVel) > THRESHOLD || Math.abs(delta) > THRESHOLD) {
            rafId = requestAnimationFrame(springLoop);
        } else {
            // Snap exactly to target
            springPos = springTarget;
            track.style.transform = `translateX(${springPos}px)`;
            rafId = null;
        }
    }

    function startSpring() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(springLoop);
    }

    // ── Navigate to a page ──────────────────────────────
    function goTo(page) {
        currentPage  = Math.max(0, Math.min(page, totalPages - 1));
        springTarget = -currentPage * slideWidth;
        startSpring();
        updateDots();
        updateButtons();
    }

    // ── Dot + button state ──────────────────────────────
    function buildDots() {
        dotsEl.innerHTML = '';
        for (let i = 0; i < totalPages; i++) {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
            dot.addEventListener('click', () => goTo(i));
            dotsEl.appendChild(dot);
        }
    }

    function updateDots() {
        const dots = dotsEl.querySelectorAll('.carousel-dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === currentPage));
    }

    function updateButtons() {
        if (btnPrev) btnPrev.disabled = currentPage === 0;
        if (btnNext) btnNext.disabled = currentPage >= totalPages - 1;
    }

    // ── Pointer drag (mouse + touch via Pointer Events) ──
    function onPointerDown(e) {
        // Ignore clicks on the overlay / lightbox triggers
        if (e.target.closest('.portfolio-visual')) return;
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        isDragging = true;
        dragStartX = e.clientX;
        dragOrigin = springPos;
        dragVel    = 0;
        lastX      = e.clientX;
        lastTime   = performance.now();

        track.classList.add('is-dragging');
        track.setPointerCapture(e.pointerId);

        // Stop ongoing spring so drag feels immediate
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function onPointerMove(e) {
        if (!isDragging) return;

        const now  = performance.now();
        const dt   = now - lastTime || 16;
        const dx   = e.clientX - lastX;

        // Running average velocity (px/ms)
        dragVel = dragVel * 0.7 + (dx / dt) * 0.3;
        lastX   = e.clientX;
        lastTime = now;

        // Move track live — no spring during drag
        springPos = dragOrigin + (e.clientX - dragStartX);
        track.style.transform = `translateX(${springPos}px)`;
    }

    function onPointerUp(e) {
        if (!isDragging) return;
        isDragging = false;
        track.classList.remove('is-dragging');

        // Project where finger would coast to (inertia)
        const INERTIA_MULT = 6;  // frames to project forward at ~60fps
        const projected = springPos + dragVel * 16 * INERTIA_MULT;

        // Find the nearest page to that projected position
        const page = Math.round(-projected / slideWidth);
        goTo(page); // clamps internally
    }

    track.addEventListener('pointerdown',  onPointerDown, { passive: true });
    track.addEventListener('pointermove',  onPointerMove, { passive: true });
    track.addEventListener('pointerup',    onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);

    // Prevent native scroll drag from stealing the gesture
    track.addEventListener('dragstart', e => e.preventDefault());

    // ── Arrow buttons ───────────────────────────────────
    if (btnPrev) btnPrev.addEventListener('click', () => goTo(currentPage - 1));
    if (btnNext) btnNext.addEventListener('click', () => goTo(currentPage + 1));

    // ── Keyboard navigation ─────────────────────────────
    wrapper.setAttribute('tabindex', '0');
    wrapper.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft')  { goTo(currentPage - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { goTo(currentPage + 1); e.preventDefault(); }
    });

    // ── Staggered spring entrance via IntersectionObserver ──
    function triggerEntrance() {
        slides.forEach((slide, i) => {
            slide.style.setProperty('--stagger-delay', `${i * 80}ms`);
            // Re-trigger by removing then re-adding the class
            slide.classList.remove('spring-enter');
            void slide.offsetWidth; // reflow
            slide.classList.add('spring-enter');
        });
    }

    const entranceObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                triggerEntrance();
                entranceObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    entranceObserver.observe(wrapper);

    // ── Debounced resize ────────────────────────────────
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            measure();
            buildDots();
        }, 150);
    }, { passive: true });

    // ── Init ────────────────────────────────────────────
    // Wait for fonts/images to avoid measuring before layout settles
    if (document.readyState === 'complete') {
        measure(); buildDots();
    } else {
        window.addEventListener('load', () => { measure(); buildDots(); }, { once: true });
    }

})();

/* ═══════════════════════════════════════════════════════
   PARALLAX — Low-friction scroll-linked animations
   LERP_FACTOR 0.08 → scroll position smoothed over ~12 frames
   → creates a luxurious, dampened "heavy liquid" scroll feel
═══════════════════════════════════════════════════════ */
(function initParallax() {

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const LERP_FACTOR = 0.08;   // 0 = stationary, 1 = instant
    let lerpScrollY   = window.scrollY;
    let rawScrollY    = window.scrollY;
    let rafId         = null;

    // Cache parallax targets once
    const parallaxEls = Array.from(document.querySelectorAll('[data-parallax]'));
    const orbs        = Array.from(document.querySelectorAll('.orb'));
    const bgShapes    = Array.from(document.querySelectorAll('.bg-shape'));

    // Per-orb drift rates — subtle so they don't overpower the design
    const orbRates   = [0.04, 0.027, 0.055];
    const shapeRates = [0.03, 0.022, 0.038, 0.018, 0.012, 0.028];

    // Track raw scroll without lerp (for instant reads)
    window.addEventListener('scroll', () => {
        rawScrollY = window.scrollY;
    }, { passive: true });

    function lerp(current, target, factor) {
        return current + (target - current) * factor;
    }

    function tick() {
        // Smooth scroll position
        lerpScrollY = lerp(lerpScrollY, rawScrollY, LERP_FACTOR);

        const vh = window.innerHeight;

        // ── Section header parallax ──────────────────────────────────
        parallaxEls.forEach(el => {
            const rect = el.getBoundingClientRect();

            // Skip elements far outside the viewport to avoid wasted work
            if (rect.bottom < -vh * 0.5 || rect.top > vh * 1.5) return;

            const rate   = parseFloat(el.dataset.parallax) || 0.15;
            // Offset: negative when element is above viewport centre → moves up
            const centre = rect.top + rect.height * 0.5 - vh * 0.5;
            const offset = centre * rate * -0.5;  // gentle, half-speed

            // Compose with the reveal transform (scale/translate) via CSS var
            // We use a separate translateY so the in-view CSS transform still runs
            el.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);

            // Apply via a wrapping transform that doesn't fight the reveal animation
            // For elements already revealed, inject directly; for unrevealed, skip
            // (the clip or fade transform will handle hidden state)
            if (el.classList.contains('in-view')) {
                el.style.transform = `translateY(${offset.toFixed(2)}px)`;
            }
        });

        // ── Background orbs drift ───────────────────────────────────
        orbs.forEach((orb, i) => {
            const rate = orbRates[i] || 0.04;
            // Orbs move in the same direction as scroll (parallax layers)
            orb.style.transform = `translateY(${(lerpScrollY * rate).toFixed(2)}px)`;
        });

        // ── Background shapes drift (slightly) ──────────────────────
        bgShapes.forEach((shape, i) => {
            const rate = shapeRates[i] || 0.02;
            // Shapes already have a float animation; add scroll offset on top
            // We target translateY of the shape's existing animation
            // Use CSS custom property that the animation can incorporate
            shape.style.setProperty('--scroll-drift', `${(lerpScrollY * rate).toFixed(2)}px`);
        });

        rafId = requestAnimationFrame(tick);
    }

    // Start after page is loaded so initial scroll position is accurate
    window.addEventListener('load', () => {
        lerpScrollY = window.scrollY;
        rawScrollY  = window.scrollY;
        rafId = requestAnimationFrame(tick);
    }, { once: true });

    // Handle visibility changes (tab switching) — pause when hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        } else {
            lerpScrollY = rawScrollY; // reset lerp so no catch-up jump
            rafId = requestAnimationFrame(tick);
        }
    });

})();

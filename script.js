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

    // ── Services Tabs ──────────────────────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all tabs & panes
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            tabPanes.forEach(p => p.classList.remove('active'));

            // Add active to clicked target
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            
            const targetId = btn.getAttribute('data-target');
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
                
                // Immediately reveal items since they might have missed the initial intersection observer
                const animatedItems = targetPane.querySelectorAll('.scale-in, .fade-up, .fade-left, .fade-right');
                animatedItems.forEach(item => {
                    // Small delay ensures the display: block has kicked in
                    setTimeout(() => item.classList.add('in-view'), 10);
                });
            }
        });
    });

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

/* ═══════════════════════════════════════════════════════
   INFINITE PHYSICS SCROLLER
═══════════════════════════════════════════════════════ */
function initPhysicsScroller(wrapperId, trackId, onClickCallback) {
    const wrapper = document.getElementById(wrapperId);
    const track = document.getElementById(trackId);
    if (!wrapper || !track) return;

    // Duplicate content for infinite loop
    const cards = Array.from(track.children);
    if (!cards.length) return;

    // Clone sets for buffering
    cards.forEach(c => {
        const clone1 = c.cloneNode(true);
        // Copy text node overlays safely if there are any
        const clone2 = c.cloneNode(true);
        track.appendChild(clone1);
        track.insertBefore(clone2, track.firstChild);
    });

    const INERTIA_M = 0.96; // glide factor

    let springPos    = 0;
    let springVel    = 0;
    let isDragging   = false;
    let dragStartX   = 0;
    let dragOrigin   = 0;
    let dragVel      = 0;
    let lastX        = 0;
    let lastTime     = performance.now();
    let rafId        = null;

    let setWidth     = 0;

    function measure() {
        const gap = 32;
        // The width of the original set of cards
        const originalCards = Array.from(track.children).slice(cards.length, cards.length * 2);
        if(!originalCards[0]) return;
        // compute based on card offsetWidth + gap
        setWidth = cards.length * (originalCards[0].offsetWidth + gap);
        
        // Start in the middle set
        if (springPos === 0) springPos = -setWidth;
    }

    function springLoop() {
        if (!isDragging) {
            springVel *= INERTIA_M;
            springPos += springVel;

            // Infinite Wrap checking
            if (springPos <= -setWidth * 2) {
                springPos += setWidth;
            } else if (springPos >= 0) {
                springPos -= setWidth;
            }
        }

        track.style.transform = `translateX(${springPos}px)`;
        rafId = requestAnimationFrame(springLoop);
    }

    function onPointerDown(e) {
        if (e.target.closest('.reels-modal-close')) return;
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        isDragging = true;
        dragStartX = e.clientX;
        dragOrigin = springPos;
        dragVel    = 0;
        lastX      = e.clientX;
        lastTime   = performance.now();
        track.classList.add('is-dragging');
        track.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
        if (!isDragging) return;
        const now = performance.now();
        const dt  = Math.max(1, now - lastTime);
        const dx  = e.clientX - lastX;

        dragVel = dragVel * 0.5 + (dx / dt) * 0.5;
        lastX   = e.clientX;
        lastTime = now;

        springPos = dragOrigin + (e.clientX - dragStartX);
        
        // Instant wrap during drag
        if (springPos <= -setWidth * 2) {
            springPos += setWidth;
            dragOrigin += setWidth;
        } else if (springPos >= 0) {
            springPos -= setWidth;
            dragOrigin -= setWidth;
        }
    }

    function onPointerUp(e) {
        if (!isDragging) return;
        isDragging = false;
        track.classList.remove('is-dragging');
        springVel = dragVel * 20; // convert to frame velocity with pop
    }

    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerUp);
    track.addEventListener('dragstart', e => e.preventDefault());

    // Allow user to click to open modal without triggering drag
    track.addEventListener('click', e => {
        const card = e.target.closest('.reel-card');
        if (card && Math.abs(dragVel) < 0.5 && Math.abs(e.clientX - dragStartX) < 10) {
            if (onClickCallback) {
                onClickCallback(card);
            } else {
                openReelModal(card);
            }
        }
    });

    // Observer for initial entrance
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    observer.observe(wrapper);

    // Initial setup
    window.addEventListener('load', () => {
        measure();
        rafId = requestAnimationFrame(springLoop);
    });
    window.addEventListener('resize', measure);

    // Give some time for images to calculate layout
    setTimeout(() => {
        measure();
        rafId = requestAnimationFrame(springLoop);
    }, 100);
}

// Initialize for both sections
initPhysicsScroller('portfolioCarousel', 'portfolioTrack', (card) => {
    // Open the existing lightbox for full uncropped portfolio images
    const src = card.dataset.full || card.querySelector('.reel-img').src;
    openLightbox(src);
});
initPhysicsScroller('reelsCarousel', 'reelsTrack', (card) => {
    // Open the shared-element expansion specifically designed for 9:16 reels
    openReelModal(card);
});


/* ═══════════════════════════════════════════════════════
   REELS MODAL — Shared Element Expansion
═══════════════════════════════════════════════════════ */
window.openReelModal = function(sourceCard) {
    let modal = document.getElementById('reelsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'reelsModal';
        modal.innerHTML = `
            <div class="reels-modal-backdrop"></div>
            <div class="reels-modal-content" id="reelsModalContent">
                <img class="reels-modal-img" id="reelsModalImg" src="" alt="Reel Expanded">
                <button class="reels-modal-close" id="reelsModalClose"><i class="ph ph-x"></i></button>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('reelsModalClose').addEventListener('click', closeReelModal);
        modal.querySelector('.reels-modal-backdrop').addEventListener('click', closeReelModal);
    }

    const modalContent = document.getElementById('reelsModalContent');
    const modalImg = document.getElementById('reelsModalImg');
    
    // Set GIF src
    modalImg.src = sourceCard.dataset.full || sourceCard.querySelector('.reel-img').src;
    
    // Calculate rects for FLIP
    const startRect = sourceCard.getBoundingClientRect();
    
    // Show modal quickly to compute target
    modal.classList.add('active');
    
    // Reset any transition to measure target
    modalContent.style.transition = 'none';
    modalContent.style.transform = 'none';
    
    // Target sizing:
    // We want it to be aspect-ratio 9/16, max 85vh height
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let targetH = vh * 0.85;
    let targetW = targetH * (9/16);
    
    if (targetW > vw * 0.9) {
        targetW = vw * 0.9;
        targetH = targetW * (16/9);
    }
    
    const targetX = (vw - targetW) / 2;
    const targetY = (vh - targetH) / 2;
    
    // Explicit sizing for transition
    modalContent.style.width = targetW + 'px';
    modalContent.style.height = targetH + 'px';
    modalContent.style.left = targetX + 'px';
    modalContent.style.top = targetY + 'px';

    // Invert translation
    const scaleX = startRect.width / targetW;
    const scaleY = startRect.height / targetH;
    const transX = startRect.left - targetX;
    const transY = startRect.top - targetY;
    
    // Apply inversion
    modalContent.style.transformOrigin = '0 0';
    modalContent.style.transform = `translate(${transX}px, ${transY}px) scale(${scaleX}, ${scaleY})`;
    
    // Reflow
    void modalContent.offsetWidth;
    
    // Play transition
    modalContent.style.transition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
    modalContent.style.transform = 'translate(0, 0) scale(1, 1)';
    
    document.body.style.overflow = 'hidden';
};

window.closeReelModal = function() {
    const modal = document.getElementById('reelsModal');
    if (!modal) return;
    
    modal.classList.remove('active');
    
    const modalContent = document.getElementById('reelsModalContent');
    if (modalContent) {
        modalContent.style.transform = 'translate(0, 0) scale(0.85)';
    }

    setTimeout(() => {
        document.body.style.overflow = '';
    }, 400);
};

// Listen to escape key for Reel Modal
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (typeof closeLightbox === 'function') closeLightbox();
        if (typeof closeReelModal === 'function') closeReelModal();
        if (typeof closeCredModal === 'function') closeCredModal();
    }
});


/* ═══════════════════════════════════════════════════════
   PROFESSIONAL CREDENTIALS
═══════════════════════════════════════════════════════ */
(function initCredentials() {
    const credCards = document.querySelectorAll('.cred-card');
    
    credCards.forEach(card => {
        // 6DOF Parallax Title
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Limit tilt logic
            const rotateX = ((y - centerY) / centerY) * -8;
            const rotateY = ((x - centerX) / centerX) * 8;
            
            card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = `rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            // Wait for transition to finish then remove inline transition so CSS transition handles hover correctly
            setTimeout(() => {
                if(!card.matches(':hover')) card.style.transform = '';
            }, 400);
        });

        // Click to snap modal
        card.addEventListener('click', () => {
            openCredModal(card);
        });
    });
})();

window.openCredModal = function(sourceCard) {
    let modal = document.getElementById('credModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'credModal';
        modal.className = 'cred-modal';
        modal.innerHTML = `
            <div class="cred-backdrop" id="credBackdrop"></div>
            <div class="cred-modal-box" id="credModalBox">
                <img class="cred-modal-img" id="credModalImg" src="" alt="Credential">
                <div class="cred-modal-info">
                    <h3 id="credModalTitle"></h3>
                    <p id="credModalDesc"></p>
                </div>
                <button class="cred-close" id="credClose"><i class="ph ph-x"></i></button>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('credClose').addEventListener('click', closeCredModal);
        document.getElementById('credBackdrop').addEventListener('click', closeCredModal);
    }

    const modalBox = document.getElementById('credModalBox');
    const modalImg = document.getElementById('credModalImg');
    const modalTitle = document.getElementById('credModalTitle');
    const modalDesc = document.getElementById('credModalDesc');

    // Populate data
    const isHero = sourceCard.classList.contains('cred-hero');
    modalTitle.textContent = sourceCard.dataset.title || '';
    modalDesc.textContent = sourceCard.dataset.desc || '';
    
    // Hide image if it's the hero card without an img
    if (isHero) {
        modalImg.style.display = 'none';
    } else {
        const sourceImg = sourceCard.querySelector('img');
        if (sourceImg) {
            modalImg.src = sourceImg.src;
            modalImg.style.display = 'block';
        }
    }

    modal.classList.add('active');

    // Magnetic snap (Spring animation simulation using cubic-bezier)
    const rect = sourceCard.getBoundingClientRect();
    
    // Reset any transition to compute target width
    modalBox.style.transition = 'none';
    modalBox.style.transform = 'none';
    modalBox.style.width = isHero ? '500px' : '90vw';
    modalBox.style.maxWidth = isHero ? '500px' : '800px';

    // Remove explicit left/top so it naturally centers via flex container
    modalBox.style.left = '';
    modalBox.style.top = '';
    
    // Measure natural flex-centered position
    const targetRect = modalBox.getBoundingClientRect();
    
    // Calculate delta for inversion
    const scaleX = rect.width / targetRect.width;
    const scaleY = rect.height / targetRect.height;
    const transX = rect.left - targetRect.left;
    const transY = rect.top - targetRect.top;
    
    modalBox.style.transformOrigin = '0 0';
    modalBox.style.transform = `translate(${transX}px, ${transY}px) scale(${scaleX}, ${scaleY})`;
    modalBox.style.opacity = '0'; // Start invisible to mask the origin box difference if needed, or maybe visible
    
    // Actually keep it visible for seamless snapping
    modalBox.style.opacity = '1';
    
    void modalBox.offsetWidth; // Reflow

    // Low dampening spring transition
    modalBox.style.transition = 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
    modalBox.style.transform = 'translate(0, 0) scale(1, 1)';
    
    document.body.style.overflow = 'hidden';
};

window.closeCredModal = function() {
    const modal = document.getElementById('credModal');
    if (!modal) return;
    
    modal.classList.remove('active');
    
    const modalBox = document.getElementById('credModalBox');
    if (modalBox) {
        modalBox.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
        modalBox.style.transform = 'translate(0, 50px) scale(0.95)';
        modalBox.style.opacity = '0';
    }

    setTimeout(() => {
        document.body.style.overflow = '';
    }, 400);
};

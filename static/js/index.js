window.HELP_IMPROVE_VIDEOJS = false;

// Interactive Demo (time-synchronized slideshow)
function initInteractiveDemo() {
    const section = document.getElementById('demo');
    if (!section) return;

    const imgSat = document.getElementById('demo-img-sat');
    const imgGt = document.getElementById('demo-img-gt');
    const imgGen = document.getElementById('demo-img-gen');
    const btnPlay = document.getElementById('demo-btn-play');
    const btnPlayText = document.getElementById('demo-btn-play-text');
    const btnPrev = document.getElementById('demo-btn-prev');
    const btnNext = document.getElementById('demo-btn-next');
    const scrubber = document.getElementById('demo-scrubber');
    const speedSelect = document.getElementById('demo-speed');
    const loopToggle = document.getElementById('demo-loop');
    const timeLabel = document.getElementById('demo-time-label');
    const countLabel = document.getElementById('demo-count-label');
    const status = document.getElementById('demo-status');

    if (!imgSat || !imgGt || !imgGen || !btnPlay || !scrubber || !status) return;

    const manifestUrl = 'static/data/demo_frames.json';

    let frames = [];
    let fps = 2;
    let idx = 0;
    let isPlaying = false;
    let timerId = null;
    let wasPlayingBeforeScrub = false;

    const formatTimestampLabel = (t) => {
        if (!t) return '—';
        const s = String(t);
        const m = s.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
        if (!m) return s;
        const [, yyyy, mm, dd, HH, MM, SS] = m;
        return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
    };

    const setStatus = (msg) => {
        status.textContent = msg;
    };

    const clampIndex = (i) => {
        if (frames.length === 0) return 0;
        return Math.max(0, Math.min(frames.length - 1, i));
    };

    const preloadAround = (center, radius = 2) => {
        if (!frames.length) return;
        const start = Math.max(0, center - radius);
        const end = Math.min(frames.length - 1, center + radius);
        for (let i = start; i <= end; i++) {
            const f = frames[i];
            [f.sat, f.gt, f.gen].forEach((src) => {
                if (!src) return;
                const im = new Image();
                im.src = src;
            });
        }
    };

    const render = () => {
        if (!frames.length) {
            imgSat.removeAttribute('src');
            imgGt.removeAttribute('src');
            imgGen.removeAttribute('src');
            timeLabel.textContent = '—';
            countLabel.textContent = '0 / 0';
            scrubber.min = '0';
            scrubber.max = '0';
            scrubber.value = '0';
            btnPlay.disabled = true;
            if (btnPrev) btnPrev.disabled = true;
            if (btnNext) btnNext.disabled = true;
            setStatus('No demo frames found. Add frames to static/data/demo_frames.json.');
            return;
        }

        const f = frames[idx];
        imgSat.src = f.sat;
        imgGt.src = f.gt;
        imgGen.src = f.gen;
        imgSat.alt = `Satellite frame ${idx + 1}`;
        imgGt.alt = `Ground truth radar frame ${idx + 1}`;
        imgGen.alt = `Generated radar frame ${idx + 1}`;

        scrubber.min = '0';
        scrubber.max = String(frames.length - 1);
        scrubber.value = String(idx);

        timeLabel.textContent = f.t ? formatTimestampLabel(f.t) : `Frame ${idx + 1}`;
        countLabel.textContent = `${idx + 1} / ${frames.length}`;
        btnPlay.disabled = false;
        if (btnPrev) btnPrev.disabled = false;
        if (btnNext) btnNext.disabled = false;
        setStatus(isPlaying ? 'Playing…' : 'Ready');
        preloadAround(idx, 2);
    };

    const updatePlayButton = () => {
        const icon = btnPlay.querySelector('i');
        if (!icon) return;
        if (isPlaying) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
            btnPlayText.textContent = 'Pause';
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
            btnPlayText.textContent = 'Play';
        }
    };

    const stop = () => {
        isPlaying = false;
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
        updatePlayButton();
        render();
    };

    const nextFrame = () => {
        if (!frames.length) return;
        if (idx < frames.length - 1) {
            idx += 1;
            render();
            return;
        }
        if (loopToggle && loopToggle.checked) {
            idx = 0;
            render();
            return;
        }
        stop();
    };

    const play = () => {
        if (!frames.length) return;
        if (isPlaying) return;
        isPlaying = true;
        updatePlayButton();
        render();

        const getSpeed = () => {
            const v = speedSelect ? parseFloat(speedSelect.value) : 1;
            return Number.isFinite(v) && v > 0 ? v : 1;
        };

        const startTimer = () => {
            const speed = getSpeed();
            const intervalMs = Math.max(10, Math.round(1000 / (fps * speed)));
            if (timerId) clearInterval(timerId);
            timerId = setInterval(nextFrame, intervalMs);
        };

        startTimer();

        if (speedSelect) {
            speedSelect.addEventListener('change', startTimer);
        }
    };

    const setIndex = (i) => {
        idx = clampIndex(i);
        render();
    };

    // Controls
    btnPlay.addEventListener('click', () => {
        if (isPlaying) stop();
        else play();
    });

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            stop();
            setIndex(idx - 1);
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            stop();
            setIndex(idx + 1);
        });
    }

    scrubber.addEventListener('input', () => {
        const v = parseInt(scrubber.value, 10);
        if (Number.isFinite(v)) setIndex(v);
    });

    scrubber.addEventListener('pointerdown', () => {
        wasPlayingBeforeScrub = isPlaying;
        stop();
    });

    scrubber.addEventListener('pointerup', () => {
        if (wasPlayingBeforeScrub) play();
        wasPlayingBeforeScrub = false;
    });

    // Keyboard support when focused inside the demo section
    section.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            if (isPlaying) stop();
            else play();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            stop();
            setIndex(idx - 1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            stop();
            setIndex(idx + 1);
        }
    });
    section.setAttribute('tabindex', '0');

    // Load manifest
    fetch(manifestUrl, { cache: 'no-cache' })
        .then((r) => {
            if (!r.ok) throw new Error(`Failed to load ${manifestUrl}: ${r.status}`);
            return r.json();
        })
        .then((data) => {
            fps = (data && Number.isFinite(data.fps) && data.fps > 0) ? data.fps : 2;
            frames = Array.isArray(data && data.frames) ? data.frames : [];

            // Basic validation: require the 3 streams (manifest generator produces complete frames by default)
            frames = frames.filter((f) => f && f.sat && f.gt && f.gen);

            idx = 0;
            render();
        })
        .catch((err) => {
            console.warn(err);
            frames = [];
            render();
            setStatus('Demo manifest missing or invalid. Create static/data/demo_frames.json to enable the demo.');
        });
}

// More Works Dropdown Functionality
function toggleMoreWorks() {
    const dropdown = document.getElementById('moreWorksDropdown');
    const button = document.querySelector('.more-works-btn');
    
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        button.classList.remove('active');
    } else {
        dropdown.classList.add('show');
        button.classList.add('active');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const container = document.querySelector('.more-works-container');
    const dropdown = document.getElementById('moreWorksDropdown');
    const button = document.querySelector('.more-works-btn');
    
    if (container && !container.contains(event.target)) {
        dropdown.classList.remove('show');
        button.classList.remove('active');
    }
});

// Close dropdown on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const dropdown = document.getElementById('moreWorksDropdown');
        const button = document.querySelector('.more-works-btn');
        dropdown.classList.remove('show');
        button.classList.remove('active');
    }
});

// Copy BibTeX to clipboard
function copyBibTeX() {
    const bibtexElement = document.getElementById('bibtex-code');
    const button = document.querySelector('.copy-bibtex-btn');
    const copyText = button.querySelector('.copy-text');
    
    if (bibtexElement) {
        navigator.clipboard.writeText(bibtexElement.textContent).then(function() {
            // Success feedback
            button.classList.add('copied');
            copyText.textContent = 'Cop';
            
            setTimeout(function() {
                button.classList.remove('copied');
                copyText.textContent = 'Copy';
            }, 2000);
        }).catch(function(err) {
            console.error('Failed to copy: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = bibtexElement.textContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            button.classList.add('copied');
            copyText.textContent = 'Cop';
            setTimeout(function() {
                button.classList.remove('copied');
                copyText.textContent = 'Copy';
            }, 2000);
        });
    }
}

// Scroll to top functionality
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Show/hide scroll to top button
window.addEventListener('scroll', function() {
    const scrollButton = document.querySelector('.scroll-to-top');
    if (window.pageYOffset > 300) {
        scrollButton.classList.add('visible');
    } else {
        scrollButton.classList.remove('visible');
    }
});

// Video carousel autoplay when in view
function setupVideoCarouselAutoplay() {
    const carouselVideos = document.querySelectorAll('.results-carousel video');
    
    if (carouselVideos.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            if (entry.isIntersecting) {
                // Video is in view, play it
                video.play().catch(e => {
                    // Autoplay failed, probably due to browser policy
                    console.log('Autoplay prevented:', e);
                });
            } else {
                // Video is out of view, pause it
                video.pause();
            }
        });
    }, {
        threshold: 0.5 // Trigger when 50% of the video is visible
    });
    
    carouselVideos.forEach(video => {
        observer.observe(video);
    });
}

$(document).ready(function() {
    // Check for click events on the navbar burger icon

    var options = {
		slidesToScroll: 1,
		slidesToShow: 1,
		loop: true,
		infinite: true,
		autoplay: true,
		autoplaySpeed: 5000,
    }

	// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);
	
    bulmaSlider.attach();
    
    // Setup video autoplay for carousel
    setupVideoCarouselAutoplay();

    // Setup interactive demo
    initInteractiveDemo();

})

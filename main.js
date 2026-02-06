// Carousel functionality
let currentSlide = 0;
const totalSlides = 8;

function moveCarousel(direction) {
    currentSlide += direction;
    if (currentSlide < 0) currentSlide = totalSlides - 1;
    if (currentSlide >= totalSlides) currentSlide = 0;
    updateCarousel();
}

function goToSlide(index) {
    currentSlide = index;
    updateCarousel();
}

function updateCarousel() {
    const inner = document.querySelector('.carousel-inner');
    if (inner) {
        inner.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        // Update indicators
        document.querySelectorAll('.indicator').forEach((ind, idx) => {
            ind.classList.toggle('active', idx === currentSlide);
        });
    }
}

// Auto-advance carousel
setInterval(() => {
    moveCarousel(1);
}, 8000);

// Tab switching
let currentTab = 0;

function switchTab(index) {
    currentTab = index;
    
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === index);
    });
    
    // Update content
    document.querySelectorAll('.tab-pane').forEach((pane, idx) => {
        pane.classList.toggle('active', idx === index);
    });
}

// Mobile menu toggle
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.classList.toggle('mobile-active');
    }
}

// Smooth scroll for skip link
document.addEventListener('DOMContentLoaded', () => {
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
        skipLink.addEventListener('click', (e) => {
            e.preventDefault();
            const main = document.querySelector('#main');
            if (main) {
                main.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        const nav = document.querySelector('nav');
        const navLinks = document.querySelector('.nav-links');
        const mobileBtn = document.querySelector('.mobile-menu-btn');
        
        if (navLinks && navLinks.classList.contains('mobile-active')) {
            if (!nav.contains(e.target)) {
                navLinks.classList.remove('mobile-active');
            }
        }
    });

    // Add smooth scroll to all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '#main') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
});

// Add scroll effect to navigation
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

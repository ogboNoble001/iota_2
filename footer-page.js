// Footer Page JavaScript

// Smooth scroll for TOC links
document.addEventListener('DOMContentLoaded', () => {
    const tocLinks = document.querySelectorAll('.toc-link');
    const sections = document.querySelectorAll('.info-section');
    
    // Smooth scroll
    tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            
            if (target) {
                const offset = 80;
                const bodyRect = document.body.getBoundingClientRect().top;
                const targetRect = target.getBoundingClientRect().top;
                const targetPosition = targetRect - bodyRect - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Update active state
                tocLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });
    
    // Update active state on scroll
    const observerOptions = {
        root: null,
        rootMargin: '-100px 0px -66%',
        threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                tocLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);
    
    sections.forEach(section => {
        if (section.id) {
            observer.observe(section);
        }
    });
    
    // Mobile TOC toggle
    if (window.innerWidth <= 1024) {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'toc-toggle-btn';
        toggleBtn.innerHTML = '<i data-lucide="menu"></i>';
        toggleBtn.style.cssText = 'position: fixed; bottom: 2rem; right: 2rem; z-index: 1000; background: var(--primary); color: white; width: 56px; height: 56px; border-radius: 50%; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer;';
        
        document.body.appendChild(toggleBtn);
        
        toggleBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('tocSidebar');
            sidebar.classList.toggle('active');
        });
        
        lucide.createIcons();
    }
});

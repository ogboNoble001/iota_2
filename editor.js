// Editor Application
class EditorApp {
    constructor() {
        this.zoom = 100;
        this.selectedDevice = null;
        this.selectedTool = 'select';
        this.currentProject = {
            name: 'Untitled Project',
            pages: [],
            assets: []
        };
        
        this.init();
    }

    init() {
        this.setupSidebars();
        this.setupToolbar();
        this.setupDeviceSelection();
        this.setupModals();
        this.setupKeyboardShortcuts();
        this.setupDragAndDrop();
        lucide.createIcons();
    }

    // Sidebar Management
    setupSidebars() {
        // Tab switching
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const panel = tab.dataset.panel;
                const sidebar = tab.closest('.sidebar');
                
                // Deactivate all tabs and panels in this sidebar
                sidebar.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
                sidebar.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
                
                // Activate clicked tab and its panel
                tab.classList.add('active');
                sidebar.querySelector(`#${panel}Panel`).classList.add('active');
            });
        });

        // Sidebar toggle
        const leftToggle = document.getElementById('leftToggle');
        const rightToggle = document.getElementById('rightToggle');
        const leftSidebar = document.getElementById('leftSidebar');
        const rightSidebar = document.getElementById('rightSidebar');

        leftToggle.addEventListener('click', () => {
            leftSidebar.classList.toggle('collapsed');
            const icon = leftToggle.querySelector('i');
            icon.setAttribute('data-lucide', 
                leftSidebar.classList.contains('collapsed') ? 'chevron-right' : 'chevron-left'
            );
            lucide.createIcons();
        });

        rightToggle.addEventListener('click', () => {
            rightSidebar.classList.toggle('collapsed');
            const icon = rightToggle.querySelector('i');
            icon.setAttribute('data-lucide', 
                rightSidebar.classList.contains('collapsed') ? 'chevron-left' : 'chevron-right'
            );
            lucide.createIcons();
        });

        // Mobile sidebar toggle
        if (window.innerWidth <= 768) {
            leftToggle.addEventListener('click', () => {
                leftSidebar.classList.toggle('active');
            });
            
            rightToggle.addEventListener('click', () => {
                rightSidebar.classList.toggle('active');
            });
        }
    }

    // Toolbar & Tools
    setupToolbar() {
        // Tool selection
        const tools = ['selectTool', 'frameTool', 'textTool', 'shapeTool', 'penTool', 'imageTool'];
        
        tools.forEach(toolId => {
            const tool = document.getElementById(toolId);
            if (tool) {
                tool.addEventListener('click', () => {
                    // Deactivate all tools
                    tools.forEach(id => {
                        document.getElementById(id)?.classList.remove('active');
                    });
                    
                    // Activate clicked tool
                    tool.classList.add('active');
                    this.selectedTool = toolId.replace('Tool', '');
                    console.log('Selected tool:', this.selectedTool);
                });
            }
        });

        // Undo/Redo
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            console.log('Undo');
            // Implement undo logic
        });

        document.getElementById('redoBtn')?.addEventListener('click', () => {
            console.log('Redo');
            // Implement redo logic
        });

        // Zoom controls
        document.getElementById('zoomIn')?.addEventListener('click', () => {
            this.zoom = Math.min(400, this.zoom + 10);
            this.updateZoom();
        });

        document.getElementById('zoomOut')?.addEventListener('click', () => {
            this.zoom = Math.max(10, this.zoom - 10);
            this.updateZoom();
        });

        document.getElementById('zoomFit')?.addEventListener('click', () => {
            this.zoom = 100;
            this.updateZoom();
        });

        // View toggles
        document.getElementById('gridToggle')?.addEventListener('click', (e) => {
            e.currentTarget.classList.toggle('active');
            // Toggle grid display
        });

        document.getElementById('rulersToggle')?.addEventListener('click', (e) => {
            e.currentTarget.classList.toggle('active');
            // Toggle rulers display
        });

        document.getElementById('guidesToggle')?.addEventListener('click', (e) => {
            e.currentTarget.classList.toggle('active');
            // Toggle guides display
        });

        // Project name editing
        const projectNameInput = document.getElementById('projectName');
        if (projectNameInput) {
            projectNameInput.addEventListener('change', (e) => {
                this.currentProject.name = e.target.value;
                console.log('Project renamed to:', this.currentProject.name);
            });
        }
    }

    updateZoom() {
        document.getElementById('zoomLevel').textContent = `${this.zoom}%`;
        const artboard = document.getElementById('artboard');
        if (artboard) {
            artboard.style.transform = `scale(${this.zoom / 100})`;
        }
    }

    // Device Selection
    setupDeviceSelection() {
        const deviceOptions = document.querySelectorAll('.device-option');
        
        deviceOptions.forEach(option => {
            option.addEventListener('click', () => {
                const deviceType = option.dataset.device;
                this.selectDevice(deviceType);
            });
        });
    }

    selectDevice(deviceType) {
        const overlay = document.getElementById('deviceOverlay');
        const artboard = document.getElementById('artboard');
        
        const devices = {
            iphone14: { width: 390, height: 844, name: 'iPhone 14' },
            pixel7: { width: 412, height: 915, name: 'Pixel 7' },
            ipad: { width: 1024, height: 1366, name: 'iPad Pro' },
            desktop: { width: 1920, height: 1080, name: 'Desktop' },
            custom: { width: 375, height: 667, name: 'Custom' }
        };

        const device = devices[deviceType];
        
        if (deviceType === 'custom') {
            // Open custom size dialog
            const width = prompt('Enter width:', '375');
            const height = prompt('Enter height:', '667');
            
            if (width && height) {
                device.width = parseInt(width);
                device.height = parseInt(height);
            } else {
                return;
            }
        }

        this.selectedDevice = device;
        
        // Hide overlay and show artboard
        overlay.style.display = 'none';
        artboard.style.display = 'block';
        artboard.style.width = device.width + 'px';
        artboard.style.height = device.height + 'px';

        console.log('Device selected:', device.name, `${device.width}x${device.height}`);

        // Create initial onboarding elements
        this.createOnboardingElements();
    }

    createOnboardingElements() {
        const artboardContent = document.querySelector('.artboard-content');
        
        // Add welcome message
        const welcome = document.createElement('div');
        welcome.className = 'onboarding-message';
        welcome.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #6b7280;">
                <i data-lucide="sparkles" style="width: 48px; height: 48px; margin: 0 auto 1rem;"></i>
                <h3 style="margin-bottom: 0.5rem; color: #1f2937;">Start Creating</h3>
                <p>Drag components from the right sidebar<br>or use tools from the top toolbar</p>
            </div>
        `;
        artboardContent.appendChild(welcome);
        lucide.createIcons();
    }

    // Modals
    setupModals() {
        // Export modal
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.showModal('exportModal');
        });

        // Share modal
        document.getElementById('shareBtn')?.addEventListener('click', () => {
            this.showModal('shareModal');
        });

        // Preview
        document.getElementById('previewBtn')?.addEventListener('click', () => {
            this.showPreview();
        });

        // Close modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.hideModal(modal.id);
            });
        });

        // Close modal on overlay click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        // Export options
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', () => {
                const format = option.querySelector('span').textContent;
                this.exportDesign(format);
            });
        });

        // Copy share link
        const shareModal = document.getElementById('shareModal');
        if (shareModal) {
            const copyBtn = shareModal.querySelector('.btn-primary');
            copyBtn?.addEventListener('click', () => {
                const input = shareModal.querySelector('input[type="text"]');
                input.select();
                document.execCommand('copy');
                
                // Show feedback
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i data-lucide="check"></i> Copied!';
                lucide.createIcons();
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    lucide.createIcons();
                }, 2000);
            });
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    showPreview() {
        const artboard = document.getElementById('artboard');
        const clone = artboard.cloneNode(true);
        
        // Create preview window
        const preview = window.open('', 'Preview', 'width=400,height=800');
        preview.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Preview - ${this.currentProject.name}</title>
                <style>
                    body { margin: 0; padding: 0; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .preview-container { background: white; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
                </style>
            </head>
            <body>
                <div class="preview-container">${clone.innerHTML}</div>
            </body>
            </html>
        `);
    }

    exportDesign(format) {
        console.log(`Exporting as ${format}...`);
        
        // Simulate export
        setTimeout(() => {
            alert(`Export as ${format} complete! (This is a demo)`);
            this.hideModal('exportModal');
        }, 1000);
    }

    // Drag and Drop
    setupDragAndDrop() {
        const components = document.querySelectorAll('.component-item');
        const artboard = document.querySelector('.artboard-content');

        components.forEach(component => {
            component.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('component', component.dataset.component);
                component.style.opacity = '0.5';
            });

            component.addEventListener('dragend', (e) => {
                component.style.opacity = '1';
            });
        });

        if (artboard) {
            artboard.addEventListener('dragover', (e) => {
                e.preventDefault();
                artboard.style.background = 'rgba(99, 102, 241, 0.05)';
            });

            artboard.addEventListener('dragleave', (e) => {
                artboard.style.background = '';
            });

            artboard.addEventListener('drop', (e) => {
                e.preventDefault();
                artboard.style.background = '';
                
                const componentType = e.dataTransfer.getData('component');
                const rect = artboard.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                this.addComponent(componentType, x, y);
            });
        }
    }

    addComponent(type, x, y) {
        const artboard = document.querySelector('.artboard-content');
        const component = this.createComponent(type);
        
        component.style.position = 'absolute';
        component.style.left = x + 'px';
        component.style.top = y + 'px';
        
        // Remove onboarding message if exists
        const onboarding = artboard.querySelector('.onboarding-message');
        if (onboarding) {
            onboarding.remove();
        }
        
        artboard.appendChild(component);
        
        // Make component selectable and movable
        this.makeInteractive(component);
        
        lucide.createIcons();
    }

    createComponent(type) {
        const div = document.createElement('div');
        div.className = 'component ' + type;
        
        const components = {
            button: {
                html: '<button style="padding: 12px 24px; background: #6366f1; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer;">Button</button>',
                width: 'auto'
            },
            input: {
                html: '<input type="text" placeholder="Enter text..." style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; width: 200px; font-size: 14px;">',
                width: '200px'
            },
            card: {
                html: '<div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; width: 250px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><h4 style="margin: 0 0 8px 0;">Card Title</h4><p style="margin: 0; color: #6b7280; font-size: 14px;">Card content goes here</p></div>',
                width: '250px'
            },
            navbar: {
                html: '<div style="background: white; border-bottom: 1px solid #e5e7eb; padding: 16px; width: 100%; display: flex; justify-content: space-between; align-items: center;"><span style="font-weight: 600;">App Name</span><i data-lucide="menu"></i></div>',
                width: '100%'
            },
            container: {
                html: '<div style="border: 2px dashed #e5e7eb; border-radius: 8px; padding: 20px; min-width: 200px; min-height: 150px;"><p style="color: #6b7280; text-align: center;">Container</p></div>',
                width: '200px'
            }
        };

        const config = components[type] || components.button;
        div.innerHTML = config.html;
        
        return div;
    }

    makeInteractive(element) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        element.addEventListener('mousedown', (e) => {
            if (this.selectedTool === 'select') {
                isDragging = true;
                initialX = e.clientX - element.offsetLeft;
                initialY = e.clientY - element.offsetTop;
                
                // Highlight selected element
                document.querySelectorAll('.component').forEach(c => c.style.outline = 'none');
                element.style.outline = '2px solid #6366f1';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                element.style.left = currentX + 'px';
                element.style.top = currentY + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // Keyboard Shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Tool shortcuts
            if (!e.target.matches('input, textarea')) {
                switch(e.key.toLowerCase()) {
                    case 'v':
                        document.getElementById('selectTool')?.click();
                        break;
                    case 'f':
                        document.getElementById('frameTool')?.click();
                        break;
                    case 't':
                        document.getElementById('textTool')?.click();
                        break;
                    case 'r':
                        document.getElementById('shapeTool')?.click();
                        break;
                    case 'p':
                        document.getElementById('penTool')?.click();
                        break;
                }
            }

            // Undo/Redo
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        document.getElementById('redoBtn')?.click();
                    } else {
                        document.getElementById('undoBtn')?.click();
                    }
                }
            }

            // Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveProject();
            }
        });
    }

    saveProject() {
        console.log('Saving project...', this.currentProject);
        // Implement save logic
        alert('Project saved! (This is a demo)');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.editorApp = new EditorApp();
});

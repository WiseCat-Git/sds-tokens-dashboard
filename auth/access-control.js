class SimpleAccessControl {
    constructor() {
        this.adminEmail = 'lopezlozano@google.com';
        this.authorizedEmails = this.loadAuthorizedEmails();
        this.currentUser = null;
        this.isAuthenticated = false;
        this.sessionTimeout = 8 * 60 * 60 * 1000; // 8 hours
    }

    // Load authorized emails from localStorage
    loadAuthorizedEmails() {
        const stored = localStorage.getItem('sds_authorized_emails');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Default authorized users (including admin)
        return [
            'lopezlozano@google.com',
            // Add initial team members here
            'example@google.com', // Remove this placeholder
        ];
    }

    // Save authorized emails to localStorage
    saveAuthorizedEmails() {
        localStorage.setItem('sds_authorized_emails', JSON.stringify(this.authorizedEmails));
    }

    // Check for existing session
    checkExistingSession() {
        const session = localStorage.getItem('sds_user_session');
        if (session) {
            try {
                const sessionData = JSON.parse(session);
                const now = Date.now();
                
                // Check if session is still valid
                if (sessionData.expiresAt > now && this.isEmailAuthorized(sessionData.email)) {
                    this.currentUser = {
                        email: sessionData.email,
                        name: sessionData.name || sessionData.email.split('@')[0],
                        authenticatedAt: new Date(sessionData.authenticatedAt)
                    };
                    this.isAuthenticated = true;
                    return true;
                }
            } catch (error) {
                console.error('Invalid session data:', error);
            }
        }
        
        // Clear invalid session
        localStorage.removeItem('sds_user_session');
        return false;
    }

    // Create user session
    createSession(email, name) {
        const sessionData = {
            email: email,
            name: name,
            authenticatedAt: Date.now(),
            expiresAt: Date.now() + this.sessionTimeout
        };
        
        localStorage.setItem('sds_user_session', JSON.stringify(sessionData));
    }

    // Email validation
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Check if email is authorized
    isEmailAuthorized(email) {
        return this.authorizedEmails.includes(email.toLowerCase());
    }

    // Check if user is admin
    isAdmin(email) {
        return email.toLowerCase() === this.adminEmail.toLowerCase();
    }

    // Authenticate user with email prompt
    authenticateUser() {
        return new Promise((resolve) => {
            // Show email input modal
            this.showEmailPrompt((email, name) => {
                if (this.isEmailAuthorized(email)) {
                    this.currentUser = {
                        email: email,
                        name: name || email.split('@')[0],
                        authenticatedAt: new Date()
                    };
                    this.isAuthenticated = true;
                    this.createSession(email, name);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Show email input prompt
    showEmailPrompt(callback) {
        const modal = document.createElement('div');
        modal.className = 'email-prompt-modal';
        modal.innerHTML = `
            <div class="email-prompt-container">
                <div class="email-prompt-header">
                    <h2>Access SDS Tokens Dashboard</h2>
                    <p>Please enter your Google email address to continue</p>
                </div>
                <form id="email-form" class="email-prompt-form">
                    <div class="form-group">
                        <label for="user-email">Email Address</label>
                        <input 
                            type="email" 
                            id="user-email" 
                            placeholder="your-email@google.com" 
                            required 
                            autocomplete="email"
                        >
                    </div>
                    <div class="form-group">
                        <label for="user-name">Display Name (Optional)</label>
                        <input 
                            type="text" 
                            id="user-name" 
                            placeholder="Your Name"
                            autocomplete="name"
                        >
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="access-btn">Access Dashboard</button>
                    </div>
                </form>
                <div class="email-prompt-footer">
                    <p>Access restricted to authorized team members only</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle form submission
        const form = document.getElementById('email-form');
        const emailInput = document.getElementById('user-email');
        const nameInput = document.getElementById('user-name');

        // Focus on email input
        setTimeout(() => emailInput.focus(), 100);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = emailInput.value.trim().toLowerCase();
            const name = nameInput.value.trim();

            if (!this.isValidEmail(email)) {
                this.showError('Please enter a valid email address');
                return;
            }

            document.body.removeChild(modal);
            callback(email, name);
        });

        // ESC key to close (for testing purposes)
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escHandler);
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            }
        });
    }

    // Show error message in prompt
    showError(message) {
        let errorDiv = document.querySelector('.email-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'email-error';
            const form = document.getElementById('email-form');
            form.insertBefore(errorDiv, form.querySelector('.form-actions'));
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    // Add email to authorized list (admin only)
    addAuthorizedEmail(email) {
        if (!this.isAdmin(this.currentUser.email)) {
            throw new Error('Only admin can add users');
        }

        const normalizedEmail = email.toLowerCase().trim();
        if (!this.authorizedEmails.includes(normalizedEmail)) {
            this.authorizedEmails.push(normalizedEmail);
            this.saveAuthorizedEmails();
            return true;
        }
        return false;
    }

    // Remove email from authorized list (admin only)
    removeAuthorizedEmail(email) {
        if (!this.isAdmin(this.currentUser.email)) {
            throw new Error('Only admin can remove users');
        }

        const normalizedEmail = email.toLowerCase().trim();
        const index = this.authorizedEmails.indexOf(normalizedEmail);
        if (index > -1) {
            this.authorizedEmails.splice(index, 1);
            this.saveAuthorizedEmails();
            return true;
        }
        return false;
    }

    // Show dashboard
    showDashboard() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('access-denied-screen').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'block';
        
        // Update user info in header
        this.updateUserInfo();
        
        // Show admin tab if user is admin
        if (this.isAdmin(this.currentUser.email)) {
            document.getElementById('admin-tab').style.display = 'block';
            this.showAdminControls();
        }
        
        // Initialize dashboard functionality
        if (typeof initializeDashboard === 'function') {
            initializeDashboard();
        }
    }

    // Show access denied screen
    showAccessDenied() {
        document.getElementById('dashboard-container').style.display = 'none';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('access-denied-screen').style.display = 'flex';
        
        document.getElementById('denied-user-email').textContent = this.currentUser.email;
    }

    // Update user info in header
    updateUserInfo() {
        const userInfoElement = document.getElementById('user-info');
        if (userInfoElement && this.currentUser) {
            // Create a simple avatar with initials
            const initials = this.currentUser.name ? 
                this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() :
                this.currentUser.email[0].toUpperCase();

            userInfoElement.innerHTML = `
                <div class="user-avatar">
                    <div class="avatar-initials">${initials}</div>
                </div>
                <div class="user-details">
                    <div class="user-name">${this.currentUser.name}</div>
                    <div class="user-email">${this.currentUser.email}</div>
                </div>
                <button onclick="accessControl.logout()" class="logout-btn">Sign Out</button>
            `;
        }
    }

    // Show admin controls
    showAdminControls() {
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
            adminPanel.style.display = 'block';
            this.renderAuthorizedUsersList();
        }
    }

    // Render list of authorized users
    renderAuthorizedUsersList() {
        const usersList = document.getElementById('authorized-users-list');
        if (usersList) {
            usersList.innerHTML = this.authorizedEmails.map(email => `
                <div class="authorized-user-item">
                    <span class="user-email">${email}</span>
                    ${email !== this.adminEmail ? `
                        <button onclick="accessControl.removeUser('${email}')" class="remove-user-btn">Remove</button>
                    ` : `
                        <span class="admin-badge">Admin</span>
                    `}
                </div>
            `).join('');
        }
    }

    // Add user through admin panel
    addUser() {
        const emailInput = document.getElementById('new-user-email');
        const email = emailInput.value.trim();
        
        if (!email) {
            alert('Please enter an email address');
            return;
        }

        if (!this.isValidEmail(email)) {
            alert('Please enter a valid email address');
            return;
        }

        try {
            if (this.addAuthorizedEmail(email)) {
                emailInput.value = '';
                this.renderAuthorizedUsersList();
                alert(`Added ${email} to authorized users`);
            } else {
                alert(`${email} is already authorized`);
            }
        } catch (error) {
            alert(error.message);
        }
    }

    // Remove user through admin panel
    removeUser(email) {
        if (confirm(`Remove ${email} from authorized users?`)) {
            try {
                if (this.removeAuthorizedEmail(email)) {
                    this.renderAuthorizedUsersList();
                    alert(`Removed ${email} from authorized users`);
                }
            } catch (error) {
                alert(error.message);
            }
        }
    }

    // Logout user
    logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem('sds_user_session');
        location.reload(); // Reload page to reset state
    }

    // Initialize the access control system
    async initialize() {
        console.log('Initializing simple access control...');
        
        // Check for existing session first
        if (this.checkExistingSession()) {
            console.log('Found valid existing session for:', this.currentUser.email);
            this.showDashboard();
            return;
        }

        // Show login screen
        document.getElementById('login-screen').style.display = 'flex';
        
        // Wait for user to authenticate
        const authenticated = await this.authenticateUser();
        
        if (authenticated) {
            console.log('User authenticated:', this.currentUser.email);
            this.showDashboard();
        } else {
            console.log('Authentication failed for:', this.currentUser?.email);
            this.showAccessDenied();
        }
    }
}

// Create global access control instance
const accessControl = new SimpleAccessControl();
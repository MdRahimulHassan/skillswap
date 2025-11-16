// Error Handling and User Feedback System

// Toast notification system
function showToast(message, type = 'success', duration = 3000) {
    // Remove existing toast if any
    const existingToast = document.getElementById('toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                type === 'error' ? 'fa-exclamation-circle' : 
                type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${icon}"></i>
            <span id="toastMessage">${message}</span>
        </div>
    `;

    // Add styles if not already present
    if (!document.querySelector('#toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                background: var(--success-color, #28a745);
                color: white;
                padding: 1rem 1.5rem;
                border-radius: var(--border-radius-sm, 8px);
                box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.16));
                transform: translateX(400px);
                transition: transform 0.3s ease;
                z-index: 3000;
                max-width: 400px;
            }
            .toast.error { background: var(--danger-color, #dc3545); }
            .toast.warning { background: var(--warning-color, #ffc107); color: #333; }
            .toast.info { background: var(--accent-color, #17a2b8); }
            .toast.show { transform: translateX(0); }
            .toast-content { display: flex; align-items: center; gap: 0.75rem; }
            @media (max-width: 768px) {
                .toast { right: 1rem; left: 1rem; bottom: 1rem; max-width: none; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Loading state manager
class LoadingManager {
    constructor() {
        this.loadingElements = new Map();
    }

    show(elementId, text = 'Loading...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        // Store original content
        this.loadingElements.set(elementId, {
            originalContent: element.innerHTML,
            originalDisabled: element.disabled
        });

        // Show loading state
        element.disabled = true;
        element.innerHTML = `
            <div class="loading-content">
                <div class="spinner-small"></div>
                <span>${text}</span>
            </div>
        `;

        // Add loading styles if not present
        if (!document.querySelector('#loading-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-styles';
            style.textContent = `
                .loading-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                .spinner-small {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top: 2px solid currentColor;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    hide(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const stored = this.loadingElements.get(elementId);
        if (stored) {
            element.innerHTML = stored.originalContent;
            element.disabled = stored.originalDisabled;
            this.loadingElements.delete(elementId);
        }
    }

    showGlobal(text = 'Loading...') {
        let globalLoader = document.getElementById('global-loader');
        if (!globalLoader) {
            globalLoader = document.createElement('div');
            globalLoader.id = 'global-loader';
            globalLoader.innerHTML = `
                <div class="global-loader-backdrop">
                    <div class="global-loader-content">
                        <div class="spinner-large"></div>
                        <p>${text}</p>
                    </div>
                </div>
            `;
            
            // Add global loader styles
            if (!document.querySelector('#global-loader-styles')) {
                const style = document.createElement('style');
                style.id = 'global-loader-styles';
                style.textContent = `
                    .global-loader-backdrop {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 9999;
                    }
                    .global-loader-content {
                        background: white;
                        padding: 2rem;
                        border-radius: var(--border-radius, 12px);
                        text-align: center;
                        box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.16));
                    }
                    .spinner-large {
                        width: 40px;
                        height: 40px;
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid var(--primary-color, #4e54c8);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 1rem;
                    }
                `;
                document.head.appendChild(style);
            }
        }
        document.body.appendChild(globalLoader);
    }

    hideGlobal() {
        const globalLoader = document.getElementById('global-loader');
        if (globalLoader) {
            globalLoader.remove();
        }
    }
}

// Global loading manager instance
const loading = new LoadingManager();

// Enhanced error handler
function handleError(error, context = 'Operation') {
    console.error(`${context} Error:`, error);
    
    let message = 'An unexpected error occurred';
    
    if (error.message) {
        if (error.message.includes('Failed to fetch')) {
            message = 'Network error. Please check your connection.';
        } else if (error.message.includes('HTTP 401')) {
            message = 'Authentication required. Please login again.';
        } else if (error.message.includes('HTTP 403')) {
            message = 'You do not have permission to perform this action.';
        } else if (error.message.includes('HTTP 404')) {
            message = 'The requested resource was not found.';
        } else if (error.message.includes('HTTP 500')) {
            message = 'Server error. Please try again later.';
        } else {
            message = error.message;
        }
    }
    
    showToast(message, 'error');
    
    // Hide any loading states
    loading.hideGlobal();
    
    return message;
}

// Form validation helper
function validateForm(formId, rules = {}) {
    const form = document.getElementById(formId);
    if (!form) return { valid: false, errors: ['Form not found'] };

    const errors = [];
    const formData = new FormData(form);

    // Default validation rules
    const defaultRules = {
        required: (value) => value && value.trim() !== '' || 'This field is required',
        email: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Please enter a valid email address',
        minLength: (value, min) => !value || value.length >= min || `Minimum ${min} characters required`,
        maxLength: (value, max) => !value || value.length <= max || `Maximum ${max} characters allowed`,
        password: (value) => !value || (value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value)) || 
                   'Password must be at least 8 characters with uppercase letter and number'
    };

    // Clear previous errors
    form.querySelectorAll('.error-message').forEach(el => el.remove());
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

    // Validate each field
    for (const [fieldName, fieldRules] of Object.entries(rules)) {
        const value = formData.get(fieldName);
        const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);

        for (const rule of fieldRules) {
            const [ruleName, ...params] = rule.split(':');
            const validator = defaultRules[ruleName];
            
            if (validator) {
                const result = validator(value, ...params);
                if (result !== true) {
                    errors.push(`${fieldName}: ${result}`);
                    
                    // Show error on field
                    if (field) {
                        field.classList.add('error');
                        const errorEl = document.createElement('div');
                        errorEl.className = 'error-message';
                        errorEl.textContent = result;
                        errorEl.style.color = 'var(--danger-color, #dc3545)';
                        errorEl.style.fontSize = '0.8rem';
                        errorEl.style.marginTop = '0.25rem';
                        field.parentNode.appendChild(errorEl);
                    }
                    break; // Stop at first error for this field
                }
            }
        }
    }

    // Add error styles if not present
    if (errors.length > 0 && !document.querySelector('#validation-styles')) {
        const style = document.createElement('style');
        style.id = 'validation-styles';
        style.textContent = `
            .error {
                border-color: var(--danger-color, #dc3545) !important;
                box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2) !important;
            }
            .error-message {
                color: var(--danger-color, #dc3545);
                font-size: 0.8rem;
                margin-top: 0.25rem;
            }
        `;
        document.head.appendChild(style);
    }

    return {
        valid: errors.length === 0,
        errors,
        formData
    };
}

// Global error boundary
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    handleError(event.error, 'Application Error');
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    handleError(event.reason, 'Promise Rejection');
    event.preventDefault();
});

// Enhanced error boundary for async operations
function withErrorBoundary(fn, context = 'Operation') {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, context);
            throw error;
        }
    };
}

// Retry mechanism for failed operations
async function withRetry(fn, maxRetries = 3, delay = 1000, context = 'Operation') {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`${context} attempt ${attempt} failed:`, error);
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    
    throw lastError;
}

// Enhanced loading states with timeout
class EnhancedLoadingManager extends LoadingManager {
    showWithTimeout(elementId, text = 'Loading...', timeout = 30000) {
        this.show(elementId, text);
        
        // Auto-hide after timeout to prevent infinite loading
        setTimeout(() => {
            const element = document.getElementById(elementId);
            if (element && this.loadingElements.has(elementId)) {
                this.hide(elementId);
                showToast('Operation timed out', 'warning');
            }
        }, timeout);
    }
    
    showGlobalWithTimeout(text = 'Loading...', timeout = 30000) {
        this.showGlobal(text);
        
        // Auto-hide after timeout
        setTimeout(() => {
            const globalLoader = document.getElementById('global-loader');
            if (globalLoader) {
                this.hideGlobal();
                showToast('Operation timed out', 'warning');
            }
        }, timeout);
    }
}

// Replace loading instance with enhanced version
const enhancedLoading = new EnhancedLoadingManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        showToast, 
        loading: enhancedLoading, 
        handleError, 
        validateForm,
        withErrorBoundary,
        withRetry
    };
}

// Make enhanced functions globally available
window.loading = enhancedLoading;
window.withErrorBoundary = withErrorBoundary;
window.withRetry = withRetry;
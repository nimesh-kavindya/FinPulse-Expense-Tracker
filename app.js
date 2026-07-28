/**
 * FinPulse - Expense Tracker & Visual Analytics
 * Enhanced Core JavaScript Logic with Firebase Authentication, Firestore Sync,
 * Light/Dark Mode Toggle, and Multi-Currency Support.
 */

// App Version Configuration for Update Notifications
const CURRENT_APP_VERSION = '1.0.3';

// Local Storage Keys
const HOME_DATA_STORAGE_KEY = 'finpulse_home_data';
const STORAGE_KEY = 'finpulse_home_data';
const FD_LOAN_STORAGE_KEY = 'finpulse_fd_loan_data';
const CURRENCY_STORAGE_KEY = 'finpulse_currency';
const THEME_STORAGE_KEY = 'finpulse_theme';
const BUDGET_STORAGE_KEY = 'finpulse_category_budgets';
const USD_TO_LKR_RATE = 326.74; // Exchange Rate

// Default Category Monthly Limits (in LKR base currency)
const DEFAULT_CATEGORY_BUDGETS = {
  Food: 50000,
  Utilities: 35000,
  Entertainment: 20000,
  Shopping: 40000,
  Other: 25000
};

// Current States
let currentCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY) || 'LKR';
let currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';

// Firebase Services
let auth = null;
let db = null;
let currentUser = null;
let unsubscribeTransactions = null;

// Category Definitions & Theme Color Mapping
const CATEGORY_CONFIG = {
  Food: { icon: 'fa-utensils', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
  Utilities: { icon: 'fa-bolt', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  Salary: { icon: 'fa-money-bill-wave', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  Entertainment: { icon: 'fa-gamepad', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  Shopping: { icon: 'fa-bag-shopping', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  Other: { icon: 'fa-layer-group', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
};

// Initial Demo Data for newly registered users
const DEMO_TRANSACTIONS = [
  {
    id: 'demo-1',
    description: 'Monthly Tech Salary',
    amount: 1570000.00,
    type: 'income',
    category: 'Salary',
    date: getFormattedDate(0)
  },
  {
    id: 'demo-2',
    description: 'Grocery & Organic Market',
    amount: 54000.00,
    type: 'expense',
    category: 'Food',
    date: getFormattedDate(-1)
  },
  {
    id: 'demo-3',
    description: 'Electricity & Fiber Internet',
    amount: 31000.00,
    type: 'expense',
    category: 'Utilities',
    date: getFormattedDate(-2)
  },
  {
    id: 'demo-4',
    description: 'Movie IMAX & Cinema Snacks',
    amount: 14000.00,
    type: 'expense',
    category: 'Entertainment',
    date: getFormattedDate(-4)
  },
  {
    id: 'demo-5',
    description: 'Noise Canceling Headphones',
    amount: 49000.00,
    type: 'expense',
    category: 'Shopping',
    date: getFormattedDate(-5)
  },
  {
    id: 'demo-6',
    description: 'Freelance UI Design Client',
    amount: 212000.00,
    type: 'income',
    category: 'Salary',
    date: getFormattedDate(-6)
  }
];

// Helper to generate date string relative to today
function getFormattedDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// Application State
let transactions = [];
let expenseChartInstance = null;
let monthlyFinancialChartInstance = null;
let loanChartMode = 'monthly';
let fdChartMode = 'monthly';
let loanAnalyticsChartInstance = null;
let fdAnalyticsChartInstance = null;

// DOM Elements
let totalBalanceEl, totalIncomeEl, totalExpensesEl, balanceStatusEl;
let transactionForm, descriptionInput, amountInput, categoryInput, dateInput;
let amountLabel, currencySymbolIcon;
let transactionListEl, transactionCountEl, emptyListStateEl;
let searchInput, filterMonthSelect, filterCategorySelect, filterTypeSelect;
let clearAllBtn, confirmModal, cancelModalBtn, confirmModalBtn;
let topExpenseCategoryBadge, chartEmptyStateEl, toastContainer, currencySelect;
let authScreen, appContainer, loginForm, signupForm, tabLoginBtn, tabSignupBtn;
let userEmailText, logoutBtn, themeToggleBtn, themeToggleIcon, themeToggleText;

// Password Toggle Helper
window.togglePasswordVisibility = function (inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btnEl.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.className = 'fa-solid fa-eye-slash';
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.className = 'fa-solid fa-eye';
    }
  }
};

// Helper to dismiss loading screen safely
function hideAppLoader() {
  const loader = document.getElementById('appLoader');
  if (loader && !loader.classList.contains('fade-out')) {
    loader.classList.add('fade-out');
    setTimeout(() => {
      loader.style.display = 'none';
    }, 450);
  }
}

// Initialize Theme
function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  if (theme === 'light') {
    document.body.classList.add('light-theme');
    if (themeToggleIcon) themeToggleIcon.className = 'fa-solid fa-sun';
    if (themeToggleText) themeToggleText.textContent = 'Light';
  } else {
    document.body.classList.remove('light-theme');
    if (themeToggleIcon) themeToggleIcon.className = 'fa-solid fa-moon';
    if (themeToggleText) themeToggleText.textContent = 'Dark';
  }

  if (typeof renderLoanAnalyticsChart === 'function') renderLoanAnalyticsChart();
  if (typeof renderFdAnalyticsChart === 'function') renderFdAnalyticsChart();
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Bind DOM Elements
  totalBalanceEl = document.getElementById('totalBalance');
  totalIncomeEl = document.getElementById('totalIncome');
  totalExpensesEl = document.getElementById('totalExpenses');
  balanceStatusEl = document.getElementById('balanceStatus');

  transactionForm = document.getElementById('transactionForm');
  descriptionInput = document.getElementById('description');
  amountInput = document.getElementById('amount');
  categoryInput = document.getElementById('category');
  dateInput = document.getElementById('date');

  amountLabel = document.getElementById('amountLabel');
  currencySymbolIcon = document.getElementById('currencySymbolIcon');

  transactionListEl = document.getElementById('transactionList');
  transactionCountEl = document.getElementById('transactionCount');
  emptyListStateEl = document.getElementById('emptyListState');

  searchInput = document.getElementById('searchInput');
  filterMonthSelect = document.getElementById('filterMonth');
  filterCategorySelect = document.getElementById('filterCategory');
  filterTypeSelect = document.getElementById('filterType');

  clearAllBtn = document.getElementById('clearAllBtn');
  confirmModal = document.getElementById('confirmModal');
  cancelModalBtn = document.getElementById('cancelModalBtn');
  confirmModalBtn = document.getElementById('confirmModalBtn');

  topExpenseCategoryBadge = document.getElementById('topExpenseCategoryBadge');
  chartEmptyStateEl = document.getElementById('chartEmptyState');
  toastContainer = document.getElementById('toastContainer');
  currencySelect = document.getElementById('currencySelect');

  authScreen = document.getElementById('authScreen');
  appContainer = document.getElementById('appContainer');
  loginForm = document.getElementById('loginForm');
  signupForm = document.getElementById('signupForm');
  tabLoginBtn = document.getElementById('tabLoginBtn');
  tabSignupBtn = document.getElementById('tabSignupBtn');

  userEmailText = document.getElementById('userEmailText');
  logoutBtn = document.getElementById('logoutBtn');
  themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleIcon = document.getElementById('themeToggleIcon');
  themeToggleText = document.getElementById('themeToggleText');

  // Set Theme
  applyTheme(currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      showToast(`Switched to ${newTheme.toUpperCase()} mode`, 'info');
    });
  }

  // Version Check
  const savedVersion = localStorage.getItem('finpulse_version');
  if (!savedVersion) {
    localStorage.setItem('finpulse_version', CURRENT_APP_VERSION);
  } else if (savedVersion !== CURRENT_APP_VERSION) {
    const updateBanner = document.getElementById('updateBanner');
    if (updateBanner) updateBanner.style.display = 'block';
  }

  if (dateInput) dateInput.value = getFormattedDate(0);

  if (currencySelect) {
    currencySelect.value = currentCurrency;
    updateAmountLabelAndIcon(currentCurrency);

    currencySelect.addEventListener('change', (e) => {
      currentCurrency = e.target.value;
      localStorage.setItem(CURRENCY_STORAGE_KEY, currentCurrency);
      updateAmountLabelAndIcon(currentCurrency);
      renderApp();
      renderFdLoanModule();
      showToast(`Currency changed to ${currentCurrency}`, 'info');
    });
  }

  // Setup Auth Tab Switcher
  if (tabLoginBtn && tabSignupBtn) {
    tabLoginBtn.addEventListener('click', () => {
      tabLoginBtn.classList.add('active');
      tabSignupBtn.classList.remove('active');
      loginForm.classList.remove('hidden');
      signupForm.classList.add('hidden');
      document.getElementById('authSubtitle').textContent = 'Welcome back! Sign in to access your financial analytics.';
    });

    tabSignupBtn.addEventListener('click', () => {
      tabSignupBtn.classList.add('active');
      tabLoginBtn.classList.remove('active');
      signupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      document.getElementById('authSubtitle').textContent = 'Create a new account to start tracking expenses.';
    });
  }

  // Setup Form Listeners & Modals
  if (transactionForm) transactionForm.addEventListener('submit', handleAddTransaction);
  if (searchInput) searchInput.addEventListener('input', renderApp);
  if (filterMonthSelect) filterMonthSelect.addEventListener('change', renderApp);
  if (filterCategorySelect) filterCategorySelect.addEventListener('change', renderApp);
  if (filterTypeSelect) filterTypeSelect.addEventListener('change', renderApp);

  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showConfirmModal();
    });
  }
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', hideConfirmModal);
  if (confirmModalBtn) {
    confirmModalBtn.addEventListener('click', () => {
      confirmClearAll();
      hideConfirmModal();
    });
  }
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) hideConfirmModal();
    });
  }

  // Category Budget Limits Modal & Notification Listeners
  const openBudgetModalBtn = document.getElementById('openBudgetModalBtn');
  const closeBudgetModalBtn = document.getElementById('closeBudgetModalBtn');
  const budgetModal = document.getElementById('budgetModal');
  const budgetForm = document.getElementById('budgetForm');
  const enableNotifBtn = document.getElementById('enableNotifBtn');

  if (openBudgetModalBtn) {
    openBudgetModalBtn.addEventListener('click', openBudgetModal);
  }
  if (closeBudgetModalBtn) {
    closeBudgetModalBtn.addEventListener('click', closeBudgetModal);
  }
  if (budgetModal) {
    budgetModal.addEventListener('click', (e) => {
      if (e.target === budgetModal) closeBudgetModal();
    });
  }
  if (budgetForm) {
    budgetForm.addEventListener('submit', handleSaveBudgets);
  }
  if (enableNotifBtn) {
    enableNotifBtn.addEventListener('click', requestNotificationPermission);
  }

  const loanStartDateInput = document.getElementById('loanStartDate');
  const fdStartDateInput = document.getElementById('fdStartDate');
  if (loanStartDateInput) loanStartDateInput.value = getFormattedDate(0);
  if (fdStartDateInput) fdStartDateInput.value = getFormattedDate(0);

  loadLocalLoansAndFdsCache();
  setupFdLoanModuleListeners();
  renderFdLoanModule();

  initChart();
  initMonthlyFinancialChart();
  initFirebase();
  registerServiceWorker();
  checkAppVersion(false);

  // Fallback timer: Dismiss loading screen within 2 seconds if Firebase/network takes longer
  setTimeout(() => {
    hideAppLoader();
  }, 2000);
});

// Initialize Firebase SDK
async function initFirebase() {
  const DEFAULT_FIREBASE_CONFIG = {
    projectId: "finpulse-ecdb3",
    appId: "1:220436316919:web:1ff6674e3d74da92da89f2",
    apiKey: "AIzaSyD4dRmhMa5wCFBTnaCyhrJ2-uHh7KwfWSY",
    authDomain: "finpulse-ecdb3.firebaseapp.com",
    storageBucket: "finpulse-ecdb3.firebasestorage.app",
    messagingSenderId: "220436316919",
    measurementId: "G-HC34LT9GMF"
  };

  let firebaseConfig = DEFAULT_FIREBASE_CONFIG;

  try {
    const configRes = await fetch('./firebase-applet-config.json');
    if (configRes.ok) {
      const text = await configRes.text();
      if (text && text.trim().startsWith('{')) {
        firebaseConfig = JSON.parse(text);
      }
    }
  } catch (err) {
    console.warn('Could not fetch firebase-applet-config.json, using fallback config:', err);
  }

  try {
    if (window.firebase) {
      let firebaseApp;
      if (!window.firebase.apps || !window.firebase.apps.length) {
        firebaseApp = window.firebase.initializeApp(firebaseConfig);
      } else {
        firebaseApp = window.firebase.app();
      }

      // Initialize Auth using app instance
      if (typeof window.firebase.auth === 'function') {
        auth = window.firebase.auth(firebaseApp);
      } else if (typeof window.getAuth === 'function') {
        auth = window.getAuth(firebaseApp);
      } else {
        auth = window.firebase.auth ? window.firebase.auth() : null;
      }

      // Initialize Firestore using app instance
      if (typeof window.firebase.firestore === 'function') {
        db = window.firebase.firestore(firebaseApp);
      } else if (typeof window.getFirestore === 'function') {
        db = window.getFirestore(firebaseApp);
      } else {
        db = window.firebase.firestore ? window.firebase.firestore() : null;
      }

      if (window.firebase.analytics && firebaseConfig.measurementId) {
        try {
          window.firebase.analytics(firebaseApp);
        } catch (e) {
          console.warn('Analytics initialization skipped:', e);
        }
      }
    }

    // Attach auth handlers immediately so onAuthStateChanged fires without delay
    setupAuthHandlers();

    if (db) {
      // Non-blocking connection test in background
      db.collection('test').doc('connection').get({ source: 'server' }).catch((err) => {
        if (err instanceof Error && err.message.includes('the client is offline')) {
          console.warn('Firebase connection test: client is offline');
        }
      });
    }
  } catch (err) {
    console.error('Firebase Initialization Error:', err);
    setupAuthHandlers();
  }
}

// Centralized Firebase Auth Error Handler
function handleAuthError(err, context = 'Authentication') {
  console.error(`[Firebase Auth - ${context}] Error:`, err);
  const code = err ? err.code : '';
  const message = err ? err.message : '';

  let userFriendlyMsg = 'Authentication failed. Please try again.';
  let showNoticeBanner = false;

  switch (code) {
    case 'auth/unauthorized-domain':
      userFriendlyMsg = 'This domain is not authorized in your Firebase Console. Please add this domain under Authentication > Settings > Authorized Domains in Firebase Console.';
      showNoticeBanner = true;
      break;

    case 'auth/popup-closed-by-user':
      userFriendlyMsg = 'The Google sign-in popup was closed before completing authentication.';
      break;

    case 'auth/popup-blocked':
      userFriendlyMsg = 'The Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
      break;

    case 'auth/cancelled-popup-request':
      userFriendlyMsg = 'The sign-in popup request was cancelled.';
      break;

    case 'auth/operation-not-allowed':
      userFriendlyMsg = 'Google Sign-In is disabled in your Firebase console. Please enable Google under Authentication > Sign-in method.';
      showNoticeBanner = true;
      break;

    case 'auth/account-exists-with-different-credential':
      userFriendlyMsg = 'An account already exists with the same email address using a different sign-in method.';
      break;

    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      userFriendlyMsg = 'Invalid email or password. Please check your credentials.';
      break;

    case 'auth/invalid-email':
      userFriendlyMsg = 'Please enter a valid email address.';
      break;

    case 'auth/email-already-in-use':
      userFriendlyMsg = 'This email address is already registered. Please sign in instead.';
      break;

    case 'auth/weak-password':
      userFriendlyMsg = 'Password must be at least 6 characters long.';
      break;

    case 'auth/network-request-failed':
      userFriendlyMsg = 'Network request failed. Please check your internet connection.';
      break;

    case 'auth/user-disabled':
      userFriendlyMsg = 'This account has been disabled by an administrator.';
      break;

    default:
      if (message && message.toLowerCase().includes('unauthorized domain')) {
        userFriendlyMsg = 'This domain is not authorized in your Firebase Console. Please add this domain under Authentication > Settings > Authorized Domains.';
        showNoticeBanner = true;
      } else if (message) {
        userFriendlyMsg = message;
      }
      break;
  }

  showToast(userFriendlyMsg, 'danger');

  const authNotice = document.getElementById('authNotice');
  const authNoticeText = document.getElementById('authNoticeText');
  if (authNotice && authNoticeText) {
    if (showNoticeBanner) {
      authNoticeText.innerHTML = `<strong>Firebase Notice:</strong> ${userFriendlyMsg}<br>You can also click <strong>Continue as Guest</strong> below to access local storage mode.`;
      authNotice.classList.remove('hidden');
    }
  }
}

// Update Logged-in User Profile Display
function updateUserProfileDisplay(user) {
  if (!user) return;
  if (userEmailText) {
    userEmailText.textContent = user.displayName || user.email || 'User';
  }

  const userProfileBadge = document.getElementById('userProfileBadge');
  if (userProfileBadge) {
    let avatarImg = userProfileBadge.querySelector('.user-avatar-img');
    const userBadgeIcon = userProfileBadge.querySelector('i.fa-user');

    if (user.photoURL) {
      if (!avatarImg) {
        avatarImg = document.createElement('img');
        avatarImg.className = 'user-avatar-img';
        avatarImg.style.width = '24px';
        avatarImg.style.height = '24px';
        avatarImg.style.borderRadius = '50%';
        avatarImg.style.objectFit = 'cover';
        avatarImg.style.border = '1.5px solid var(--accent-indigo)';
        if (userBadgeIcon) userBadgeIcon.style.display = 'none';
        userProfileBadge.insertBefore(avatarImg, userEmailText);
      }
      avatarImg.src = user.photoURL;
      avatarImg.alt = user.displayName || 'User Avatar';
      avatarImg.style.display = 'inline-block';
    } else {
      if (avatarImg) avatarImg.style.display = 'none';
      if (userBadgeIcon) userBadgeIcon.style.display = 'inline-block';
    }
  }
}

// Setup Firebase Authentication Logic
function setupAuthHandlers() {
  // Google Sign-In Handler
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      if (!auth) {
        showToast('Firebase Auth is not initialized properly.', 'danger');
        return;
      }

      const googleBtnText = document.getElementById('googleBtnText');
      const originalText = googleBtnText ? googleBtnText.textContent : 'Sign in with Google';

      googleLoginBtn.disabled = true;
      if (googleBtnText) {
        googleBtnText.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Connecting to Google...';
      }

      try {
        let provider;
        if (window.firebase && window.firebase.auth && window.firebase.auth.GoogleAuthProvider) {
          provider = new window.firebase.auth.GoogleAuthProvider();
        } else if (auth.constructor && auth.constructor.GoogleAuthProvider) {
          provider = new auth.constructor.GoogleAuthProvider();
        } else {
          provider = new firebase.auth.GoogleAuthProvider();
        }

        if (provider && typeof provider.setCustomParameters === 'function') {
          provider.setCustomParameters({ prompt: 'select_account' });
        }

        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        showToast(`Welcome, ${user.displayName || user.email || 'User'}!`, 'success');

        const authNotice = document.getElementById('authNotice');
        if (authNotice) authNotice.classList.add('hidden');
      } catch (err) {
        handleAuthError(err, 'Google Sign-In');
      } finally {
        googleLoginBtn.disabled = false;
        if (googleBtnText) {
          googleBtnText.textContent = originalText;
        }
      }
    });
  }

  // Login Handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        showToast('Please enter both email and password.', 'danger');
        return;
      }

      const submitBtn = document.getElementById('loginSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing In...';

      try {
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Signed in successfully!', 'success');
        loginForm.reset();
        const authNotice = document.getElementById('authNotice');
        if (authNotice) authNotice.classList.add('hidden');
      } catch (err) {
        handleAuthError(err, 'Sign In');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
      }
    });
  }

  // Signup Handler
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signupName').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;

      if (!name || !email || !password) {
        showToast('Please fill out all required fields.', 'danger');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'danger');
        return;
      }

      const submitBtn = document.getElementById('signupSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating Account...';

      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        if (userCredential.user) {
          await userCredential.user.updateProfile({ displayName: name });
        }
        showToast('Account created successfully!', 'success');
        signupForm.reset();
        const authNotice = document.getElementById('authNotice');
        if (authNotice) authNotice.classList.add('hidden');
      } catch (err) {
        handleAuthError(err, 'Sign Up');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
      }
    });
  }

  // Guest Mode Login Handler
  const guestLoginBtn = document.getElementById('guestLoginBtn');
  if (guestLoginBtn) {
    guestLoginBtn.addEventListener('click', () => {
      currentUser = null;
      if (authScreen) authScreen.classList.add('hidden');
      if (appContainer) appContainer.classList.remove('hidden');

      if (userEmailText) {
        userEmailText.textContent = 'Guest User (Local)';
      }

      loadLocalTransactionsCache();
      if (transactions.length === 0) {
        transactions = [...DEMO_TRANSACTIONS];
        saveLocalTransactionsCache();
      }
      populateMonthFilter();
      renderApp();

      showToast('Entered as Guest (Local storage mode)', 'info');
    });
  }

  // Forgot Password Modal Handlers
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const resetPasswordModal = document.getElementById('resetPasswordModal');
  const cancelResetBtn = document.getElementById('cancelResetBtn');
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const resetEmailInput = document.getElementById('resetEmail');

  if (forgotPasswordBtn && resetPasswordModal) {
    forgotPasswordBtn.addEventListener('click', () => {
      const currentLoginEmail = document.getElementById('loginEmail')?.value.trim() || '';
      if (resetEmailInput) {
        resetEmailInput.value = currentLoginEmail;
      }
      resetPasswordModal.classList.remove('hidden');
      if (resetEmailInput) resetEmailInput.focus();
    });
  }

  if (cancelResetBtn && resetPasswordModal) {
    cancelResetBtn.addEventListener('click', () => {
      resetPasswordModal.classList.add('hidden');
    });
  }

  if (resetPasswordModal) {
    resetPasswordModal.addEventListener('click', (e) => {
      if (e.target === resetPasswordModal) {
        resetPasswordModal.classList.add('hidden');
      }
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = resetEmailInput ? resetEmailInput.value.trim() : '';

      if (!email) {
        showToast('Please enter your email address.', 'danger');
        return;
      }

      const sendBtn = document.getElementById('sendResetBtn');
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';
      }

      try {
        await auth.sendPasswordResetEmail(email);
        showToast(`Password reset link sent to ${email}! Check your inbox.`, 'success');
        resetPasswordModal.classList.add('hidden');
        resetPasswordForm.reset();
      } catch (err) {
        handleAuthError(err, 'Password Reset');
      } finally {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Link';
        }
      }
    });
  }

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await auth.signOut();
        showToast('Logged out successfully.', 'info');
      } catch (err) {
        console.error('Logout error:', err);
        showToast('Failed to log out.', 'danger');
      }
    });
  }

  // Auth State Changed Observer
  if (auth && typeof auth.onAuthStateChanged === 'function') {
    auth.onAuthStateChanged((user) => {
      hideAppLoader();

      if (user) {
        currentUser = user;
        if (authScreen) authScreen.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');

        updateUserProfileDisplay(user);

        // Sync user transactions from Firestore
        subscribeToUserTransactions(user.uid);
      } else {
        currentUser = null;
        if (unsubscribeTransactions) {
          unsubscribeTransactions();
          unsubscribeTransactions = null;
        }

        if (authScreen) authScreen.classList.remove('hidden');
        if (appContainer) appContainer.classList.add('hidden');

        transactions = [];
        renderApp();
      }
    });
  } else {
    console.warn('Firebase Auth instance not active. Fallback to Guest Mode.');
    hideAppLoader();
    if (authScreen) authScreen.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
    if (userEmailText) userEmailText.textContent = 'Guest User (Local)';
    loadLocalTransactionsCache();
    if (transactions.length === 0) {
      transactions = [...DEMO_TRANSACTIONS];
      saveLocalTransactionsCache();
    }
    populateMonthFilter();
    renderApp();
  }
}

// Firestore Realtime Subscription for User Transactions
function subscribeToUserTransactions(userId) {
  if (!db) return;

  if (unsubscribeTransactions) {
    unsubscribeTransactions();
  }

  // Load from local cache immediately while waiting for Firestore
  loadLocalTransactionsCache();
  loadLocalLoansAndFdsCache();
  populateMonthFilter();
  renderApp();
  renderFdLoanModule();

  // Subscribe to loans & FDs
  subscribeToUserLoansAndFds(userId);

  const txCollectionRef = db.collection('users').doc(userId).collection('transactions');

  unsubscribeTransactions = txCollectionRef.onSnapshot(async (snapshot) => {
    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push({ id: doc.id, ...data });
    });

    const seedKey = 'finpulse_seeded_' + userId;
    if (items.length === 0 && snapshot.metadata.fromCache === false && !localStorage.getItem(seedKey)) {
      // Seed initial demo data for a brand new account only once
      await seedUserDemoTransactions(userId);
      return;
    }

    if (items.length > 0 || snapshot.metadata.fromCache === false) {
      transactions = items.filter(validateTransaction);
      saveLocalTransactionsCache();
      populateMonthFilter();
      renderApp();
    }
  }, (error) => {
    console.error('Firestore snapshot listener error:', error);
    loadLocalTransactionsCache();
    populateMonthFilter();
    renderApp();
  });
}

// Seed Demo Transactions for new users
async function seedUserDemoTransactions(userId) {
  if (!db) return;
  const seedKey = 'finpulse_seeded_' + userId;
  if (localStorage.getItem(seedKey)) return;

  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (userDoc.exists && userDoc.data().seededDemo) {
      localStorage.setItem(seedKey, 'true');
      return;
    }

    const batch = db.batch();
    DEMO_TRANSACTIONS.forEach(t => {
      const docRef = userDocRef.collection('transactions').doc(t.id);
      batch.set(docRef, t);
    });
    batch.set(userDocRef, { seededDemo: true, updatedAt: new Date().toISOString() }, { merge: true });
    await batch.commit();
    localStorage.setItem(seedKey, 'true');
  } catch (err) {
    console.error('Error seeding demo data:', err);
  }
}

function updateAmountLabelAndIcon(currency) {
  if (!amountLabel || !currencySymbolIcon) return;
  if (currency === 'USD') {
    amountLabel.textContent = 'Amount (USD)';
    currencySymbolIcon.innerHTML = '<i class="fa-solid fa-dollar-sign"></i>';
  } else {
    amountLabel.textContent = 'Amount (LKR)';
    currencySymbolIcon.innerHTML = 'Rs.';
  }
}

function validateTransaction(t) {
  return t &&
    typeof t === 'object' &&
    typeof t.id === 'string' &&
    typeof t.description === 'string' &&
    !isNaN(parseFloat(t.amount)) &&
    (t.type === 'income' || t.type === 'expense') &&
    typeof t.category === 'string' &&
    typeof t.date === 'string';
}

function loadLocalTransactionsCache() {
  try {
    const stored = localStorage.getItem(HOME_DATA_STORAGE_KEY) || localStorage.getItem('finpulse_transactions_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        transactions = parsed.filter(validateTransaction);
        return;
      }
    }
  } catch (err) {
    console.error('LocalStorage read error:', err);
  }
  transactions = [];
}

function saveLocalTransactionsCache() {
  try {
    localStorage.setItem(HOME_DATA_STORAGE_KEY, JSON.stringify(transactions));
    localStorage.setItem('finpulse_transactions_v1', JSON.stringify(transactions));
  } catch (err) {
    console.error('LocalStorage write error:', err);
  }
}

function getMonthKey(dateStr) {
  if (!dateStr) return '';
  return dateStr.substring(0, 7);
}

function formatMonthLabel(monthKey) {
  if (!monthKey || monthKey === 'all') return 'All Months';
  const [year, month] = monthKey.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(dateObj);
}

function populateMonthFilter() {
  if (!filterMonthSelect) return;
  const currentSelection = filterMonthSelect.value;
  const monthKeysSet = new Set();

  transactions.forEach(t => {
    const key = getMonthKey(t.date);
    if (key) monthKeysSet.add(key);
  });

  const sortedMonthKeys = Array.from(monthKeysSet).sort((a, b) => b.localeCompare(a));
  filterMonthSelect.innerHTML = '<option value="all">All Months</option>';

  sortedMonthKeys.forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = formatMonthLabel(key);
    filterMonthSelect.appendChild(option);
  });

  if (sortedMonthKeys.includes(currentSelection)) {
    filterMonthSelect.value = currentSelection;
  } else {
    filterMonthSelect.value = 'all';
  }
}

function getFilteredTransactions() {
  const selectedMonth = filterMonthSelect ? filterMonthSelect.value : 'all';
  const selectedCategory = filterCategorySelect ? filterCategorySelect.value : 'all';
  const selectedType = filterTypeSelect ? filterTypeSelect.value : 'all';
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  return transactions.filter(t => {
    const matchesMonth = selectedMonth === 'all' || getMonthKey(t.date) === selectedMonth;
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    const matchesType = selectedType === 'all' || t.type === selectedType;
    const matchesSearch = t.description.toLowerCase().includes(searchTerm) ||
      t.category.toLowerCase().includes(searchTerm) ||
      t.amount.toString().includes(searchTerm);

    return matchesMonth && matchesCategory && matchesType && matchesSearch;
  });
}

function renderApp() {
  const activeMonth = filterMonthSelect ? filterMonthSelect.value : 'all';
  const monthTransactions = transactions.filter(t => activeMonth === 'all' || getMonthKey(t.date) === activeMonth);
  const filteredList = getFilteredTransactions();

  renderSummaryCards(monthTransactions);
  renderTransactionList(filteredList);
  updateChart(monthTransactions);
  renderCategoryBudgets();
  updateMonthlyFinancialChart();
}

function renderSummaryCards(monthTransactions) {
  if (!totalBalanceEl || !totalIncomeEl || !totalExpensesEl || !balanceStatusEl) return;
  let income = 0;
  let expenses = 0;

  monthTransactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') income += amt;
    else expenses += amt;
  });

  const balance = income - expenses;
  totalBalanceEl.textContent = formatCurrency(balance);
  totalIncomeEl.textContent = formatCurrency(income);
  totalExpensesEl.textContent = formatCurrency(expenses);

  if (balance < 0) {
    balanceStatusEl.className = 'metric-status negative';
    balanceStatusEl.innerHTML = `<i class="fa-solid fa-arrow-trend-down"></i> Monthly Deficit Warning`;
  } else {
    balanceStatusEl.className = 'metric-status positive';
    balanceStatusEl.innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> Net Financial Standing`;
  }
}

function renderTransactionList(filteredList) {
  if (!transactionCountEl || !transactionListEl || !emptyListStateEl) return;
  transactionCountEl.textContent = `${filteredList.length} ${filteredList.length === 1 ? 'Item' : 'Items'}`;
  transactionListEl.innerHTML = '';

  if (filteredList.length === 0) {
    emptyListStateEl.classList.remove('hidden');
  } else {
    emptyListStateEl.classList.add('hidden');
    const sorted = [...filteredList].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(item => {
      const li = document.createElement('li');
      li.className = 'transaction-item';
      li.dataset.id = item.id;

      const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.Other;
      const isIncome = item.type === 'income';

      li.innerHTML = `
        <div class="item-left">
          <div class="item-icon" style="background: ${config.bg}; color: ${config.color}; border: 1px solid ${config.color}40;">
            <i class="fa-solid ${config.icon}"></i>
          </div>
          <div class="item-info">
            <span class="item-title">${escapeHTML(item.description)}</span>
            <div class="item-meta">
              <span class="category-tag cat-${item.category}">${item.category}</span>
              <span>&bull;</span>
              <span>${formatDisplayDate(item.date)}</span>
            </div>
          </div>
        </div>
        <div class="item-right">
          <span class="item-amount ${isIncome ? 'income' : 'expense'}">
            ${isIncome ? '+' : '-'}${formatCurrency(item.amount)}
          </span>
          <button class="delete-btn" title="Delete Transaction" onclick="handleDeleteTransaction('${item.id}', this.closest('.transaction-item'))">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      transactionListEl.appendChild(li);
    });
  }
}

async function handleAddTransaction(e) {
  e.preventDefault();

  const description = descriptionInput.value.trim();
  let amount = parseFloat(amountInput.value);
  const typeRadio = document.querySelector('input[name="type"]:checked');
  const type = typeRadio ? typeRadio.value : 'expense';
  const category = categoryInput.value;
  const date = dateInput.value;

  if (!description || isNaN(amount) || amount <= 0 || !date) {
    showToast('Please provide valid transaction details.', 'danger');
    return;
  }

  if (currentCurrency === 'USD') {
    amount = amount * USD_TO_LKR_RATE;
  }

  const newTransaction = {
    id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    description,
    amount,
    type,
    category,
    date,
    createdAt: new Date().toISOString()
  };

  // 1. Instantly update local state & cache for instant UI responsiveness
  transactions.unshift(newTransaction);
  saveLocalTransactionsCache();
  populateMonthFilter();
  renderApp();

  // Reset form inputs immediately
  descriptionInput.value = '';
  amountInput.value = '';
  dateInput.value = getFormattedDate(0);
  descriptionInput.focus();

  // 2. Persist to Firestore under current user collection
  if (currentUser && db) {
    try {
      await db.collection('users').doc(currentUser.uid).collection('transactions').doc(newTransaction.id).set(newTransaction);
      console.log('[Firestore] Successfully persisted transaction:', newTransaction.id);
    } catch (err) {
      console.error('[Firestore] Save error:', err);
      showToast('Saved locally (cloud sync offline).', 'warning');
    }
  }

  // Check Category Monthly Spending Limit for Expenses
  if (type === 'expense') {
    const txMonthKey = getMonthKey(date);
    const budgets = getCategoryBudgets();
    const limitLKR = budgets[category] || DEFAULT_CATEGORY_BUDGETS[category] || 30000;

    const currentCategoryTotalLKR = transactions
      .filter(t => t.type === 'expense' && t.category === category && getMonthKey(t.date) === txMonthKey)
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    if (currentCategoryTotalLKR > limitLKR) {
      const exceededLKR = currentCategoryTotalLKR - limitLKR;
      const alertMsg = `⚠️ Monthly Limit Exceeded! ${category} total for ${formatMonthLabel(txMonthKey)} reached ${formatCurrency(currentCategoryTotalLKR)} (Exceeded limit of ${formatCurrency(limitLKR)} by ${formatCurrency(exceededLKR)}).`;

      showToast(alertMsg, 'danger');

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('FinPulse Category Limit Exceeded', {
            body: `Your ${category} expenses reached ${formatCurrency(currentCategoryTotalLKR)}, exceeding your monthly limit of ${formatCurrency(limitLKR)}!`,
            icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png'
          });
        } catch (err) {
          console.warn('System notification error:', err);
        }
      }
    } else {
      showToast(`Added Expense: "${description}"`, 'success');
    }
  } else {
    showToast(`Added Income: "${description}"`, 'success');
  }
}

window.handleDeleteTransaction = async function (id, itemEl) {
  const target = transactions.find(t => t.id === id);
  if (!target) return;

  if (itemEl) itemEl.classList.add('deleting');

  setTimeout(async () => {
    // Instantly remove locally
    transactions = transactions.filter(t => t.id !== id);
    saveLocalTransactionsCache();
    populateMonthFilter();
    renderApp();

    if (currentUser && db) {
      try {
        await db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).delete();
        console.log('[Firestore] Deleted transaction:', id);
      } catch (err) {
        console.error('[Firestore] Delete error:', err);
      }
    }
    showToast(`Removed "${target.description}"`, 'info');
  }, 280);
};

async function confirmClearAll() {
  transactions = [];
  saveLocalTransactionsCache();
  populateMonthFilter();
  renderApp();

  if (currentUser && db) {
    try {
      const userTxsRef = db.collection('users').doc(currentUser.uid).collection('transactions');
      const snapshot = await userTxsRef.get();
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log('[Firestore] Cleared all user transactions.');
    } catch (err) {
      console.error('[Firestore] Clear all error:', err);
    }
  }

  showToast('All transaction records cleared.', 'danger');
}

function showConfirmModal() {
  const modal = confirmModal || document.getElementById('confirmModal');
  if (modal) modal.classList.remove('hidden');
}

function hideConfirmModal() {
  const modal = confirmModal || document.getElementById('confirmModal');
  if (modal) modal.classList.add('hidden');
}

window.confirmClearAll = confirmClearAll;
window.showConfirmModal = showConfirmModal;
window.hideConfirmModal = hideConfirmModal;
window.closeClearAllModal = hideConfirmModal;

function initChart() {
  const ctxEl = document.getElementById('expenseChart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');

  expenseChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        borderColor: currentTheme === 'light' ? '#ffffff' : '#0f172a',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: currentTheme === 'light' ? '#475569' : '#94a3b8',
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
            padding: 14,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: currentTheme === 'light' ? '#ffffff' : '#0f172a',
          titleColor: currentTheme === 'light' ? '#0f172a' : '#f8fafc',
          bodyColor: currentTheme === 'light' ? '#334155' : '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
              return ` ${label}: ${formatCurrency(value)} (${percentage})`;
            }
          }
        }
      },
      animation: { animateScale: true, animateRotate: true, duration: 450, easing: 'easeOutQuart' }
    }
  });
}

function updateChart(monthTransactions) {
  if (!expenseChartInstance || !chartEmptyStateEl || !topExpenseCategoryBadge) return;

  const expenseMap = {};
  let totalExpenseVal = 0;

  monthTransactions.forEach(t => {
    if (t.type === 'expense') {
      const amt = parseFloat(t.amount) || 0;
      expenseMap[t.category] = (expenseMap[t.category] || 0) + amt;
      totalExpenseVal += amt;
    }
  });

  const categories = Object.keys(expenseMap);
  const dataValues = categories.map(cat => {
    const rawVal = expenseMap[cat];
    return currentCurrency === 'USD' ? rawVal / USD_TO_LKR_RATE : rawVal;
  });

  const bgColors = categories.map(cat => (CATEGORY_CONFIG[cat] ? CATEGORY_CONFIG[cat].color : '#64748b'));

  if (categories.length === 0 || totalExpenseVal === 0) {
    chartEmptyStateEl.classList.remove('hidden');
    topExpenseCategoryBadge.textContent = 'Top Category: N/A';
    expenseChartInstance.data.labels = [];
    expenseChartInstance.data.datasets[0].data = [];
    expenseChartInstance.data.datasets[0].backgroundColor = [];
  } else {
    chartEmptyStateEl.classList.add('hidden');

    let topCat = '';
    let maxVal = -1;
    categories.forEach(cat => {
      if (expenseMap[cat] > maxVal) {
        maxVal = expenseMap[cat];
        topCat = cat;
      }
    });

    const topPercentage = ((maxVal / totalExpenseVal) * 100).toFixed(0);
    topExpenseCategoryBadge.textContent = `Top: ${topCat} (${topPercentage}%)`;

    expenseChartInstance.data.labels = categories;
    expenseChartInstance.data.datasets[0].data = dataValues;
    expenseChartInstance.data.datasets[0].backgroundColor = bgColors;
  }

  expenseChartInstance.update();
}

function formatCurrency(val) {
  let convertedVal = val;
  if (currentCurrency === 'USD') {
    convertedVal = val / USD_TO_LKR_RATE;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(convertedVal);
  } else {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2
    }).format(convertedVal);
  }
}

function formatCurrencyShort(val) {
  const sym = currentCurrency === 'USD' ? '$' : 'Rs.';
  const absVal = Math.abs(val);
  let formatted = absVal;
  if (absVal >= 1000000) {
    formatted = (absVal / 1000000).toFixed(1) + 'M';
  } else if (absVal >= 1000) {
    formatted = (absVal / 1000).toFixed(1) + 'k';
  } else {
    formatted = absVal.toFixed(0);
  }
  return (val < 0 ? '-' : '') + sym + ' ' + formatted;
}

function initMonthlyFinancialChart() {
  const ctxEl = document.getElementById('monthlyFinancialChart');
  if (!ctxEl) return;
  const ctx = ctxEl.getContext('2d');

  const isLight = currentTheme === 'light';
  const textColor = isLight ? '#475569' : '#94a3b8';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';

  monthlyFinancialChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Total Income',
          data: [],
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: '#10b981',
          order: 2
        },
        {
          label: 'Total Expense',
          data: [],
          backgroundColor: 'rgba(244, 63, 94, 0.85)',
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: '#f43f5e',
          order: 2
        },
        {
          label: 'Net Balance',
          data: [],
          type: 'line',
          borderColor: '#818cf8',
          backgroundColor: 'rgba(129, 140, 248, 0.2)',
          borderWidth: 3,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
            usePointStyle: true,
            boxWidth: 8,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: isLight ? '#ffffff' : '#0f172a',
          titleColor: isLight ? '#0f172a' : '#f8fafc',
          bodyColor: isLight ? '#334155' : '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            label: function (context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              return ` ${label}: ${formatCurrency(value)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' }
          }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
            callback: function (val) {
              return formatCurrencyShort(val);
            }
          }
        }
      },
      animation: { duration: 500, easing: 'easeOutQuart' }
    }
  });
}

function updateMonthlyFinancialChart() {
  if (!monthlyFinancialChartInstance) return;

  const monthlyMap = {};

  transactions.forEach(t => {
    const key = getMonthKey(t.date);
    if (!key) return;

    if (!monthlyMap[key]) {
      monthlyMap[key] = { income: 0, expense: 0 };
    }

    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      monthlyMap[key].income += amt;
    } else {
      monthlyMap[key].expense += amt;
    }
  });

  const sortedKeys = Object.keys(monthlyMap).sort((a, b) => a.localeCompare(b));
  const labels = sortedKeys.map(key => formatMonthLabel(key));

  const incomeData = sortedKeys.map(key => {
    const val = monthlyMap[key].income;
    return currentCurrency === 'USD' ? val / USD_TO_LKR_RATE : val;
  });

  const expenseData = sortedKeys.map(key => {
    const val = monthlyMap[key].expense;
    return currentCurrency === 'USD' ? val / USD_TO_LKR_RATE : val;
  });

  const netData = sortedKeys.map(key => {
    const val = monthlyMap[key].income - monthlyMap[key].expense;
    return currentCurrency === 'USD' ? val / USD_TO_LKR_RATE : val;
  });

  const emptyEl = document.getElementById('monthlyChartEmptyState');

  if (sortedKeys.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    monthlyFinancialChartInstance.data.labels = [];
    monthlyFinancialChartInstance.data.datasets[0].data = [];
    monthlyFinancialChartInstance.data.datasets[1].data = [];
    monthlyFinancialChartInstance.data.datasets[2].data = [];
  } else {
    if (emptyEl) emptyEl.classList.add('hidden');
    monthlyFinancialChartInstance.data.labels = labels;
    monthlyFinancialChartInstance.data.datasets[0].data = incomeData;
    monthlyFinancialChartInstance.data.datasets[1].data = expenseData;
    monthlyFinancialChartInstance.data.datasets[2].data = netData;
  }

  const isLight = currentTheme === 'light';
  const textColor = isLight ? '#475569' : '#94a3b8';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';

  if (monthlyFinancialChartInstance.options.scales.x) {
    monthlyFinancialChartInstance.options.scales.x.ticks.color = textColor;
    monthlyFinancialChartInstance.options.scales.x.grid.color = gridColor;
  }
  if (monthlyFinancialChartInstance.options.scales.y) {
    monthlyFinancialChartInstance.options.scales.y.ticks.color = textColor;
    monthlyFinancialChartInstance.options.scales.y.grid.color = gridColor;
  }
  if (monthlyFinancialChartInstance.options.plugins.legend) {
    monthlyFinancialChartInstance.options.plugins.legend.labels.color = textColor;
  }

  monthlyFinancialChartInstance.update();

  let totalIncAll = 0;
  let totalExpAll = 0;
  transactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') totalIncAll += amt;
    else totalExpAll += amt;
  });

  const incBadge = document.getElementById('monthlyChartIncomeBadge');
  const expBadge = document.getElementById('monthlyChartExpenseBadge');
  const savBadge = document.getElementById('monthlyChartSavingsBadge');

  if (incBadge) incBadge.innerHTML = `<i class="fa-solid fa-arrow-down-left"></i> Income: ${formatCurrency(totalIncAll)}`;
  if (expBadge) expBadge.innerHTML = `<i class="fa-solid fa-arrow-up-right"></i> Expense: ${formatCurrency(totalExpAll)}`;
  if (savBadge) savBadge.innerHTML = `<i class="fa-solid fa-wallet"></i> Net: ${formatCurrency(totalIncAll - totalExpAll)}`;
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr + 'T00:00:00');
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(dateObj);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'danger') iconClass = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${escapeHTML(message)}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3200);
}

// PDF Export using jsPDF & jspdf-autotable
document.getElementById('exportPdfBtn')?.addEventListener('click', generatePdfReport);

function generatePdfReport() {
  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      showToast('PDF library not loaded. Please check your network connection.', 'danger');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 14;

    // Active transactions list (uses month filter if applied)
    const activeTx = (typeof getFilteredTransactions === 'function') ? getFilteredTransactions() : transactions;

    // Financial totals calculation
    let totalIncome = 0;
    let totalExpenses = 0;
    activeTx.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') totalIncome += amt;
      else totalExpenses += amt;
    });
    const totalBalance = totalIncome - totalExpenses;

    const curr = (typeof currentCurrency !== 'undefined') ? currentCurrency : 'LKR';
    const currSymbol = curr === 'USD' ? '$' : 'Rs. ';

    // Currency formatting helper
    const formatCurr = (num) => {
      return `${currSymbol}${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    };

    // User details string
    let userEmailStr = 'Guest User (Local Mode)';
    if (typeof currentUser !== 'undefined' && currentUser) {
      userEmailStr = currentUser.displayName || currentUser.email || 'Registered User';
    } else {
      const userEmailEl = document.getElementById('userEmailText');
      if (userEmailEl && userEmailEl.textContent) {
        userEmailStr = userEmailEl.textContent.trim();
      }
    }

    const reportDateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // ==========================================
    // 1. HEADER SECTION (Executive Banner)
    // ==========================================
    // Slate Top Banner (#1e293b)
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 32, 'F');

    // Bottom Indigo Accent Line (#4f46e5)
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 31, pageWidth, 1.5, 'F');

    // Title & Subtitle inside Banner
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text('FinPulse Financial Report', margin, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text('Executive Personal Expense & Financial Statement', margin, 21);

    // Right-aligned Metadata
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(226, 232, 240);
    doc.text(`User: ${userEmailStr}`, pageWidth - margin, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${reportDateStr}`, pageWidth - margin, 18, { align: 'right' });
    doc.text(`Base Currency: ${curr}`, pageWidth - margin, 24, { align: 'right' });

    // ==========================================
    // 2. SUMMARY CARDS / OVERVIEW SECTION
    // ==========================================
    const startY = 38;
    const cardGap = 4;
    const availableWidth = pageWidth - (margin * 2);
    const cardWidth = (availableWidth - (cardGap * 2)) / 3;
    const cardHeight = 22;

    // Card 1: Total Balance
    drawMetricCard(
      doc, 
      margin, 
      startY, 
      cardWidth, 
      cardHeight, 
      'TOTAL BALANCE', 
      (totalBalance >= 0 ? '' : '-') + formatCurr(totalBalance), 
      totalBalance >= 0 ? [16, 185, 129] : [239, 68, 68], 
      [248, 250, 252], 
      [226, 232, 240]
    );

    // Card 2: Total Income
    drawMetricCard(
      doc, 
      margin + cardWidth + cardGap, 
      startY, 
      cardWidth, 
      cardHeight, 
      'TOTAL INCOME', 
      '+' + formatCurr(totalIncome), 
      [5, 150, 105], 
      [240, 253, 244], 
      [187, 247, 208]
    );

    // Card 3: Total Expenses
    drawMetricCard(
      doc, 
      margin + (cardWidth + cardGap) * 2, 
      startY, 
      cardWidth, 
      cardHeight, 
      'TOTAL EXPENSES', 
      '-' + formatCurr(totalExpenses), 
      [220, 38, 38], 
      [254, 242, 242], 
      [254, 202, 202]
    );

    // ==========================================
    // 3. TRANSACTIONS TABLE (jspdf-autotable)
    // ==========================================
    const tableStartY = startY + cardHeight + 10;

    // Section Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Transactions Ledger (${activeTx.length} Record${activeTx.length === 1 ? '' : 's'})`, margin, tableStartY - 3);

    // Table Columns & Rows setup
    const tableColumns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Description', dataKey: 'description' },
      { header: 'Category', dataKey: 'category' },
      { header: 'Type', dataKey: 'type' },
      { header: 'Amount', dataKey: 'amount' }
    ];

    const tableRows = activeTx.map(t => {
      const amtNum = parseFloat(t.amount) || 0;
      const isIncome = t.type === 'income';
      const formattedAmt = `${isIncome ? '+' : '-'}${currSymbol}${amtNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
      
      return {
        date: t.date || 'N/A',
        description: t.description || 'Uncategorized',
        category: t.category || 'General',
        type: isIncome ? 'INCOME' : 'EXPENSE',
        amount: formattedAmt,
        rawType: t.type
      };
    });

    const tableOptions = {
      columns: tableColumns,
      body: tableRows,
      startY: tableStartY,
      margin: { left: margin, right: margin, bottom: 20 },
      theme: 'grid',
      headStyles: {
        fillColor: [49, 46, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
        cellPadding: 3.5
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8.5,
        cellPadding: 3,
        lineColor: [241, 245, 249]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        date: { cellWidth: 26, halign: 'left' },
        description: { cellWidth: 'auto', halign: 'left' },
        category: { cellWidth: 32, halign: 'left' },
        type: { cellWidth: 25, halign: 'center' },
        amount: { cellWidth: 42, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function (data) {
        if (data.section === 'body') {
          const rowData = tableRows[data.row.index];
          if (rowData) {
            const isIncome = rowData.rawType === 'income';
            if (data.column.dataKey === 'type') {
              data.cell.styles.textColor = isIncome ? [4, 120, 87] : [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.dataKey === 'amount') {
              data.cell.styles.textColor = isIncome ? [5, 150, 105] : [220, 38, 38];
            }
          }
        }
      },
      didDrawPage: function (data) {
        const totalPages = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal ? doc.internal.getNumberOfPages() : 1);
        const currentPage = data.pageNumber;

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('FinPulse Financial Report • Confidential', margin, pageHeight - 6);

        doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      }
    };

    if (typeof doc.autoTable === 'function') {
      doc.autoTable(tableOptions);
    } else if (typeof window.autoTable === 'function') {
      window.autoTable(doc, tableOptions);
    } else if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
      window.jspdf.autoTable(doc, tableOptions);
    } else {
      throw new Error('autoTable plugin is not initialized.');
    }

    doc.save(`FinPulse-Financial-Report-${new Date().toISOString().substring(0, 10)}.pdf`);
    showToast('PDF Financial Report generated successfully!', 'success');

  } catch (error) {
    console.error('jsPDF / jspdf-autotable Error:', error);
    showToast('Failed to generate PDF report: ' + (error.message || 'Unknown error'), 'danger');
  }
}

// Helper function to draw metric card boxes in PDF
function drawMetricCard(doc, x, y, width, height, title, valueStr, valueColor, bgColor, borderColor) {
  doc.setFillColor(...bgColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(title, x + 3.5, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...valueColor);
  doc.text(valueStr, x + 3.5, y + 15);
}

// JSON Export Backup Handler (Strictly for Home Transactions & Budget Data)
function handleExportJson() {
  try {
    if (transactions.length === 0) {
      showToast('No transaction records available to backup.', 'danger');
      return;
    }

    const backupPayload = {
      app: 'FinPulse',
      type: 'HomeTransactionsBackup',
      version: CURRENT_APP_VERSION,
      exportedAt: new Date().toISOString(),
      homeData: transactions
    };

    const dataStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');

    downloadAnchor.href = url;
    downloadAnchor.download = `FinPulse-HomeTransactions-Backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);

    showToast('Home transactions backup downloaded successfully!', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Failed to generate backup file.', 'danger');
  }
}

document.getElementById('exportJsonBtn')?.addEventListener('click', handleExportJson);

// JSON Import Restore
document.getElementById('importJsonFile')?.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const parsedData = JSON.parse(e.target.result);

      let importedHomeData = [];
      let importedLoans = [];
      let importedFds = [];

      if (Array.isArray(parsedData)) {
        // Legacy backup format: Array of home transactions
        importedHomeData = parsedData.filter(validateTransaction);
      } else if (typeof parsedData === 'object' && parsedData !== null) {
        // Structured backup format
        if (Array.isArray(parsedData.homeData)) {
          importedHomeData = parsedData.homeData.filter(validateTransaction);
        } else if (Array.isArray(parsedData.transactions)) {
          importedHomeData = parsedData.transactions.filter(validateTransaction);
        }

        if (parsedData.fdLoanData && typeof parsedData.fdLoanData === 'object') {
          if (Array.isArray(parsedData.fdLoanData.loans)) {
            importedLoans = parsedData.fdLoanData.loans;
          }
          if (Array.isArray(parsedData.fdLoanData.fixedDeposits)) {
            importedFds = parsedData.fdLoanData.fixedDeposits;
          }
        } else {
          if (Array.isArray(parsedData.loans)) importedLoans = parsedData.loans;
          if (Array.isArray(parsedData.fixedDeposits)) importedFds = parsedData.fixedDeposits;
        }
      } else {
        throw new Error('Invalid JSON format');
      }

      if (importedHomeData.length === 0 && importedLoans.length === 0 && importedFds.length === 0) {
        showToast('No valid transaction, FD, or Loan records found in file.', 'danger');
        return;
      }

      let restoredSummary = [];

      // Restore Home Data
      if (importedHomeData.length > 0) {
        transactions = importedHomeData;
        saveLocalTransactionsCache();
        restoredSummary.push(`${importedHomeData.length} transactions`);

        if (currentUser && db) {
          const batch = db.batch();
          importedHomeData.forEach(t => {
            const docRef = db.collection('users').doc(currentUser.uid).collection('transactions').doc(t.id);
            batch.set(docRef, t);
          });
          await batch.commit();
        }
      }

      // Restore FD & Loan Data
      if (importedLoans.length > 0 || importedFds.length > 0) {
        if (importedLoans.length > 0) loans = importedLoans;
        if (importedFds.length > 0) fixedDeposits = importedFds;

        selectedLoanId = loans.length > 0 ? loans[0].id : null;
        selectedFdId = fixedDeposits.length > 0 ? fixedDeposits[0].id : null;

        saveLocalLoansAndFdsCache();

        if (importedLoans.length > 0) restoredSummary.push(`${importedLoans.length} loans`);
        if (importedFds.length > 0) restoredSummary.push(`${importedFds.length} FDs`);

        if (currentUser && db) {
          const batch = db.batch();
          importedLoans.forEach(l => {
            const docRef = db.collection('users').doc(currentUser.uid).collection('loans').doc(l.id);
            batch.set(docRef, l);
          });
          importedFds.forEach(f => {
            const docRef = db.collection('users').doc(currentUser.uid).collection('fixedDeposits').doc(f.id);
            batch.set(docRef, f);
          });
          await batch.commit();
        }
      }

      populateMonthFilter();
      renderApp();
      renderFdLoanModule();

      showToast(`Backup restored: ${restoredSummary.join(', ')}!`, 'success');
    } catch (error) {
      console.error('Import error:', error);
      showToast('Invalid backup file format.', 'danger');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
});

/* ==========================================================================
   Category Monthly Spending Limits & Notification Functions
   ========================================================================== */

function getCategoryBudgets() {
  try {
    const saved = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error reading budgets:', e);
  }
  return { ...DEFAULT_CATEGORY_BUDGETS };
}

function saveCategoryBudgets(budgets) {
  try {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets));
  } catch (e) {
    console.error('Error writing budgets:', e);
  }
}

function renderCategoryBudgets() {
  const budgetListEl = document.getElementById('categoryBudgetList');
  const alertBoxEl = document.getElementById('budgetExceededAlert');
  if (!budgetListEl) return;

  const budgets = getCategoryBudgets();

  let targetMonthKey = filterMonthSelect ? filterMonthSelect.value : 'all';
  if (targetMonthKey === 'all') {
    targetMonthKey = new Date().toISOString().substring(0, 7);
  }

  const categoryTotals = {};
  Object.keys(CATEGORY_CONFIG).forEach(cat => {
    if (cat !== 'Salary') {
      categoryTotals[cat] = 0;
    }
  });

  transactions.forEach(t => {
    if (t.type === 'expense' && getMonthKey(t.date) === targetMonthKey) {
      if (categoryTotals[t.category] !== undefined) {
        categoryTotals[t.category] += parseFloat(t.amount) || 0;
      }
    }
  });

  const monthLabel = formatMonthLabel(targetMonthKey);
  const exceededCategories = [];
  const warningCategories = [];

  budgetListEl.innerHTML = '';

  Object.keys(categoryTotals).forEach(cat => {
    const spentLKR = categoryTotals[cat];
    const limitLKR = budgets[cat] || DEFAULT_CATEGORY_BUDGETS[cat] || 30000;
    const ratio = limitLKR > 0 ? (spentLKR / limitLKR) * 100 : 0;

    if (spentLKR > limitLKR) {
      exceededCategories.push({
        category: cat,
        spentLKR,
        limitLKR,
        exceededByLKR: spentLKR - limitLKR
      });
    } else if (ratio >= 80) {
      warningCategories.push({
        category: cat,
        spentLKR,
        limitLKR,
        ratio
      });
    }

    const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Other;
    let barColor = '#10b981';
    let statusText = `${Math.round(ratio)}% of monthly limit`;

    if (ratio > 100) {
      barColor = '#f43f5e';
      statusText = `<span style="color: #f43f5e; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> Exceeded by ${formatCurrency(spentLKR - limitLKR)}</span>`;
    } else if (ratio >= 80) {
      barColor = '#f59e0b';
      statusText = `<span style="color: #f59e0b; font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Near limit (${Math.round(ratio)}%)</span>`;
    }

    const categoryItem = document.createElement('div');
    categoryItem.className = 'budget-item-row';
    categoryItem.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem; font-size: 0.85rem;">
        <div style="display: flex; align-items: center; gap: 0.45rem;">
          <i class="fa-solid ${config.icon}" style="color: ${config.color};"></i>
          <span style="font-weight: 600; color: var(--text-primary);">${cat}</span>
        </div>
        <div style="text-align: right;">
          <span style="font-weight: 700; color: ${ratio > 100 ? '#f43f5e' : 'var(--text-primary)'};">${formatCurrency(spentLKR)}</span>
          <span style="color: var(--text-muted); font-size: 0.78rem;"> / ${formatCurrency(limitLKR)}</span>
        </div>
      </div>
      <div class="progress-bar-track" style="height: 7px; background: rgba(255, 255, 255, 0.08); border-radius: 99px; overflow: hidden; position: relative;">
        <div class="progress-bar-fill" style="width: ${Math.min(ratio, 100)}%; height: 100%; background: ${barColor}; transition: width 0.4s ease; border-radius: 99px;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-muted);">
        <span>${statusText}</span>
        <span>Limit: ${formatCurrency(limitLKR)}</span>
      </div>
    `;
    budgetListEl.appendChild(categoryItem);
  });

  if (alertBoxEl) {
    if (exceededCategories.length > 0) {
      alertBoxEl.classList.remove('hidden');
      alertBoxEl.innerHTML = `
        <div class="alert-content-exceeded">
          <div style="display: flex; align-items: flex-start; gap: 0.6rem;">
            <i class="fa-solid fa-bell-exclamation" style="color: #f43f5e; font-size: 1.15rem; margin-top: 0.1rem; flex-shrink: 0;"></i>
            <div>
              <strong style="color: #fecdd3; font-size: 0.85rem;">Budget Limit Exceeded Alert (${monthLabel})</strong>
              <ul style="margin: 0.35rem 0 0 1rem; padding: 0; font-size: 0.8rem; color: #fda4af;">
                ${exceededCategories.map(item => `
                  <li><strong>${item.category}:</strong> Spent ${formatCurrency(item.spentLKR)} (Exceeded limit of ${formatCurrency(item.limitLKR)} by ${formatCurrency(item.exceededByLKR)})</li>
                `).join('')}
              </ul>
            </div>
          </div>
        </div>
      `;
    } else if (warningCategories.length > 0) {
      alertBoxEl.classList.remove('hidden');
      alertBoxEl.innerHTML = `
        <div class="alert-content-warning">
          <div style="display: flex; align-items: flex-start; gap: 0.6rem;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b; font-size: 1.15rem; margin-top: 0.1rem; flex-shrink: 0;"></i>
            <div>
              <strong style="color: #fef3c7; font-size: 0.85rem;">Budget Warning (${monthLabel})</strong>
              <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: #fde68a;">
                ${warningCategories.map(item => `${item.category} (${Math.round(item.ratio)}% of limit)`).join(', ')} approaching monthly threshold.
              </p>
            </div>
          </div>
        </div>
      `;
    } else {
      alertBoxEl.classList.add('hidden');
      alertBoxEl.innerHTML = '';
    }
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Desktop browser notifications are not supported by your browser.', 'info');
    return;
  }
  if (Notification.permission === 'granted') {
    showToast('Desktop alerts are already enabled for budget limits!', 'success');
    return;
  }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showToast('Desktop notifications enabled for budget alerts!', 'success');
      } else {
        showToast('Notification permission was not granted.', 'info');
      }
    });
  } else {
    showToast('Notifications are blocked in your browser settings.', 'info');
  }
}

function openBudgetModal() {
  const modal = document.getElementById('budgetModal');
  const container = document.getElementById('budgetInputsContainer');
  if (!modal || !container) return;

  const budgets = getCategoryBudgets();
  container.innerHTML = '';

  Object.keys(CATEGORY_CONFIG).forEach(cat => {
    if (cat === 'Salary') return;

    const limitLKR = budgets[cat] || DEFAULT_CATEGORY_BUDGETS[cat] || 30000;
    const currentVal = currentCurrency === 'USD' ? (limitLKR / USD_TO_LKR_RATE).toFixed(2) : limitLKR;
    const config = CATEGORY_CONFIG[cat];

    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
      <label style="display: flex; align-items: center; gap: 0.45rem; font-weight: 600;">
        <i class="fa-solid ${config.icon}" style="color: ${config.color};"></i>
        ${cat} Monthly Limit (${currentCurrency})
      </label>
      <div class="input-wrapper">
        <span class="input-icon" style="font-weight: 700; font-size: 0.85rem;">${currentCurrency === 'USD' ? '$' : 'Rs.'}</span>
        <input type="number" data-category="${cat}" class="category-limit-input" value="${currentVal}" step="0.01" min="0" required>
      </div>
    `;
    container.appendChild(group);
  });

  modal.classList.remove('hidden');
}

function closeBudgetModal() {
  const modal = document.getElementById('budgetModal');
  if (modal) modal.classList.add('hidden');
}

function handleSaveBudgets(e) {
  e.preventDefault();
  const inputs = document.querySelectorAll('.category-limit-input');
  const newBudgets = getCategoryBudgets();

  inputs.forEach(input => {
    const cat = input.dataset.category;
    let val = parseFloat(input.value);
    if (isNaN(val) || val < 0) val = 0;

    if (currentCurrency === 'USD') {
      val = val * USD_TO_LKR_RATE;
    }

    newBudgets[cat] = val;
  });

  saveCategoryBudgets(newBudgets);
  closeBudgetModal();
  renderApp();
  showToast('Category monthly spending limits saved!', 'success');
}

/* ==========================================================================
   PWA Service Worker & In-App Version Check Mechanism
   ========================================================================== */
let swRegistration = null;
let swWaitingWorker = null;
let currentBannerVersion = '1.0.3';

/**
 * Registers the PWA Service Worker and listens for update lifecycle events.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        swRegistration = reg;
        console.log('[PWA] Service Worker registered with scope:', reg.scope);

        // Check if an updated service worker is already waiting
        if (reg.waiting) {
          swWaitingWorker = reg.waiting;
          showUpdateBanner('v1.0.3', 'A new service worker update is ready to install.');
        }

        // Listen for new service worker installation
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[PWA] New version installed and waiting for activation.');
                swWaitingWorker = installingWorker;
                showUpdateBanner('v1.0.3', 'A new version of FinPulse has been cached. Click below to reload.');
              }
            }
          };
        };
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });

    // Auto-reload window when the new service worker takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

/**
 * Compares two semver version strings (e.g. "1.0.3" vs "1.0.2")
 */
function isNewerVersion(remoteVer, currentVer) {
  if (!remoteVer || !currentVer) return false;
  const parse = (v) => v.toString().replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const r = parse(remoteVer);
  const c = parse(currentVer);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rNum = r[i] || 0;
    const cNum = c[i] || 0;
    if (rNum > cNum) return true;
    if (rNum < cNum) return false;
  }
  return false;
}

/**
 * Fetches version.json from the server and compares against CURRENT_APP_VERSION.
 * @param {boolean} isManualCheck - Whether triggered explicitly by user click on version badge
 */
async function checkAppVersion(isManualCheck = false) {
  const versionTextEl = document.getElementById('appVersionText');
  if (versionTextEl) {
    versionTextEl.innerText = `v${CURRENT_APP_VERSION}`;
  }

  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      if (isManualCheck) {
        showUpdateBanner(CURRENT_APP_VERSION, `FinPulse v${CURRENT_APP_VERSION} is active.`, true);
        showToast(`Running FinPulse v${CURRENT_APP_VERSION}`, 'info');
      }
      return;
    }

    const data = await res.json();
    const latestVersion = data.version || '1.0.3';
    const releaseNotes = data.releaseNotes || 'A new update with performance enhancements and offline support is available.';

    if (data.downloadUrl) {
      const downloadBtn = document.getElementById('downloadReleaseBtn');
      if (downloadBtn) downloadBtn.href = data.downloadUrl;
    }

    if (isNewerVersion(latestVersion, CURRENT_APP_VERSION)) {
      showUpdateBanner(latestVersion, releaseNotes, isManualCheck);
      if (isManualCheck) {
        showToast(`🚀 New update v${latestVersion} available!`, 'success');
      }
    } else {
      if (isManualCheck) {
        showUpdateBanner(latestVersion, releaseNotes, true);
        showToast(`FinPulse is up to date (v${CURRENT_APP_VERSION})!`, 'success');
      }
    }
  } catch (err) {
    console.warn('Failed to check app version:', err);
    if (isManualCheck) {
      showToast(`Currently running FinPulse v${CURRENT_APP_VERSION}`, 'info');
    }
  }
}

/**
 * Displays the glassmorphism Update Banner unless dismissed for this version (or if forceShow is true)
 * @param {string} version - Version string (e.g. "1.0.3")
 * @param {string} notes - Release notes or description
 * @param {boolean} forceShow - If true (e.g. user manually clicked version badge), bypasses dismissed flag check
 */
function showUpdateBanner(version, notes, forceShow = false) {
  const rawVer = version ? version.toString().replace(/^v/i, '') : '1.0.3';
  currentBannerVersion = rawVer;

  const dismissedVer = localStorage.getItem('dismissedVersion') || localStorage.getItem('finpulse_dismissed_version');

  // Check if notification was dismissed for this version and forceShow is not set
  if (!forceShow && dismissedVer === rawVer) {
    console.log(`[PWA] Update banner for v${rawVer} was previously dismissed by user.`);
    return;
  }

  const banner = document.getElementById('updateBanner');
  const verText = document.getElementById('latestVersionText');
  const notesText = document.getElementById('updateBannerNotes');

  if (verText) verText.innerText = `v${rawVer}`;
  if (notesText && notes) notesText.innerText = notes;
  if (banner) banner.classList.remove('hidden');
}

/**
 * Dismisses the Update Banner and stores the dismissedVersion flag in localStorage
 */
function dismissUpdateBanner() {
  const banner = document.getElementById('updateBanner');
  if (banner) banner.classList.add('hidden');

  const rawVer = currentBannerVersion ? currentBannerVersion.replace(/^v/i, '') : '1.0.3';
  localStorage.setItem('dismissedVersion', rawVer);
  localStorage.setItem('finpulse_dismissed_version', rawVer);
  console.log(`[PWA] User dismissed update notification for v${rawVer}. Flag saved in localStorage.`);
}

/**
 * Sends SKIP_WAITING to the waiting Service Worker and reloads the app.
 */
function applyAppUpdate() {
  if (swWaitingWorker) {
    swWaitingWorker.postMessage({ action: 'skipWaiting', type: 'SKIP_WAITING' });
  } else if (swRegistration && swRegistration.waiting) {
    swRegistration.waiting.postMessage({ action: 'skipWaiting', type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

// Expose functions to global window object
window.checkAppVersion = checkAppVersion;
window.applyAppUpdate = applyAppUpdate;
window.dismissUpdateBanner = dismissUpdateBanner;

/* ==========================================================================
   FD & LOAN TRACKER MODULE LOGIC
   ========================================================================== */

// Storage Keys
const LOANS_STORAGE_KEY = 'finpulse_loans_v1';
const FDS_STORAGE_KEY = 'finpulse_fds_v1';

// State
let loans = [];
let fixedDeposits = [];
let selectedLoanId = null;
let selectedFdId = null;
let currentModuleView = 'dashboard'; // 'dashboard' or 'fdLoan'
let currentFdLoanSubtab = 'loans'; // 'loans' or 'fds'
let unsubscribeLoans = null;
let unsubscribeFds = null;

// Initial Demo Data (Empty for clean state)
const DEMO_LOANS = [];
const DEMO_FDS = [];

// Helper: Format Currency across modules
function formatCurrency(amountLKR) {
  const val = parseFloat(amountLKR) || 0;
  if (currentCurrency === 'USD') {
    const usdVal = val / USD_TO_LKR_RATE;
    return '$' + usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return 'Rs. ' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

// --------------------------------------------------------------------------
// Calculation Core
// --------------------------------------------------------------------------

function calculateLoanEMI(principal, annualRate, tenureMonths) {
  const p = parseFloat(principal) || 0;
  const rate = parseFloat(annualRate) || 0;
  const n = parseInt(tenureMonths) || 1;

  if (p <= 0 || n <= 0) return 0;
  const r = rate / 12 / 100;
  if (r === 0) return Math.round((p / n) * 100) / 100;

  const emi = p * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi * 100) / 100;
}

function generateAmortizationSchedule(loan) {
  if (!loan) return [];
  const p = parseFloat(loan.principal) || 0;
  const rate = parseFloat(loan.annualRate) || 0;
  const n = parseInt(loan.tenureMonths) || 1;
  const emi = calculateLoanEMI(p, rate, n);
  const r = rate / 12 / 100;

  let balance = p;
  const schedule = [];
  const startDt = loan.startDate ? new Date(loan.startDate + 'T00:00:00') : new Date();

  for (let m = 1; m <= n; m++) {
    const dueDateObj = new Date(startDt.getFullYear(), startDt.getMonth() + m - 1, startDt.getDate());
    const dueDateStr = dueDateObj.toISOString().substring(0, 10);

    const interest = Math.round(balance * r * 100) / 100;
    let principalPaid = Math.round((emi - interest) * 100) / 100;

    if (m === n || balance - principalPaid < 0) {
      principalPaid = balance;
      balance = 0;
    } else {
      balance = Math.round((balance - principalPaid) * 100) / 100;
    }

    const isPaid = Array.isArray(loan.paidMonths) && loan.paidMonths.includes(m);

    schedule.push({
      monthNum: m,
      dueDate: dueDateStr,
      emiAmount: emi,
      interestPaid: interest,
      principalPaid: principalPaid,
      remainingBalance: balance,
      isPaid
    });
  }

  return schedule;
}

function calculateFdEarnings(depositAmount, annualRate, tenureMonths, payoutFrequency) {
  const p = parseFloat(depositAmount) || 0;
  const rate = parseFloat(annualRate) || 0;
  const n = parseInt(tenureMonths) || 1;

  if (p <= 0 || n <= 0) return { monthlyInterest: 0, totalInterest: 0, maturityAmount: 0 };

  const r = rate / 100;
  let monthlyInterest = 0;
  let totalInterest = 0;

  if (payoutFrequency === 'monthly') {
    monthlyInterest = Math.round(((p * r) / 12) * 100) / 100;
    totalInterest = Math.round((monthlyInterest * n) * 100) / 100;
  } else {
    totalInterest = Math.round((p * r * (n / 12)) * 100) / 100;
    monthlyInterest = Math.round((totalInterest / n) * 100) / 100;
  }

  const maturityAmount = Math.round((p + totalInterest) * 100) / 100;
  return { monthlyInterest, totalInterest, maturityAmount };
}

function generateFdSchedule(fd) {
  if (!fd) return [];
  const p = parseFloat(fd.depositAmount) || 0;
  const n = parseInt(fd.tenureMonths) || 1;
  const { monthlyInterest } = calculateFdEarnings(p, fd.annualRate, n, fd.payoutFrequency);
  const startDt = fd.startDate ? new Date(fd.startDate + 'T00:00:00') : new Date();

  const schedule = [];
  for (let m = 1; m <= n; m++) {
    const payoutDtObj = new Date(startDt.getFullYear(), startDt.getMonth() + m - 1, startDt.getDate());
    const payoutDateStr = payoutDtObj.toISOString().substring(0, 10);
    const cumulativeInterest = Math.round(monthlyInterest * m * 100) / 100;
    const isCollected = Array.isArray(fd.collectedMonths) && fd.collectedMonths.includes(m);

    schedule.push({
      monthNum: m,
      payoutDate: payoutDateStr,
      interestEarned: monthlyInterest,
      cumulativeInterest,
      principalValue: p,
      isCollected
    });
  }

  return schedule;
}

// --------------------------------------------------------------------------
// Persistence Core
// --------------------------------------------------------------------------

function loadLocalLoansAndFdsCache() {
  try {
    const storedFdLoanData = localStorage.getItem(FD_LOAN_STORAGE_KEY);
    if (storedFdLoanData) {
      const parsed = JSON.parse(storedFdLoanData);
      loans = Array.isArray(parsed.loans) ? parsed.loans : [];
      fixedDeposits = Array.isArray(parsed.fixedDeposits) ? parsed.fixedDeposits : [];
    } else {
      const storedLoans = localStorage.getItem(LOANS_STORAGE_KEY);
      loans = storedLoans ? JSON.parse(storedLoans) : [];

      const storedFds = localStorage.getItem(FDS_STORAGE_KEY);
      fixedDeposits = storedFds ? JSON.parse(storedFds) : [];
    }
  } catch (e) {
    console.error('Error reading FD/Loan cache:', e);
    loans = [];
    fixedDeposits = [];
  }

  selectedLoanId = loans.length > 0 ? loans[0].id : null;
  selectedFdId = fixedDeposits.length > 0 ? fixedDeposits[0].id : null;
}

function saveLocalLoansAndFdsCache() {
  try {
    const payload = {
      loans,
      fixedDeposits,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(FD_LOAN_STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(LOANS_STORAGE_KEY, JSON.stringify(loans));
    localStorage.setItem(FDS_STORAGE_KEY, JSON.stringify(fixedDeposits));
  } catch (e) {
    console.error('Error saving FD/Loan cache:', e);
  }
}

function saveLocalLoansCache() {
  saveLocalLoansAndFdsCache();
}

function saveLocalFdsCache() {
  saveLocalLoansAndFdsCache();
}

function subscribeToUserLoansAndFds(userId) {
  if (!db) return;

  if (unsubscribeLoans) unsubscribeLoans();
  if (unsubscribeFds) unsubscribeFds();

  const loansRef = db.collection('users').doc(userId).collection('loans');
  unsubscribeLoans = loansRef.onSnapshot(snapshot => {
    const items = [];
    snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    loans = items;
    saveLocalLoansCache();
    if (!selectedLoanId && loans.length > 0) {
      selectedLoanId = loans[0].id;
    } else if (loans.length === 0) {
      selectedLoanId = null;
    }
    renderFdLoanModule();
  }, err => console.error('Error listening to loans:', err));

  const fdsRef = db.collection('users').doc(userId).collection('fixedDeposits');
  unsubscribeFds = fdsRef.onSnapshot(snapshot => {
    const items = [];
    snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    fixedDeposits = items;
    saveLocalFdsCache();
    if (!selectedFdId && fixedDeposits.length > 0) {
      selectedFdId = fixedDeposits[0].id;
    } else if (fixedDeposits.length === 0) {
      selectedFdId = null;
    }
    renderFdLoanModule();
  }, err => console.error('Error listening to FDs:', err));
}

// --------------------------------------------------------------------------
// Render Functions
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Smart Notification & Alert System Logic
// --------------------------------------------------------------------------

let dismissedAlerts = new Set();

function dismissAlert(alertId) {
  dismissedAlerts.add(alertId);
  renderLoanAlertsSystem();
  renderFdAlertsSystem();
}

function selectLoanAndFocus(loanId) {
  selectedLoanId = loanId;
  renderFdLoanModule();
  const amortCard = document.getElementById('amortizationScheduleCard');
  if (amortCard) {
    amortCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function selectFdAndFocus(fdId) {
  selectedFdId = fdId;
  renderFdLoanModule();
  const earningsCard = document.getElementById('fdEarningsCard');
  if (earningsCard) {
    earningsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

window.dismissAlert = dismissAlert;
window.selectLoanAndFocus = selectLoanAndFocus;
window.selectFdAndFocus = selectFdAndFocus;

function getFdAlertInfo(fd) {
  if (!fd) return null;
  const startDt = fd.startDate ? new Date(fd.startDate + 'T00:00:00') : new Date();
  const tenureMonths = parseInt(fd.tenureMonths) || 12;
  const maturityDt = new Date(startDt.getFullYear(), startDt.getMonth() + tenureMonths, startDt.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = maturityDt.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const maturityDateStr = formatDisplayDate(maturityDt.toISOString().substring(0, 10));

  if (diffDays <= 0) {
    return {
      type: 'emerald',
      statusKey: 'matured',
      diffDays,
      maturityDateStr,
      badgeHtml: `<span class="alert-badge-pill badge-emerald"><i class="fa-solid fa-circle-check"></i> Matured</span>`,
      alertId: `fd-matured-${fd.id}`,
      iconClass: 'fa-solid fa-coins',
      title: `⚠️ Notice: Your '${escapeHTML(fd.title)}' Has Reached Maturity!`,
      subtitle: `Matured on ${maturityDateStr}. Principal of ${formatCurrency(fd.depositAmount)} (+ yield) is ready for collection or renewal.`,
      actionBtnText: 'View FD Details',
      actionHandler: `window.selectFdAndFocus('${fd.id}')`
    };
  } else if (diffDays <= 30) {
    return {
      type: 'amber',
      statusKey: 'maturingSoon',
      diffDays,
      maturityDateStr,
      badgeHtml: `<span class="alert-badge-pill badge-amber"><i class="fa-solid fa-clock"></i> Matures in ${diffDays}d</span>`,
      alertId: `fd-maturing-${fd.id}`,
      iconClass: 'fa-solid fa-bell',
      title: `⏰ Notice: Your '${escapeHTML(fd.title)}' is maturing in ${diffDays} day${diffDays === 1 ? '' : 's'}!`,
      subtitle: `Scheduled maturity date is ${maturityDateStr}. Est. maturity value: ${formatCurrency(calculateFdEarnings(fd.depositAmount, fd.annualRate, fd.tenureMonths, fd.payoutFrequency).maturityAmount)}.`,
      actionBtnText: 'View FD',
      actionHandler: `window.selectFdAndFocus('${fd.id}')`
    };
  }

  return {
    type: 'indigo',
    statusKey: 'active',
    diffDays,
    maturityDateStr,
    badgeHtml: `<span class="alert-badge-pill badge-indigo"><i class="fa-solid fa-vault"></i> Active FD</span>`
  };
}

function getLoanAlertInfo(loan) {
  if (!loan) return null;
  const schedule = generateAmortizationSchedule(loan);
  const unpaidItems = schedule.filter(item => !item.isPaid);
  const totalMonths = parseInt(loan.tenureMonths) || 12;
  const paidCount = Array.isArray(loan.paidMonths) ? loan.paidMonths.length : 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (unpaidItems.length === 0) {
    return {
      type: 'emerald',
      statusKey: 'completed',
      badgeHtml: `<span class="alert-badge-pill badge-emerald"><i class="fa-solid fa-circle-check"></i> Paid Off</span>`,
      alertId: `loan-completed-${loan.id}`,
      iconClass: 'fa-solid fa-circle-check',
      title: `🎉 Facility Fully Repaid: '${escapeHTML(loan.title)}' 100% Complete!`,
      subtitle: `All ${totalMonths} installments paid in full. Balance is zero.`,
      actionBtnText: 'View Schedule',
      actionHandler: `window.selectLoanAndFocus('${loan.id}')`
    };
  }

  const nextUnpaid = unpaidItems[0];
  let isOverdue = false;
  let isDueSoon = false;
  let dueDays = 999;
  let dueDateStr = '';

  if (nextUnpaid && nextUnpaid.dueDate) {
    const dueDt = new Date(nextUnpaid.dueDate + 'T00:00:00');
    dueDays = Math.ceil((dueDt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    dueDateStr = formatDisplayDate(nextUnpaid.dueDate);

    if (dueDays < 0) {
      isOverdue = true;
    } else if (dueDays <= 7) {
      isDueSoon = true;
    }
  }

  const isFinalMilestone = unpaidItems.length === 1 || (schedule.length > 0 && (() => {
    const finalDt = new Date(schedule[schedule.length - 1].dueDate + 'T00:00:00');
    const daysToFinal = Math.ceil((finalDt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysToFinal <= 30;
  })());

  let badgeHtml = '';
  let alert = null;

  if (isOverdue) {
    badgeHtml = `<span class="alert-badge-pill badge-rose"><i class="fa-solid fa-triangle-exclamation"></i> Overdue ${Math.abs(dueDays)}d</span>`;
    alert = {
      type: 'rose',
      statusKey: 'overdue',
      alertId: `loan-overdue-${loan.id}-${nextUnpaid.monthNum}`,
      iconClass: 'fa-solid fa-triangle-exclamation',
      title: `🚨 Overdue Alert: Month ${nextUnpaid.monthNum} EMI for '${escapeHTML(loan.title)}' Overdue!`,
      subtitle: `EMI payment of ${formatCurrency(nextUnpaid.emiAmount)} was due on ${dueDateStr} (${Math.abs(dueDays)} day${Math.abs(dueDays) === 1 ? '' : 's'} overdue).`,
      actionBtnText: `Pay Month ${nextUnpaid.monthNum}`,
      actionHandler: `window.selectLoanAndFocus('${loan.id}')`
    };
  } else if (isDueSoon) {
    badgeHtml = `<span class="alert-badge-pill badge-amber"><i class="fa-solid fa-bell"></i> Due in ${dueDays === 0 ? 'Today' : dueDays + 'd'}</span>`;
    alert = {
      type: 'amber',
      statusKey: 'duesoon',
      alertId: `loan-duesoon-${loan.id}-${nextUnpaid.monthNum}`,
      iconClass: 'fa-solid fa-bell',
      title: `🔔 Payment Due Notice: Month ${nextUnpaid.monthNum} EMI for '${escapeHTML(loan.title)}'`,
      subtitle: `Installment of ${formatCurrency(nextUnpaid.emiAmount)} is due ${dueDays === 0 ? 'TODAY' : 'in ' + dueDays + ' days'} (${dueDateStr}).`,
      actionBtnText: `Pay Month ${nextUnpaid.monthNum}`,
      actionHandler: `window.selectLoanAndFocus('${loan.id}')`
    };
  } else if (isFinalMilestone) {
    badgeHtml = `<span class="alert-badge-pill badge-indigo"><i class="fa-solid fa-flag-checkered"></i> Final Stage</span>`;
    alert = {
      type: 'indigo',
      statusKey: 'milestone',
      alertId: `loan-milestone-${loan.id}`,
      iconClass: 'fa-solid fa-flag-checkered',
      title: `🏁 Payoff Milestone: '${escapeHTML(loan.title)}' Entering Final Completion Stage!`,
      subtitle: `Only ${unpaidItems.length} payment${unpaidItems.length === 1 ? '' : 's'} remaining until full loan debt clearance!`,
      actionBtnText: 'View Milestone',
      actionHandler: `window.selectLoanAndFocus('${loan.id}')`
    };
  } else {
    badgeHtml = `<span class="alert-badge-pill badge-indigo"><i class="fa-solid fa-hand-holding-dollar"></i> ${paidCount}/${totalMonths} Paid</span>`;
  }

  return {
    badgeHtml,
    alert
  };
}

function renderFdAlertsSystem() {
  const container = document.getElementById('fdAlertsContainer');
  if (!container) return;

  container.innerHTML = '';

  const activeFdAlerts = [];
  fixedDeposits.forEach(fd => {
    const info = getFdAlertInfo(fd);
    if (info && (info.statusKey === 'matured' || info.statusKey === 'maturingSoon')) {
      if (!dismissedAlerts.has(info.alertId)) {
        activeFdAlerts.push(info);
      }
    }
  });

  if (activeFdAlerts.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  activeFdAlerts.forEach(alert => {
    const card = document.createElement('div');
    card.className = `smart-alert-card alert-${alert.type}`;
    card.innerHTML = `
      <div class="smart-alert-icon"><i class="${alert.iconClass}"></i></div>
      <div class="smart-alert-content">
        <div class="smart-alert-title">${alert.title}</div>
        <div class="smart-alert-subtitle">${alert.subtitle}</div>
      </div>
      <div class="smart-alert-actions">
        <button type="button" class="smart-alert-btn" onclick="${alert.actionHandler}">${alert.actionBtnText}</button>
        <button type="button" class="smart-alert-dismiss" title="Dismiss Alert" onclick="window.dismissAlert('${alert.alertId}')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderLoanAlertsSystem() {
  const container = document.getElementById('loanAlertsContainer');
  if (!container) return;

  container.innerHTML = '';

  const activeLoanAlerts = [];
  loans.forEach(loan => {
    const info = getLoanAlertInfo(loan);
    if (info && info.alert) {
      if (!dismissedAlerts.has(info.alert.alertId)) {
        activeLoanAlerts.push(info.alert);
      }
    }
  });

  if (activeLoanAlerts.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  activeLoanAlerts.forEach(alert => {
    const card = document.createElement('div');
    card.className = `smart-alert-card alert-${alert.type}`;
    card.innerHTML = `
      <div class="smart-alert-icon"><i class="${alert.iconClass}"></i></div>
      <div class="smart-alert-content">
        <div class="smart-alert-title">${alert.title}</div>
        <div class="smart-alert-subtitle">${alert.subtitle}</div>
      </div>
      <div class="smart-alert-actions">
        <button type="button" class="smart-alert-btn" onclick="${alert.actionHandler}">${alert.actionBtnText}</button>
        <button type="button" class="smart-alert-dismiss" title="Dismiss Alert" onclick="window.dismissAlert('${alert.alertId}')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderFdLoanModule() {
  // Update currency labels and icons
  const loanCurrSpan = document.getElementById('loanCurrSpan');
  const fdCurrSpan = document.getElementById('fdCurrSpan');
  const loanCurrIcon = document.getElementById('loanCurrIcon');
  const fdCurrIcon = document.getElementById('fdCurrIcon');

  const currText = currentCurrency === 'USD' ? 'USD' : 'LKR';
  const currSym = currentCurrency === 'USD' ? '$' : 'Rs.';

  if (loanCurrSpan) loanCurrSpan.textContent = currText;
  if (fdCurrSpan) fdCurrSpan.textContent = currText;
  if (loanCurrIcon) loanCurrIcon.textContent = currSym;
  if (fdCurrIcon) fdCurrIcon.textContent = currSym;

  renderLoanAlertsSystem();
  renderFdAlertsSystem();

  renderFdLoanTopSummary();
  renderSavedLoansList();
  renderLoanAnalyticsChart();
  renderAmortizationSchedule();
  renderSavedFdsList();
  renderFdAnalyticsChart();
  renderFdEarningsSchedule();
}

// --------------------------------------------------------------------------
// Loan & FD Analytical Charts Implementation
// --------------------------------------------------------------------------

function renderLoanAnalyticsChart() {
  const emptyState = document.getElementById('loanChartEmptyState');
  const canvasWrapper = document.getElementById('loanChartCanvasWrapper');
  const canvas = document.getElementById('loanAnalyticsChartCanvas');

  if (!emptyState || !canvasWrapper || !canvas) return;

  if (!loans || loans.length === 0) {
    emptyState.classList.remove('hidden');
    canvasWrapper.classList.add('hidden');
    if (loanAnalyticsChartInstance) {
      loanAnalyticsChartInstance.destroy();
      loanAnalyticsChartInstance = null;
    }
    return;
  }

  const selectedLoan = loans.find(l => l.id === selectedLoanId) || loans[0];
  if (!selectedLoan) {
    emptyState.classList.remove('hidden');
    canvasWrapper.classList.add('hidden');
    if (loanAnalyticsChartInstance) {
      loanAnalyticsChartInstance.destroy();
      loanAnalyticsChartInstance = null;
    }
    return;
  }

  emptyState.classList.add('hidden');
  canvasWrapper.classList.remove('hidden');

  const schedule = generateAmortizationSchedule(selectedLoan);
  if (schedule.length === 0) return;

  let labels = [];
  let principalData = [];
  let interestData = [];
  let balanceData = [];

  if (loanChartMode === 'monthly') {
    labels = schedule.map(row => `Mo ${row.monthNum}`);
    principalData = schedule.map(row => row.principalPaid);
    interestData = schedule.map(row => row.interestPaid);
    balanceData = schedule.map(row => row.remainingBalance);
  } else {
    // Yearly mode: aggregate by 12-month periods
    const totalYears = Math.ceil(schedule.length / 12);
    for (let y = 1; y <= totalYears; y++) {
      labels.push(`Year ${y}`);
      const yearRows = schedule.slice((y - 1) * 12, y * 12);
      const yearPrincipal = yearRows.reduce((sum, r) => sum + r.principalPaid, 0);
      const yearInterest = yearRows.reduce((sum, r) => sum + r.interestPaid, 0);
      const yearEndBalance = yearRows[yearRows.length - 1].remainingBalance;

      principalData.push(yearPrincipal);
      interestData.push(yearInterest);
      balanceData.push(yearEndBalance);
    }
  }

  const isLight = currentTheme === 'light';
  const textColor = isLight ? '#475569' : '#94a3b8';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';

  if (loanAnalyticsChartInstance) {
    loanAnalyticsChartInstance.data.labels = labels;
    loanAnalyticsChartInstance.data.datasets[0].data = principalData;
    loanAnalyticsChartInstance.data.datasets[1].data = interestData;
    loanAnalyticsChartInstance.data.datasets[2].data = balanceData;

    if (loanAnalyticsChartInstance.options.scales.x) {
      loanAnalyticsChartInstance.options.scales.x.ticks.color = textColor;
      loanAnalyticsChartInstance.options.scales.x.grid.color = gridColor;
    }
    if (loanAnalyticsChartInstance.options.scales.y) {
      loanAnalyticsChartInstance.options.scales.y.ticks.color = textColor;
      loanAnalyticsChartInstance.options.scales.y.grid.color = gridColor;
    }
    if (loanAnalyticsChartInstance.options.scales.y1) {
      loanAnalyticsChartInstance.options.scales.y1.ticks.color = '#38bdf8';
    }
    if (loanAnalyticsChartInstance.options.plugins.legend) {
      loanAnalyticsChartInstance.options.plugins.legend.labels.color = textColor;
    }

    loanAnalyticsChartInstance.update();
  } else {
    const ctx = canvas.getContext('2d');
    loanAnalyticsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Principal Paid',
            data: principalData,
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            borderColor: '#6366f1',
            borderWidth: 1.5,
            borderRadius: 4,
            order: 2,
            yAxisID: 'y'
          },
          {
            label: 'Interest Paid',
            data: interestData,
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            borderColor: '#f43f5e',
            borderWidth: 1.5,
            borderRadius: 4,
            order: 2,
            yAxisID: 'y'
          },
          {
            label: 'Remaining Balance',
            data: balanceData,
            type: 'line',
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            borderWidth: 2.5,
            pointBackgroundColor: '#0284c7',
            pointBorderColor: '#ffffff',
            pointRadius: 3,
            tension: 0.3,
            fill: false,
            order: 1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10.5, weight: '600' },
              usePointStyle: true,
              boxWidth: 8,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: isLight ? '#ffffff' : '#0f172a',
            titleColor: isLight ? '#0f172a' : '#f8fafc',
            bodyColor: isLight ? '#334155' : '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            usePointStyle: true,
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return ` ${label}: ${formatCurrency(value)}`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10 }
            }
          },
          y: {
            stacked: true,
            position: 'left',
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: function (val) {
                return formatCurrencyShort(val);
              }
            }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#38bdf8',
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: function (val) {
                return formatCurrencyShort(val);
              }
            }
          }
        },
        animation: { duration: 400, easing: 'easeOutQuart' }
      }
    });
  }
}

function renderFdAnalyticsChart() {
  const emptyState = document.getElementById('fdChartEmptyState');
  const canvasWrapper = document.getElementById('fdChartCanvasWrapper');
  const canvas = document.getElementById('fdAnalyticsChartCanvas');

  if (!emptyState || !canvasWrapper || !canvas) return;

  if (!fixedDeposits || fixedDeposits.length === 0) {
    emptyState.classList.remove('hidden');
    canvasWrapper.classList.add('hidden');
    if (fdAnalyticsChartInstance) {
      fdAnalyticsChartInstance.destroy();
      fdAnalyticsChartInstance = null;
    }
    return;
  }

  const selectedFd = fixedDeposits.find(f => f.id === selectedFdId) || fixedDeposits[0];
  if (!selectedFd) {
    emptyState.classList.remove('hidden');
    canvasWrapper.classList.add('hidden');
    if (fdAnalyticsChartInstance) {
      fdAnalyticsChartInstance.destroy();
      fdAnalyticsChartInstance = null;
    }
    return;
  }

  emptyState.classList.add('hidden');
  canvasWrapper.classList.remove('hidden');

  const deposit = parseFloat(selectedFd.depositAmount) || 0;
  const rate = parseFloat(selectedFd.annualRate) || 0;
  const tenure = parseInt(selectedFd.tenureMonths) || 12;

  const { monthlyInterest } = calculateFdEarnings(deposit, rate, tenure, selectedFd.payoutFrequency);

  let labels = [];
  let yieldData = [];
  let totalValueData = [];

  if (fdChartMode === 'monthly') {
    for (let m = 1; m <= tenure; m++) {
      labels.push(`Mo ${m}`);
      yieldData.push(monthlyInterest);
      totalValueData.push(deposit + (m * monthlyInterest));
    }
  } else {
    // Yearly mode: aggregate by 12-month periods
    const totalYears = Math.ceil(tenure / 12);
    for (let y = 1; y <= totalYears; y++) {
      labels.push(`Year ${y}`);
      const monthsInYear = (y === totalYears && tenure % 12 !== 0) ? (tenure % 12) : 12;
      const yearYield = monthlyInterest * monthsInYear;
      const cumulativeMonths = Math.min(y * 12, tenure);
      const yearEndTotalVal = deposit + (cumulativeMonths * monthlyInterest);

      yieldData.push(yearYield);
      totalValueData.push(yearEndTotalVal);
    }
  }

  const isLight = currentTheme === 'light';
  const textColor = isLight ? '#475569' : '#94a3b8';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';

  if (fdAnalyticsChartInstance) {
    fdAnalyticsChartInstance.data.labels = labels;
    fdAnalyticsChartInstance.data.datasets[0].data = yieldData;
    fdAnalyticsChartInstance.data.datasets[1].data = totalValueData;

    if (fdAnalyticsChartInstance.options.scales.x) {
      fdAnalyticsChartInstance.options.scales.x.ticks.color = textColor;
      fdAnalyticsChartInstance.options.scales.x.grid.color = gridColor;
    }
    if (fdAnalyticsChartInstance.options.scales.y) {
      fdAnalyticsChartInstance.options.scales.y.ticks.color = textColor;
      fdAnalyticsChartInstance.options.scales.y.grid.color = gridColor;
    }
    if (fdAnalyticsChartInstance.options.scales.y1) {
      fdAnalyticsChartInstance.options.scales.y1.ticks.color = '#38bdf8';
    }
    if (fdAnalyticsChartInstance.options.plugins.legend) {
      fdAnalyticsChartInstance.options.plugins.legend.labels.color = textColor;
    }

    fdAnalyticsChartInstance.update();
  } else {
    const ctx = canvas.getContext('2d');
    fdAnalyticsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Interest Yield',
            data: yieldData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderRadius: 4,
            order: 2,
            yAxisID: 'y'
          },
          {
            label: 'Total Portfolio Growth',
            data: totalValueData,
            type: 'line',
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            borderWidth: 2.5,
            pointBackgroundColor: '#0284c7',
            pointBorderColor: '#ffffff',
            pointRadius: 3,
            tension: 0.3,
            fill: false,
            order: 1,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10.5, weight: '600' },
              usePointStyle: true,
              boxWidth: 8,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: isLight ? '#ffffff' : '#0f172a',
            titleColor: isLight ? '#0f172a' : '#f8fafc',
            bodyColor: isLight ? '#334155' : '#cbd5e1',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            usePointStyle: true,
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return ` ${label}: ${formatCurrency(value)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10 }
            }
          },
          y: {
            position: 'left',
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: function (val) {
                return formatCurrencyShort(val);
              }
            }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#38bdf8',
              font: { family: 'Plus Jakarta Sans', size: 10 },
              callback: function (val) {
                return formatCurrencyShort(val);
              }
            }
          }
        },
        animation: { duration: 400, easing: 'easeOutQuart' }
      }
    });
  }
}

function renderFdLoanTopSummary() {
  const totalFdAssetsValEl = document.getElementById('totalFdAssetsVal');
  const totalLoanLiabilitiesValEl = document.getElementById('totalLoanLiabilitiesVal');
  const netFdLoanFlowValEl = document.getElementById('netFdLoanFlowVal');
  const netFdLoanFlowStatusEl = document.getElementById('netFdLoanFlowStatus');

  if (!totalFdAssetsValEl) return;

  // Calculate Total FD Assets (Principal + Collected Interest)
  let totalFdAssets = 0;
  let totalMonthlyFdEarnings = 0;
  fixedDeposits.forEach(fd => {
    const p = parseFloat(fd.depositAmount) || 0;
    const { monthlyInterest } = calculateFdEarnings(p, fd.annualRate, fd.tenureMonths, fd.payoutFrequency);
    const collectedCount = Array.isArray(fd.collectedMonths) ? fd.collectedMonths.length : 0;
    totalFdAssets += p + (monthlyInterest * collectedCount);
    totalMonthlyFdEarnings += monthlyInterest;
  });

  // Calculate Total Loan Liabilities (Sum of remaining balance for each active loan)
  let totalLoanLiabilities = 0;
  let totalMonthlyLoanEmis = 0;
  loans.forEach(loan => {
    const schedule = generateAmortizationSchedule(loan);
    const paidCount = Array.isArray(loan.paidMonths) ? loan.paidMonths.length : 0;
    if (schedule.length > 0) {
      const lastPaidItem = schedule[paidCount - 1];
      const remainingBal = lastPaidItem ? lastPaidItem.remainingBalance : parseFloat(loan.principal) || 0;
      totalLoanLiabilities += remainingBal;
      totalMonthlyLoanEmis += schedule[0].emiAmount;
    }
  });

  const netMonthlyCashflow = totalMonthlyFdEarnings - totalMonthlyLoanEmis;

  totalFdAssetsValEl.textContent = formatCurrency(totalFdAssets);
  totalLoanLiabilitiesValEl.textContent = formatCurrency(totalLoanLiabilities);
  netFdLoanFlowValEl.textContent = (netMonthlyCashflow >= 0 ? '+' : '') + formatCurrency(netMonthlyCashflow);

  if (netFdLoanFlowStatusEl) {
    if (netMonthlyCashflow >= 0) {
      netFdLoanFlowStatusEl.className = 'metric-status positive';
      netFdLoanFlowStatusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Net Positive Yield (+${formatCurrency(totalMonthlyFdEarnings)} FD vs -${formatCurrency(totalMonthlyLoanEmis)} EMI)`;
    } else {
      netFdLoanFlowStatusEl.className = 'metric-status negative';
      netFdLoanFlowStatusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Outflow Heavy (+${formatCurrency(totalMonthlyFdEarnings)} FD vs -${formatCurrency(totalMonthlyLoanEmis)} EMI)`;
    }
  }
}

function renderSavedLoansList() {
  const container = document.getElementById('savedLoansList');
  const countEl = document.getElementById('savedLoansCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${loans.length} ${loans.length === 1 ? 'Loan' : 'Loans'}`;
  container.innerHTML = '';

  if (loans.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.2rem 1rem; color: var(--text-muted); font-size: 0.85rem; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: 1rem; grid-column: 1 / -1;">
        <i class="fa-solid fa-folder-open" style="font-size: 2.2rem; margin-bottom: 0.6rem; color: var(--accent-indigo); opacity: 0.6;"></i>
        <p style="font-weight: 700; font-size: 0.92rem; color: var(--text-primary); margin-bottom: 0.2rem;">No active loans found</p>
        <p style="font-size: 0.8rem; color: var(--text-muted);">No active loans or fixed deposits found. Add your first one!</p>
      </div>
    `;
    return;
  }

  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))';
  container.style.gap = '1rem';

  loans.forEach(loan => {
    const emi = calculateLoanEMI(loan.principal, loan.annualRate, loan.tenureMonths);
    const paidCount = Array.isArray(loan.paidMonths) ? loan.paidMonths.length : 0;
    const progressPct = Math.min(100, Math.round((paidCount / (loan.tenureMonths || 1)) * 100));
    const isSelected = loan.id === selectedLoanId;
    const alertInfo = getLoanAlertInfo(loan);

    const div = document.createElement('div');
    div.className = `facility-card-item ${isSelected ? 'selected' : ''}`;
    div.style.borderRadius = '1rem';
    div.style.padding = '1.1rem 1.25rem';
    div.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
    div.style.transition = 'all 0.2s ease';
    div.onclick = () => {
      selectedLoanId = loan.id;
      renderFdLoanModule();
    };

    div.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.3;">${escapeHTML(loan.title)}</h4>
            ${alertInfo ? alertInfo.badgeHtml : ''}
          </div>
          <span style="font-size: 0.78rem; color: var(--text-muted); display: inline-block; margin-top: 0.2rem;">${loan.annualRate}% p.a. &bull; ${loan.tenureMonths} Months</span>
        </div>
        <button class="delete-btn" title="Delete Loan" onclick="event.stopPropagation(); window.deleteLoan('${loan.id}');">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06);">
        <span style="color: var(--text-secondary); font-size: 0.8rem;">Monthly EMI:</span>
        <span style="font-weight: 700; color: #818cf8; font-size: 0.9rem;">${formatCurrency(emi)}</span>
      </div>
      <div class="custom-progress-bar" style="height: 6px; border-radius: 99px; margin-top: 0.6rem;">
        <div class="custom-progress-fill indigo" style="width: ${progressPct}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem;">
        <span>Progress: ${paidCount}/${loan.tenureMonths} Paid</span>
        <span style="font-weight: 600;">${progressPct}%</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderAmortizationSchedule() {
  const emptyState = document.getElementById('amortEmptyState');
  const tableContainer = document.getElementById('amortTableContainer');
  const banner = document.getElementById('loanOverviewBanner');
  const tbody = document.getElementById('amortTableBody');

  if (!tbody) return;

  const selectedLoan = loans.find(l => l.id === selectedLoanId);

  if (!selectedLoan || loans.length === 0) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = `
        <div class="empty-icon"><i class="fa-solid fa-calculator"></i></div>
        <p class="empty-title">No active loans or fixed deposits found</p>
        <p class="empty-subtitle">Add your first loan using the form to generate its interactive amortization schedule.</p>
      `;
    }
    if (tableContainer) tableContainer.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (tableContainer) tableContainer.classList.remove('hidden');

  const schedule = generateAmortizationSchedule(selectedLoan);
  const emi = calculateLoanEMI(selectedLoan.principal, selectedLoan.annualRate, selectedLoan.tenureMonths);
  const totalInterest = schedule.reduce((sum, item) => sum + item.interestPaid, 0);
  const totalRepayment = parseFloat(selectedLoan.principal) + totalInterest;
  const paidCount = Array.isArray(selectedLoan.paidMonths) ? selectedLoan.paidMonths.length : 0;
  const progressPct = Math.round((paidCount / selectedLoan.tenureMonths) * 100);

  if (banner) {
    banner.innerHTML = `
      <div class="summary-stats-grid">
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Principal</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${formatCurrency(selectedLoan.principal)}</div>
        </div>
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Monthly EMI</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: #818cf8;">${formatCurrency(emi)}</div>
        </div>
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Interest Rate</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${selectedLoan.annualRate}% p.a.</div>
        </div>
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total Interest</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: #f43f5e;">${formatCurrency(totalInterest)}</div>
        </div>
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Paid Progress</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: #10b981;">${paidCount}/${selectedLoan.tenureMonths} Mo. (${progressPct}%)</div>
        </div>
      </div>
    `;
  }

  tbody.innerHTML = '';
  schedule.forEach(item => {
    const tr = document.createElement('tr');
    if (item.isPaid) tr.className = 'paid-row';

    tr.innerHTML = `
      <td style="font-weight: 700;">Month ${item.monthNum}</td>
      <td>${formatDisplayDate(item.dueDate)}</td>
      <td style="font-weight: 700; color: var(--text-primary);">${formatCurrency(item.emiAmount)}</td>
      <td style="color: #f43f5e;">${formatCurrency(item.interestPaid)}</td>
      <td style="color: #10b981;">${formatCurrency(item.principalPaid)}</td>
      <td style="font-weight: 600;">${formatCurrency(item.remainingBalance)}</td>
      <td>
        ${item.isPaid 
          ? `<button class="btn-action-paid" onclick="window.handleToggleLoanInstallment('${selectedLoan.id}', ${item.monthNum})"><i class="fa-solid fa-circle-check"></i> Paid ✓</button>`
          : `<button class="btn-action-pending" onclick="window.handleToggleLoanInstallment('${selectedLoan.id}', ${item.monthNum})"><i class="fa-solid fa-clock"></i> Mark as Paid</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSavedFdsList() {
  const container = document.getElementById('savedFdsList');
  const countEl = document.getElementById('savedFdsCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${fixedDeposits.length} ${fixedDeposits.length === 1 ? 'FD' : 'FDs'}`;
  container.innerHTML = '';

  if (fixedDeposits.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.2rem 1rem; color: var(--text-muted); font-size: 0.85rem; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: 1rem; grid-column: 1 / -1;">
        <i class="fa-solid fa-piggy-bank" style="font-size: 2.2rem; margin-bottom: 0.6rem; color: #10b981; opacity: 0.6;"></i>
        <p style="font-weight: 700; font-size: 0.92rem; color: var(--text-primary); margin-bottom: 0.2rem;">No active fixed deposits found</p>
        <p style="font-size: 0.8rem; color: var(--text-muted);">No active loans or fixed deposits found. Add your first one!</p>
      </div>
    `;
    return;
  }

  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))';
  container.style.gap = '1rem';

  fixedDeposits.forEach(fd => {
    const { monthlyInterest } = calculateFdEarnings(fd.depositAmount, fd.annualRate, fd.tenureMonths, fd.payoutFrequency);
    const collectedCount = Array.isArray(fd.collectedMonths) ? fd.collectedMonths.length : 0;
    const progressPct = Math.min(100, Math.round((collectedCount / (fd.tenureMonths || 1)) * 100));
    const isSelected = fd.id === selectedFdId;
    const alertInfo = getFdAlertInfo(fd);

    const div = document.createElement('div');
    div.className = `facility-card-item ${isSelected ? 'selected' : ''}`;
    div.style.borderRadius = '1rem';
    div.style.padding = '1.1rem 1.25rem';
    div.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
    div.style.transition = 'all 0.2s ease';
    div.onclick = () => {
      selectedFdId = fd.id;
      renderFdLoanModule();
    };

    div.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.3;">${escapeHTML(fd.title)}</h4>
            ${alertInfo ? alertInfo.badgeHtml : ''}
          </div>
          <span style="font-size: 0.78rem; color: var(--text-muted); display: inline-block; margin-top: 0.2rem;">${fd.annualRate}% p.a. &bull; ${fd.tenureMonths} Months (${fd.payoutFrequency === 'monthly' ? 'Monthly' : 'Maturity'})</span>
        </div>
        <button class="delete-btn" title="Delete Fixed Deposit" onclick="event.stopPropagation(); window.deleteFd('${fd.id}');">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; margin-top: 0.6rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06);">
        <span style="color: var(--text-secondary); font-size: 0.8rem;">Monthly Yield:</span>
        <span style="font-weight: 700; color: #10b981; font-size: 0.9rem;">+${formatCurrency(monthlyInterest)}</span>
      </div>
      <div class="custom-progress-bar" style="height: 6px; border-radius: 99px; margin-top: 0.6rem;">
        <div class="custom-progress-fill emerald" style="width: ${progressPct}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem;">
        <span>Collected: ${collectedCount}/${fd.tenureMonths} Months</span>
        <span style="font-weight: 600;">${progressPct}%</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderFdEarningsSchedule() {
  const emptyState = document.getElementById('fdEmptyState');
  const tableContainer = document.getElementById('fdTableContainer');
  const banner = document.getElementById('fdOverviewBanner');
  const tbody = document.getElementById('fdTableBody');

  if (!tbody) return;

  const selectedFd = fixedDeposits.find(f => f.id === selectedFdId);

  if (!selectedFd || fixedDeposits.length === 0) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = `
        <div class="empty-icon"><i class="fa-solid fa-building-columns"></i></div>
        <p class="empty-title">No active loans or fixed deposits found</p>
        <p class="empty-subtitle">Add your first fixed deposit using the form to track monthly interest earnings.</p>
      `;
    }
    if (tableContainer) tableContainer.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (tableContainer) tableContainer.classList.remove('hidden');

  const schedule = generateFdSchedule(selectedFd);
  const { monthlyInterest, totalInterest, maturityAmount } = calculateFdEarnings(
    selectedFd.depositAmount, 
    selectedFd.annualRate, 
    selectedFd.tenureMonths, 
    selectedFd.payoutFrequency
  );
  const collectedCount = Array.isArray(selectedFd.collectedMonths) ? selectedFd.collectedMonths.length : 0;
  const progressPct = Math.round((collectedCount / selectedFd.tenureMonths) * 100);

  if (banner) {
    banner.innerHTML = `
      <div class="summary-stats-grid">
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Deposit Principal</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${formatCurrency(selectedFd.depositAmount)}</div>
        </div>
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Est. Monthly Yield</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: #10b981;">+${formatCurrency(monthlyInterest)}</div>
        </div>
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Interest Rate</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${selectedFd.annualRate}% p.a.</div>
        </div>
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Maturity Amount</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: #818cf8;">${formatCurrency(maturityAmount)}</div>
        </div>
        <div class="summary-stat-card">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Collection Progress</span>
          <div style="font-size: 0.95rem; font-weight: 700; color: #10b981;">${collectedCount}/${selectedFd.tenureMonths} Mo. (${progressPct}%)</div>
        </div>
      </div>
    `;
  }

  tbody.innerHTML = '';
  schedule.forEach(item => {
    const tr = document.createElement('tr');
    if (item.isCollected) tr.className = 'paid-row';

    tr.innerHTML = `
      <td style="font-weight: 700;">Month ${item.monthNum}</td>
      <td>${formatDisplayDate(item.payoutDate)}</td>
      <td style="font-weight: 700; color: #10b981;">+${formatCurrency(item.interestEarned)}</td>
      <td style="font-weight: 600; color: var(--text-primary);">${formatCurrency(item.cumulativeInterest)}</td>
      <td>${formatCurrency(item.principalValue)}</td>
      <td>
        ${item.isCollected 
          ? `<button class="btn-action-paid" onclick="window.handleCollectFdInterest('${selectedFd.id}', ${item.monthNum})"><i class="fa-solid fa-circle-check"></i> Collected ✓</button>`
          : `<button class="btn-action-pending" style="border-color: #10b981; color: #10b981; background: rgba(16,185,129,0.15);" onclick="window.handleCollectFdInterest('${selectedFd.id}', ${item.monthNum})"><i class="fa-solid fa-hand-holding-dollar"></i> Collect Interest</button>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --------------------------------------------------------------------------
// Actions & Handlers
// --------------------------------------------------------------------------

window.handleToggleLoanInstallment = function (loanId, monthNum) {
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;

  if (!Array.isArray(loan.paidMonths)) loan.paidMonths = [];

  const schedule = generateAmortizationSchedule(loan);
  const monthData = schedule.find(s => s.monthNum === monthNum);
  if (!monthData) return;

  const isPaid = loan.paidMonths.includes(monthNum);

  if (!isPaid) {
    loan.paidMonths.push(monthNum);

    let emiLKR = monthData.emiAmount;
    if (currentCurrency === 'USD') {
      emiLKR = emiLKR * USD_TO_LKR_RATE;
    }

    const tx = {
      id: 'tx-loan-' + loan.id + '-' + monthNum + '-' + Date.now(),
      description: `Loan EMI: ${loan.title} (Month #${monthNum})`,
      amount: emiLKR,
      type: 'expense',
      category: 'Utilities',
      date: monthData.dueDate || getFormattedDate(0),
      createdAt: new Date().toISOString()
    };

    transactions.unshift(tx);
    saveLocalTransactionsCache();

    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('transactions').doc(tx.id).set(tx);
      db.collection('users').doc(currentUser.uid).collection('loans').doc(loan.id).set(loan);
    }

    showToast(`Month #${monthNum} installment marked as Paid! EMI of ${formatCurrency(monthData.emiAmount)} recorded in ledger.`, 'success');
  } else {
    loan.paidMonths = loan.paidMonths.filter(m => m !== monthNum);

    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('loans').doc(loan.id).set(loan);
    }

    showToast(`Month #${monthNum} installment status reverted.`, 'info');
  }

  saveLocalLoansCache();
  renderFdLoanModule();
  renderApp();
};

window.handleCollectFdInterest = function (fdId, monthNum) {
  const fd = fixedDeposits.find(f => f.id === fdId);
  if (!fd) return;

  if (!Array.isArray(fd.collectedMonths)) fd.collectedMonths = [];

  const schedule = generateFdSchedule(fd);
  const monthData = schedule.find(s => s.monthNum === monthNum);
  if (!monthData) return;

  const isCollected = fd.collectedMonths.includes(monthNum);

  if (!isCollected) {
    fd.collectedMonths.push(monthNum);

    let yieldLKR = monthData.interestEarned;
    if (currentCurrency === 'USD') {
      yieldLKR = yieldLKR * USD_TO_LKR_RATE;
    }

    const tx = {
      id: 'tx-fd-' + fd.id + '-' + monthNum + '-' + Date.now(),
      description: `FD Interest Yield: ${fd.title} (Month #${monthNum})`,
      amount: yieldLKR,
      type: 'income',
      category: 'Salary',
      date: monthData.payoutDate || getFormattedDate(0),
      createdAt: new Date().toISOString()
    };

    transactions.unshift(tx);
    saveLocalTransactionsCache();

    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('transactions').doc(tx.id).set(tx);
      db.collection('users').doc(currentUser.uid).collection('fixedDeposits').doc(fd.id).set(fd);
    }

    showToast(`Interest for Month #${monthNum} collected! Income of +${formatCurrency(monthData.interestEarned)} added to ledger.`, 'success');
  } else {
    fd.collectedMonths = fd.collectedMonths.filter(m => m !== monthNum);

    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('fixedDeposits').doc(fd.id).set(fd);
    }

    showToast(`Month #${monthNum} interest status reset.`, 'info');
  }

  saveLocalFdsCache();
  renderFdLoanModule();
  renderApp();
};

window.deleteLoan = function (loanId) {
  const target = loans.find(l => l.id === loanId);
  if (!target) return;

  if (confirm(`Are you sure you want to delete "${target.title}"?`)) {
    loans = loans.filter(l => l.id !== loanId);
    if (selectedLoanId === loanId) {
      selectedLoanId = loans.length > 0 ? loans[0].id : null;
    }

    saveLocalLoansCache();

    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('loans').doc(loanId).delete();
    }

    renderFdLoanModule();
    showToast(`Loan "${target.title}" deleted.`, 'info');
  }
};

window.handleClearFdLoanData = async function () {
  if (loans.length === 0 && fixedDeposits.length === 0) {
    showToast('No active FD or Loan records to clear.', 'info');
    return;
  }

  if (confirm('Are you sure you want to clear all active Loan facilities and Fixed Deposits? Home transaction records will remain untouched.')) {
    loans = [];
    fixedDeposits = [];
    selectedLoanId = null;
    selectedFdId = null;

    try {
      localStorage.removeItem(FD_LOAN_STORAGE_KEY);
      localStorage.removeItem(LOANS_STORAGE_KEY);
      localStorage.removeItem(FDS_STORAGE_KEY);
      localStorage.removeItem('finpulse_fd_loan_data');
      localStorage.removeItem('finpulse_loans_v1');
      localStorage.removeItem('finpulse_fds_v1');
    } catch (e) {
      console.error('LocalStorage clear error:', e);
    }

    saveLocalLoansAndFdsCache();

    if (currentUser && db) {
      try {
        const loansRef = db.collection('users').doc(currentUser.uid).collection('loans');
        const fdsRef = db.collection('users').doc(currentUser.uid).collection('fixedDeposits');
        const loansSnap = await loansRef.get();
        const fdsSnap = await fdsRef.get();
        const batch = db.batch();
        loansSnap.forEach(doc => batch.delete(doc.ref));
        fdsSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      } catch (err) {
        console.error('Firestore clear FD/Loan error:', err);
      }
    }

    renderFdLoanModule();
    showToast('Active FD & Loan records cleared successfully.', 'info');
  }
};

window.deleteFd = function (fdId) {
  const target = fixedDeposits.find(f => f.id === fdId);
  if (!target) return;

  if (confirm(`Are you sure you want to delete "${target.title}"?`)) {
    fixedDeposits = fixedDeposits.filter(f => f.id !== fdId);
    if (selectedFdId === fdId) {
      selectedFdId = fixedDeposits.length > 0 ? fixedDeposits[0].id : null;
    }

    saveLocalFdsCache();

    if (currentUser && db) {
      db.collection('users').doc(currentUser.uid).collection('fixedDeposits').doc(fdId).delete();
    }

    renderFdLoanModule();
    showToast(`Fixed Deposit "${target.title}" deleted.`, 'info');
  }
};

function handleDownloadFdPdf() {
  try {
    if (!fixedDeposits || fixedDeposits.length === 0) {
      showToast('No active Fixed Deposits available to export.', 'danger');
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('PDF generator library is loading or missing.', 'danger');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const curr = (typeof currentCurrency !== 'undefined') ? currentCurrency : 'LKR';
    const currSymbol = curr === 'USD' ? '$' : 'Rs. ';

    const formatCurr = (num) => {
      return `${currSymbol}${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    };

    // Calculate portfolio metrics
    let totalDeposit = 0;
    let totalEstMonthlyYield = 0;
    let totalMaturityValue = 0;
    let totalCollectedInterest = 0;

    fixedDeposits.forEach(fd => {
      const deposit = parseFloat(fd.depositAmount) || 0;
      const rate = parseFloat(fd.annualRate) || 0;
      const tenure = parseInt(fd.tenureMonths) || 12;
      const collectedCount = Array.isArray(fd.collectedMonths) ? fd.collectedMonths.length : 0;

      const { monthlyInterest, totalMaturityValue: maturityVal } = calculateFdEarnings(deposit, rate, tenure, fd.payoutFrequency);
      const collectedVal = collectedCount * monthlyInterest;

      totalDeposit += deposit;
      totalEstMonthlyYield += monthlyInterest;
      totalMaturityValue += maturityVal;
      totalCollectedInterest += collectedVal;
    });

    let userEmailStr = 'Guest User';
    if (typeof currentUser !== 'undefined' && currentUser) {
      userEmailStr = currentUser.displayName || currentUser.email || 'Registered User';
    } else {
      const userEmailEl = document.getElementById('userEmailText');
      if (userEmailEl && userEmailEl.textContent) {
        userEmailStr = userEmailEl.textContent.trim();
      }
    }

    const reportDateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. HEADER BANNER (Emerald Theme #065f46)
    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setFillColor(16, 185, 129);
    doc.rect(0, 31, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('FinPulse Fixed Deposit Portfolio Report', margin, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(209, 250, 229);
    doc.text(`Account Holder: ${userEmailStr}  |  Generated: ${reportDateStr}`, margin, 23);

    // 2. METRIC CARDS
    const cardY = 38;
    const cardGap = 3.5;
    const cardWidth = (pageWidth - (margin * 2) - (cardGap * 3)) / 4;
    const cardHeight = 22;

    drawMetricCard(doc, margin, cardY, cardWidth, cardHeight, 'TOTAL FD CAPITAL', formatCurr(totalDeposit), [16, 185, 129], [236, 253, 245], [167, 243, 208]);
    drawMetricCard(doc, margin + cardWidth + cardGap, cardY, cardWidth, cardHeight, 'EST. MONTHLY YIELD', '+' + formatCurr(totalEstMonthlyYield), [16, 185, 129], [236, 253, 245], [167, 243, 208]);
    drawMetricCard(doc, margin + (cardWidth + cardGap) * 2, cardY, cardWidth, cardHeight, 'TOTAL MATURITY VAL', formatCurr(totalMaturityValue), [79, 70, 229], [238, 242, 255], [199, 210, 254]);
    drawMetricCard(doc, margin + (cardWidth + cardGap) * 3, cardY, cardWidth, cardHeight, 'INTEREST COLLECTED', formatCurr(totalCollectedInterest), [16, 185, 129], [236, 253, 245], [167, 243, 208]);

    // 3. AUTOTABLE TABLE OF FDs
    const tableStartY = cardY + cardHeight + 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Active Fixed Deposits Ledger (${fixedDeposits.length} Facility${fixedDeposits.length === 1 ? '' : 'ies'})`, margin, tableStartY - 3);

    const tableColumns = [
      { header: 'FD Name / Bank', dataKey: 'title' },
      { header: 'Deposit Principal', dataKey: 'depositAmount' },
      { header: 'Rate (p.a.)', dataKey: 'annualRate' },
      { header: 'Tenure', dataKey: 'tenureMonths' },
      { header: 'Payout', dataKey: 'payoutFrequency' },
      { header: 'Monthly Yield', dataKey: 'monthlyYield' },
      { header: 'Maturity Value', dataKey: 'maturityValue' },
      { header: 'Collected', dataKey: 'collected' }
    ];

    const tableRows = fixedDeposits.map(fd => {
      const deposit = parseFloat(fd.depositAmount) || 0;
      const rate = parseFloat(fd.annualRate) || 0;
      const tenure = parseInt(fd.tenureMonths) || 12;
      const collectedCount = Array.isArray(fd.collectedMonths) ? fd.collectedMonths.length : 0;

      const { monthlyInterest, totalMaturityValue: maturityVal } = calculateFdEarnings(deposit, rate, tenure, fd.payoutFrequency);

      return {
        title: fd.title || 'Fixed Deposit',
        depositAmount: formatCurr(deposit),
        annualRate: `${rate}% p.a.`,
        tenureMonths: `${tenure} Mos.`,
        payoutFrequency: fd.payoutFrequency === 'maturity' ? 'At Maturity' : 'Monthly',
        monthlyYield: `+${formatCurr(monthlyInterest)}`,
        maturityValue: formatCurr(maturityVal),
        collected: `${collectedCount}/${tenure} Mo.`
      };
    });

    const tableOptions = {
      columns: tableColumns,
      body: tableRows,
      startY: tableStartY,
      margin: { left: margin, right: margin, bottom: 20 },
      theme: 'grid',
      headStyles: {
        fillColor: [6, 95, 70],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
        cellPadding: 3.5
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8,
        cellPadding: 3,
        lineColor: [241, 245, 249]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didDrawPage: function (data) {
        const totalPages = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal ? doc.internal.getNumberOfPages() : 1);
        const currentPage = data.pageNumber;

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('FinPulse Fixed Deposit Report • Confidential', margin, pageHeight - 6);
        doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      }
    };

    if (typeof doc.autoTable === 'function') {
      doc.autoTable(tableOptions);
    } else if (typeof window.autoTable === 'function') {
      window.autoTable(doc, tableOptions);
    } else if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
      window.jspdf.autoTable(doc, tableOptions);
    }

    doc.save(`FinPulse-FD-Portfolio-Report-${new Date().toISOString().substring(0, 10)}.pdf`);
    showToast('FD Report PDF generated successfully!', 'success');
  } catch (error) {
    console.error('FD PDF generation error:', error);
    showToast('Failed to generate FD PDF report: ' + (error.message || 'Error'), 'danger');
  }
}

function handleDownloadLoanPdf() {
  try {
    if (!loans || loans.length === 0) {
      showToast('No active loan facilities found to export.', 'danger');
      return;
    }

    const selectedLoan = loans.find(l => l.id === selectedLoanId) || loans[0];
    if (!selectedLoan) {
      showToast('Please select a loan facility to download its amortization schedule.', 'danger');
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('PDF generator library is loading or missing.', 'danger');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;

    const curr = (typeof currentCurrency !== 'undefined') ? currentCurrency : 'LKR';
    const currSymbol = curr === 'USD' ? '$' : 'Rs. ';

    const formatCurr = (num) => {
      return `${currSymbol}${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    };

    const principal = parseFloat(selectedLoan.principal) || 0;
    const rate = parseFloat(selectedLoan.annualRate) || 0;
    const tenure = parseInt(selectedLoan.tenureMonths) || 12;
    const paidMonthsCount = Array.isArray(selectedLoan.paidMonths) ? selectedLoan.paidMonths.length : 0;

    const schedule = generateAmortizationSchedule(selectedLoan);
    const emi = calculateLoanEMI(principal, rate, tenure);
    const totalInterest = schedule.reduce((sum, item) => sum + item.interestPaid, 0);
    const progressPct = Math.min(100, Math.round((paidMonthsCount / tenure) * 100));

    let userEmailStr = 'Guest User';
    if (typeof currentUser !== 'undefined' && currentUser) {
      userEmailStr = currentUser.displayName || currentUser.email || 'Registered User';
    } else {
      const userEmailEl = document.getElementById('userEmailText');
      if (userEmailEl && userEmailEl.textContent) {
        userEmailStr = userEmailEl.textContent.trim();
      }
    }

    const reportDateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. HEADER BANNER (Indigo Theme #312e81)
    doc.setFillColor(49, 46, 129);
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setFillColor(99, 102, 241);
    doc.rect(0, 31, pageWidth, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(`Loan Amortization Schedule: ${selectedLoan.title}`, margin, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(224, 231, 255);
    doc.text(`Account Holder: ${userEmailStr}  |  Generated: ${reportDateStr}`, margin, 23);

    // 2. METRIC CARDS
    const cardY = 38;
    const cardGap = 3.5;
    const cardWidth = (pageWidth - (margin * 2) - (cardGap * 3)) / 4;
    const cardHeight = 22;

    drawMetricCard(doc, margin, cardY, cardWidth, cardHeight, 'LOAN PRINCIPAL', formatCurr(principal), [79, 70, 229], [238, 242, 255], [199, 210, 254]);
    drawMetricCard(doc, margin + cardWidth + cardGap, cardY, cardWidth, cardHeight, 'MONTHLY EMI', formatCurr(emi), [99, 102, 241], [238, 242, 255], [199, 210, 254]);
    drawMetricCard(doc, margin + (cardWidth + cardGap) * 2, cardY, cardWidth, cardHeight, 'TOTAL INTEREST', formatCurr(totalInterest), [225, 29, 72], [254, 242, 242], [254, 202, 202]);
    drawMetricCard(doc, margin + (cardWidth + cardGap) * 3, cardY, cardWidth, cardHeight, 'REPAYMENT PROGRESS', `${paidMonthsCount}/${tenure} Mo. (${progressPct}%)`, [16, 185, 129], [236, 253, 245], [167, 243, 208]);

    // 3. AMORTIZATION SCHEDULE TABLE
    const tableStartY = cardY + cardHeight + 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Repayment Schedule (${rate}% p.a. • ${tenure} Months Tenure)`, margin, tableStartY - 3);

    const tableColumns = [
      { header: 'Month #', dataKey: 'month' },
      { header: 'Due Date', dataKey: 'dueDate' },
      { header: 'EMI Amount', dataKey: 'emi' },
      { header: 'Interest Paid', dataKey: 'interestPaid' },
      { header: 'Principal Paid', dataKey: 'principalPaid' },
      { header: 'Remaining Balance', dataKey: 'remainingBalance' },
      { header: 'Status', dataKey: 'status' }
    ];

    const tableRows = schedule.map(row => {
      return {
        month: `Month ${row.monthNum}`,
        dueDate: row.dueDate ? formatDisplayDate(row.dueDate) : 'N/A',
        emi: formatCurr(row.emiAmount),
        interestPaid: formatCurr(row.interestPaid),
        principalPaid: formatCurr(row.principalPaid),
        remainingBalance: formatCurr(row.remainingBalance),
        status: row.isPaid ? 'PAID' : 'PENDING'
      };
    });

    const tableOptions = {
      columns: tableColumns,
      body: tableRows,
      startY: tableStartY,
      margin: { left: margin, right: margin, bottom: 20 },
      theme: 'grid',
      headStyles: {
        fillColor: [49, 46, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
        cellPadding: 3.5
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8,
        cellPadding: 3,
        lineColor: [241, 245, 249]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.dataKey === 'status') {
          if (data.cell.raw === 'PAID') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [100, 116, 139];
          }
        }
      },
      didDrawPage: function (data) {
        const totalPages = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal ? doc.internal.getNumberOfPages() : 1);
        const currentPage = data.pageNumber;

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('FinPulse Loan Amortization Schedule • Confidential', margin, pageHeight - 6);
        doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
      }
    };

    if (typeof doc.autoTable === 'function') {
      doc.autoTable(tableOptions);
    } else if (typeof window.autoTable === 'function') {
      window.autoTable(doc, tableOptions);
    } else if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
      window.jspdf.autoTable(doc, tableOptions);
    }

    const safeTitle = (selectedLoan.title || 'Loan').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`FinPulse-Loan-Schedule-${safeTitle}-${new Date().toISOString().substring(0, 10)}.pdf`);
    showToast('Loan Amortization Schedule PDF generated successfully!', 'success');
  } catch (error) {
    console.error('Loan PDF generation error:', error);
    showToast('Failed to generate Loan PDF schedule: ' + (error.message || 'Error'), 'danger');
  }
}

window.handleDownloadFdPdf = handleDownloadFdPdf;
window.handleDownloadLoanPdf = handleDownloadLoanPdf;

function setupFdLoanModuleListeners() {
  const downloadLoanPdfBtn = document.getElementById('downloadLoanPdfBtn');
  if (downloadLoanPdfBtn) {
    downloadLoanPdfBtn.addEventListener('click', () => {
      handleDownloadLoanPdf();
    });
  }

  const downloadFdPdfBtn = document.getElementById('downloadFdPdfBtn');
  if (downloadFdPdfBtn) {
    downloadFdPdfBtn.addEventListener('click', () => {
      handleDownloadFdPdf();
    });
  }

  // Chart Toggle Listeners
  const loanMonthlyBtn = document.getElementById('loanChartMonthlyBtn');
  const loanYearlyBtn = document.getElementById('loanChartYearlyBtn');
  if (loanMonthlyBtn && loanYearlyBtn) {
    loanMonthlyBtn.addEventListener('click', () => {
      loanChartMode = 'monthly';
      loanMonthlyBtn.classList.add('active');
      loanYearlyBtn.classList.remove('active');
      renderLoanAnalyticsChart();
    });
    loanYearlyBtn.addEventListener('click', () => {
      loanChartMode = 'yearly';
      loanYearlyBtn.classList.add('active');
      loanMonthlyBtn.classList.remove('active');
      renderLoanAnalyticsChart();
    });
  }

  const fdMonthlyBtn = document.getElementById('fdChartMonthlyBtn');
  const fdYearlyBtn = document.getElementById('fdChartYearlyBtn');
  if (fdMonthlyBtn && fdYearlyBtn) {
    fdMonthlyBtn.addEventListener('click', () => {
      fdChartMode = 'monthly';
      fdMonthlyBtn.classList.add('active');
      fdYearlyBtn.classList.remove('active');
      renderFdAnalyticsChart();
    });
    fdYearlyBtn.addEventListener('click', () => {
      fdChartMode = 'yearly';
      fdYearlyBtn.classList.add('active');
      fdMonthlyBtn.classList.remove('active');
      renderFdAnalyticsChart();
    });
  }

  const navDashboardBtn = document.getElementById('navDashboardBtn');
  const navFdLoanBtn = document.getElementById('navFdLoanBtn');
  const dashboardViewSection = document.getElementById('dashboardViewSection');
  const fdLoanViewSection = document.getElementById('fdLoanViewSection');

  if (navDashboardBtn && navFdLoanBtn && dashboardViewSection && fdLoanViewSection) {
    navDashboardBtn.addEventListener('click', () => {
      currentModuleView = 'dashboard';
      navDashboardBtn.classList.add('active');
      navFdLoanBtn.classList.remove('active');
      dashboardViewSection.classList.remove('hidden');
      fdLoanViewSection.classList.add('hidden');
    });

    navFdLoanBtn.addEventListener('click', () => {
      currentModuleView = 'fdLoan';
      navFdLoanBtn.classList.add('active');
      navDashboardBtn.classList.remove('active');
      fdLoanViewSection.classList.remove('hidden');
      dashboardViewSection.classList.add('hidden');
      renderFdLoanModule();
    });
  }

  const subtabLoansBtn = document.getElementById('subtabLoansBtn');
  const subtabFdsBtn = document.getElementById('subtabFdsBtn');
  const clearFdLoanDataBtn = document.getElementById('clearFdLoanDataBtn');
  const loanTrackerContainer = document.getElementById('loanTrackerContainer');
  const fdTrackerContainer = document.getElementById('fdTrackerContainer');

  if (clearFdLoanDataBtn) {
    clearFdLoanDataBtn.addEventListener('click', () => {
      window.handleClearFdLoanData();
    });
  }

  if (subtabLoansBtn && subtabFdsBtn && loanTrackerContainer && fdTrackerContainer) {
    subtabLoansBtn.addEventListener('click', () => {
      currentFdLoanSubtab = 'loans';
      subtabLoansBtn.classList.add('active');
      subtabFdsBtn.classList.remove('active');
      loanTrackerContainer.classList.remove('hidden');
      fdTrackerContainer.classList.add('hidden');
    });

    subtabFdsBtn.addEventListener('click', () => {
      currentFdLoanSubtab = 'fds';
      subtabFdsBtn.classList.add('active');
      subtabLoansBtn.classList.remove('active');
      fdTrackerContainer.classList.remove('hidden');
      loanTrackerContainer.classList.add('hidden');
    });
  }

  const addLoanForm = document.getElementById('addLoanForm');
  if (addLoanForm) {
    addLoanForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const title = document.getElementById('loanTitle').value.trim();
      let principal = parseFloat(document.getElementById('loanPrincipal').value);
      const annualRate = parseFloat(document.getElementById('loanRate').value);
      const tenureMonths = parseInt(document.getElementById('loanTenure').value);
      const startDate = document.getElementById('loanStartDate').value || getFormattedDate(0);

      if (!title || isNaN(principal) || principal <= 0 || isNaN(annualRate) || isNaN(tenureMonths) || tenureMonths <= 0) {
        showToast('Please enter valid loan details.', 'danger');
        return;
      }

      if (currentCurrency === 'USD') {
        principal = principal * USD_TO_LKR_RATE;
      }

      const newLoan = {
        id: 'loan-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title,
        principal,
        annualRate,
        tenureMonths,
        startDate,
        createdAt: new Date().toISOString(),
        paidMonths: []
      };

      loans.unshift(newLoan);
      selectedLoanId = newLoan.id;
      saveLocalLoansCache();

      if (currentUser && db) {
        db.collection('users').doc(currentUser.uid).collection('loans').doc(newLoan.id).set(newLoan);
      }

      addLoanForm.reset();
      const startDateInput = document.getElementById('loanStartDate');
      if (startDateInput) startDateInput.value = getFormattedDate(0);
      renderFdLoanModule();
      showToast(`New loan "${title}" added successfully!`, 'success');
    });
  }

  const addFdForm = document.getElementById('addFdForm');
  if (addFdForm) {
    addFdForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const title = document.getElementById('fdTitle').value.trim();
      const depositElem = document.getElementById('fdDeposit') || document.getElementById('fdAmount');
      let depositAmount = depositElem ? parseFloat(depositElem.value) : NaN;
      const annualRate = parseFloat(document.getElementById('fdRate').value);
      const tenureMonths = parseInt(document.getElementById('fdTenure').value);
      const payoutFrequency = document.getElementById('fdPayoutFreq').value || 'monthly';
      const startDate = document.getElementById('fdStartDate').value || getFormattedDate(0);

      if (!title || isNaN(depositAmount) || depositAmount <= 0 || isNaN(annualRate) || isNaN(tenureMonths) || tenureMonths <= 0) {
        showToast('Please enter valid Fixed Deposit details.', 'danger');
        return;
      }

      if (currentCurrency === 'USD') {
        depositAmount = depositAmount * USD_TO_LKR_RATE;
      }

      const newFd = {
        id: 'fd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title,
        depositAmount,
        annualRate,
        tenureMonths,
        payoutFrequency,
        startDate,
        createdAt: new Date().toISOString(),
        collectedMonths: []
      };

      fixedDeposits.unshift(newFd);
      selectedFdId = newFd.id;
      saveLocalFdsCache();

      if (currentUser && db) {
        db.collection('users').doc(currentUser.uid).collection('fixedDeposits').doc(newFd.id).set(newFd);
      }

      addFdForm.reset();
      const startDateInput = document.getElementById('fdStartDate');
      if (startDateInput) startDateInput.value = getFormattedDate(0);
      renderFdLoanModule();
      showToast(`Fixed Deposit "${title}" added successfully!`, 'success');
    });
  }
}



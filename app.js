/**
 * FinPulse - Expense Tracker & Visual Analytics
 * Enhanced Core JavaScript Logic with Firebase Authentication, Firestore Sync,
 * Light/Dark Mode Toggle, and Multi-Currency Support.
 */

// App Version Configuration for Update Notifications
const CURRENT_APP_VERSION = '1.0.1';

// Local Storage Keys
const STORAGE_KEY = 'finpulse_transactions_v1';
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
  try {
    const configRes = await fetch('/firebase-applet-config.json');
    if (!configRes.ok) {
      throw new Error('Failed to load firebase-applet-config.json');
    }
    const firebaseConfig = await configRes.json();

    if (!window.firebase || !window.firebase.apps.length) {
      window.firebase.initializeApp(firebaseConfig);
    }

    auth = window.firebase.auth();
    db = window.firebase.firestore();

    if (window.firebase.analytics && firebaseConfig.measurementId) {
      try {
        window.firebase.analytics();
      } catch (e) {
        console.warn('Analytics initialization skipped:', e);
      }
    }

    // Attach auth handlers immediately so onAuthStateChanged fires without delay
    setupAuthHandlers();

    // Non-blocking connection test in background
    db.collection('test').doc('connection').get({ source: 'server' }).catch((err) => {
      if (err instanceof Error && err.message.includes('the client is offline')) {
        console.warn('Firebase connection test: client is offline');
      }
    });
  } catch (err) {
    console.error('Firebase Initialization Error:', err);
    showToast('Failed to initialize Firebase Auth', 'danger');
    hideAppLoader();
  }
}

// Setup Firebase Authentication Logic
function setupAuthHandlers() {
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
        console.error('Login error:', err);
        let msg = err.message || 'Login failed.';
        if (err.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password auth is disabled in your Firebase Console. Click "Continue as Guest" or enable Email/Password in Firebase Console.';
          const authNotice = document.getElementById('authNotice');
          if (authNotice) authNotice.classList.remove('hidden');
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          msg = 'Invalid email or password.';
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Please enter a valid email address.';
        }
        showToast(msg, 'danger');
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
        console.error('Signup error:', err);
        let msg = err.message || 'Failed to create account.';
        if (err.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password auth is disabled in your Firebase Console. Click "Continue as Guest" or enable Email/Password in Firebase Console.';
          const authNotice = document.getElementById('authNotice');
          if (authNotice) authNotice.classList.remove('hidden');
        } else if (err.code === 'auth/email-already-in-use') {
          msg = 'This email is already registered. Please sign in.';
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Please enter a valid email address.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'Password should be at least 6 characters.';
        }
        showToast(msg, 'danger');
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
        console.error('Password reset error:', err);
        let msg = err.message || 'Failed to send password reset email.';
        if (err.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password auth is disabled in your Firebase Console. Enable Email/Password under Auth -> Sign-in method.';
        } else if (err.code === 'auth/user-not-found') {
          msg = 'No account found with this email address.';
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Please enter a valid email address.';
        }
        showToast(msg, 'danger');
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
  auth.onAuthStateChanged((user) => {
    hideAppLoader();

    if (user) {
      currentUser = user;
      if (authScreen) authScreen.classList.add('hidden');
      if (appContainer) appContainer.classList.remove('hidden');

      if (userEmailText) {
        userEmailText.textContent = user.displayName || user.email;
      }

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
}

// Firestore Realtime Subscription for User Transactions
function subscribeToUserTransactions(userId) {
  if (!db) return;

  if (unsubscribeTransactions) {
    unsubscribeTransactions();
  }

  const txCollectionRef = db.collection('users').doc(userId).collection('transactions');

  unsubscribeTransactions = txCollectionRef.onSnapshot(async (snapshot) => {
    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push({ id: doc.id, ...data });
    });

    if (items.length === 0 && snapshot.metadata.fromCache === false) {
      // Seed initial demo data for a brand new account
      await seedUserDemoTransactions(userId);
      return;
    }

    transactions = items.filter(validateTransaction);
    saveLocalTransactionsCache();
    populateMonthFilter();
    renderApp();
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
  try {
    const batch = db.batch();
    DEMO_TRANSACTIONS.forEach(t => {
      const docRef = db.collection('users').doc(userId).collection('transactions').doc(t.id);
      batch.set(docRef, t);
    });
    await batch.commit();
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
    const stored = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
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

  if (currentUser && db) {
    try {
      await db.collection('users').doc(currentUser.uid).collection('transactions').doc(newTransaction.id).set(newTransaction);
    } catch (err) {
      console.error('Firestore save error:', err);
      showToast('Error syncing transaction to cloud.', 'danger');
    }
  } else {
    transactions.unshift(newTransaction);
    saveLocalTransactionsCache();
    populateMonthFilter();
    renderApp();
  }

  descriptionInput.value = '';
  amountInput.value = '';
  dateInput.value = getFormattedDate(0);
  descriptionInput.focus();

  // Check Category Monthly Spending Limit for Expenses
  if (type === 'expense') {
    const txMonthKey = getMonthKey(date);
    const budgets = getCategoryBudgets();
    const limitLKR = budgets[category] || DEFAULT_CATEGORY_BUDGETS[category] || 30000;

    const existingTotalLKR = transactions
      .filter(t => t.type === 'expense' && t.category === category && getMonthKey(t.date) === txMonthKey)
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    // If new transaction was added via firestore sync, transactions may already contain it; if local mode, we unshifted it above
    const currentCategoryTotalLKR = existingTotalLKR;

    if (currentCategoryTotalLKR > limitLKR) {
      const exceededLKR = currentCategoryTotalLKR - limitLKR;
      const alertMsg = `⚠️ Monthly Limit Exceeded! ${category} total for ${formatMonthLabel(txMonthKey)} reached ${formatCurrency(currentCategoryTotalLKR)} (Exceeded limit of ${formatCurrency(limitLKR)} by ${formatCurrency(exceededLKR)}).`;

      showToast(alertMsg, 'danger');

      // Trigger Web Desktop Notification if enabled
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
    if (currentUser && db) {
      try {
        await db.collection('users').doc(currentUser.uid).collection('transactions').doc(id).delete();
      } catch (err) {
        console.error('Firestore delete error:', err);
        showToast('Error deleting transaction from cloud.', 'danger');
      }
    } else {
      transactions = transactions.filter(t => t.id !== id);
      saveLocalTransactionsCache();
      populateMonthFilter();
      renderApp();
    }
    showToast(`Removed "${target.description}"`, 'info');
  }, 280);
};

async function confirmClearAll() {
  if (currentUser && db) {
    try {
      const userTxsRef = db.collection('users').doc(currentUser.uid).collection('transactions');
      const snapshot = await userTxsRef.get();
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (err) {
      console.error('Firestore clear all error:', err);
    }
  }

  transactions = [];
  saveLocalTransactionsCache();
  populateMonthFilter();
  renderApp();
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

// PDF Export
document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      showToast('PDF Library not loaded. Check internet connection.', 'danger');
      return;
    }

    const doc = new jsPDF();

    let totalIncome = 0;
    let totalExpenses = 0;
    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') totalIncome += amt;
      else totalExpenses += amt;
    });
    const totalBalance = totalIncome - totalExpenses;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("FinPulse Financial Report", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toISOString().split('T')[0]} | Currency: ${currentCurrency}`, 14, 25);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("Financial Summary", 14, 35);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Balance: ${totalBalance.toLocaleString()} ${currentCurrency}`, 14, 43);
    doc.text(`Total Income: ${totalIncome.toLocaleString()} ${currentCurrency}`, 14, 50);
    doc.text(`Total Expenses: ${totalExpenses.toLocaleString()} ${currentCurrency}`, 14, 57);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 63, 196, 63);

    let startY = 71;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Description", 14, startY);
    doc.text("Category", 90, startY);
    doc.text("Date", 130, startY);
    doc.text("Amount", 170, startY, { align: 'right' });

    startY += 4;
    doc.line(14, startY, 196, startY);
    startY += 8;

    if (transactions.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No transactions available.", 14, startY);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      transactions.forEach((t) => {
        if (startY > 275) {
          doc.addPage();
          startY = 20;
        }

        const isIncome = t.type === 'income';
        const amtPrefix = isIncome ? '+' : '-';
        const amountStr = `${amtPrefix} ${t.amount.toLocaleString()} ${currentCurrency}`;

        doc.setTextColor(30, 41, 59);
        doc.text(t.description.substring(0, 35), 14, startY);
        doc.text(t.category, 90, startY);
        doc.text(t.date, 130, startY);

        if (isIncome) {
          doc.setTextColor(16, 185, 129);
        } else {
          doc.setTextColor(244, 63, 94);
        }
        doc.text(amountStr, 170, startY, { align: 'right' });

        startY += 8;
        doc.setDrawColor(241, 245, 249);
        doc.line(14, startY - 2, 196, startY - 2);
      });
    }

    doc.save(`FinPulse-Report-${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF downloaded successfully!', 'success');
  } catch (error) {
    console.error("jsPDF Error:", error);
    showToast('Failed to generate PDF file.', 'danger');
  }
});

// JSON Export Backup Handler
function handleExportJson() {
  try {
    if (transactions.length === 0) {
      showToast('No transactions available to backup.', 'danger');
      return;
    }

    const dataStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');

    downloadAnchor.href = url;
    downloadAnchor.download = `FinPulse-Backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);

    showToast('Backup downloaded successfully!', 'success');
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
      if (!Array.isArray(parsedData)) {
        throw new Error('Invalid JSON format');
      }

      const validTransactions = parsedData.filter(validateTransaction);
      if (validTransactions.length === 0) {
        showToast('No valid transaction records found in file.', 'danger');
        return;
      }

      if (currentUser && db) {
        const batch = db.batch();
        validTransactions.forEach(t => {
          const docRef = db.collection('users').doc(currentUser.uid).collection('transactions').doc(t.id);
          batch.set(docRef, t);
        });
        await batch.commit();
      } else {
        transactions = validTransactions;
        saveLocalTransactionsCache();
        populateMonthFilter();
        renderApp();
      }

      showToast(`Successfully restored ${validTransactions.length} records!`, 'success');
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
          showUpdateBanner('v1.0.2', 'A new service worker update is ready to install.');
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
                showUpdateBanner('v1.0.2', 'A new version of FinPulse has been cached. Click below to reload.');
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
 * Compares two semver version strings (e.g. "1.0.2" vs "1.0.1")
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
      if (isManualCheck) showToast(`Running FinPulse v${CURRENT_APP_VERSION}`, 'info');
      return;
    }

    const data = await res.json();
    const latestVersion = data.version || '1.0.2';
    const releaseNotes = data.releaseNotes || 'A new update with performance enhancements and offline support is available.';

    if (data.downloadUrl) {
      const downloadBtn = document.getElementById('downloadReleaseBtn');
      if (downloadBtn) downloadBtn.href = data.downloadUrl;
    }

    if (isNewerVersion(latestVersion, CURRENT_APP_VERSION)) {
      showUpdateBanner(latestVersion, releaseNotes);
      if (isManualCheck) {
        showToast(`🚀 New update v${latestVersion} available!`, 'success');
      }
    } else {
      if (isManualCheck) {
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
 * Displays the glassmorphism Update Banner
 */
function showUpdateBanner(version, notes) {
  const banner = document.getElementById('updateBanner');
  const verText = document.getElementById('latestVersionText');
  const notesText = document.getElementById('updateBannerNotes');

  if (verText) verText.innerText = version.startsWith('v') ? version : `v${version}`;
  if (notesText && notes) notesText.innerText = notes;
  if (banner) banner.classList.remove('hidden');
}

/**
 * Dismisses the Update Banner
 */
function dismissUpdateBanner() {
  const banner = document.getElementById('updateBanner');
  if (banner) banner.classList.add('hidden');
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


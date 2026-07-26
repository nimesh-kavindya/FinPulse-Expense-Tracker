/**
 * FinPulse - Expense Tracker & Visual Analytics
 * Enhanced Core JavaScript Logic (with LKR & USD Currency Converter)
 */

// Local Storage Key & Storage Manager
const STORAGE_KEY = 'finpulse_transactions_v1';
const CURRENCY_STORAGE_KEY = 'finpulse_currency';
const USD_TO_LKR_RATE = 326.74; // ඩොලර් එකක දළ අගය (Exchange Rate)

// Current Currency State
let currentCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY) || 'LKR';

// Category Definitions & Theme Color Mapping
const CATEGORY_CONFIG = {
  Food: { icon: 'fa-utensils', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
  Utilities: { icon: 'fa-bolt', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  Salary: { icon: 'fa-money-bill-wave', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  Entertainment: { icon: 'fa-gamepad', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  Shopping: { icon: 'fa-bag-shopping', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  Other: { icon: 'fa-layer-group', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
};

// Initial Demo Data
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

// DOM Elements
const totalBalanceEl = document.getElementById('totalBalance');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpensesEl = document.getElementById('totalExpenses');
const balanceStatusEl = document.getElementById('balanceStatus');

const transactionForm = document.getElementById('transactionForm');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const dateInput = document.getElementById('date');

const amountLabel = document.getElementById('amountLabel');
const currencySymbolIcon = document.getElementById('currencySymbolIcon');

const transactionListEl = document.getElementById('transactionList');
const transactionCountEl = document.getElementById('transactionCount');
const emptyListStateEl = document.getElementById('emptyListState');

const searchInput = document.getElementById('searchInput');
const filterMonthSelect = document.getElementById('filterMonth');
const filterCategorySelect = document.getElementById('filterCategory');
const filterTypeSelect = document.getElementById('filterType');

const resetDemoBtn = document.getElementById('resetDemoBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

const confirmModal = document.getElementById('confirmModal');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const confirmModalBtn = document.getElementById('confirmModalBtn');

const topExpenseCategoryBadge = document.getElementById('topExpenseCategoryBadge');
const chartEmptyStateEl = document.getElementById('chartEmptyState');
const toastContainer = document.getElementById('toastContainer');

// Currency Selector Element
const currencySelect = document.getElementById('currencySelect');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Set default date picker to today
  dateInput.value = getFormattedDate(0);

  // Setup Currency Selector Value & Event
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

  // Load transactions from localStorage with error handling
  loadTransactions();

  // Populate dynamic month dropdown options
  populateMonthFilter();

  // Initialize Chart.js
  initChart();

  // Initial Full Render Pipeline
  renderApp();

  // Attach Event Listeners
  transactionForm.addEventListener('submit', handleAddTransaction);
  searchInput.addEventListener('input', renderApp);
  filterMonthSelect.addEventListener('change', renderApp);
  filterCategorySelect.addEventListener('change', renderApp);
  filterTypeSelect.addEventListener('change', renderApp);

  resetDemoBtn.addEventListener('click', handleResetDemo);

  // Custom Modal Triggers
  clearAllBtn.addEventListener('click', showConfirmModal);
  cancelModalBtn.addEventListener('click', hideConfirmModal);
  confirmModalBtn.addEventListener('click', handleConfirmClearAll);

  // Close modal when clicking backdrop
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) hideConfirmModal();
  });
});

// Update Form Amount Label and Icon based on Currency
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

// LocalStorage Optimization & Robust Data Validation
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

function loadTransactions() {
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
    showToast('Notice: Restored demo dataset due to storage error.', 'info');
  }

  transactions = [...DEMO_TRANSACTIONS];
  saveTransactions();
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    console.error('LocalStorage write error:', err);
    showToast('Storage Limit Reached: Could not save transaction.', 'danger');
  }
}

// Dynamic Month Filter Helper Functions
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
  const selectedMonth = filterMonthSelect.value;
  const selectedCategory = filterCategorySelect.value;
  const selectedType = filterTypeSelect.value;
  const searchTerm = searchInput.value.trim().toLowerCase();

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

// Full Application Render Pipeline
function renderApp() {
  const activeMonth = filterMonthSelect.value;
  const monthTransactions = transactions.filter(t => activeMonth === 'all' || getMonthKey(t.date) === activeMonth);
  const filteredList = getFilteredTransactions();

  renderSummaryCards(monthTransactions);
  renderTransactionList(filteredList);
  updateChart(monthTransactions);
}

function renderSummaryCards(monthTransactions) {
  let income = 0;
  let expenses = 0;

  monthTransactions.forEach(t => {
    const amt = parseFloat(t.amount) || 0;
    if (t.type === 'income') {
      income += amt;
    } else {
      expenses += amt;
    }
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

function handleAddTransaction(e) {
  e.preventDefault();

  const description = descriptionInput.value.trim();
  let amount = parseFloat(amountInput.value);
  const type = document.querySelector('input[name="type"]:checked').value;
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
    date
  };

  transactions.unshift(newTransaction);
  saveTransactions();
  populateMonthFilter();
  renderApp();

  descriptionInput.value = '';
  amountInput.value = '';
  dateInput.value = getFormattedDate(0);
  descriptionInput.focus();

  showToast(`Added ${type === 'income' ? 'Income' : 'Expense'}: "${description}"`, 'success');
}

window.handleDeleteTransaction = function (id, itemEl) {
  const target = transactions.find(t => t.id === id);
  if (!target) return;

  if (itemEl) {
    itemEl.classList.add('deleting');
  }

  setTimeout(() => {
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    populateMonthFilter();
    renderApp();
    showToast(`Removed "${target.description}"`, 'info');
  }, 280);
};

function handleResetDemo() {
  transactions = [...DEMO_TRANSACTIONS];
  saveTransactions();
  populateMonthFilter();
  renderApp();
  showToast('Demo dataset restored successfully.', 'info');
}

function showConfirmModal() {
  confirmModal.classList.remove('hidden');
}

function hideConfirmModal() {
  confirmModal.classList.add('hidden');
}

function handleConfirmClearAll() {
  transactions = [];
  saveTransactions();
  populateMonthFilter();
  renderApp();
  hideConfirmModal();
  showToast('All transaction records cleared.', 'danger');
}

function initChart() {
  const ctx = document.getElementById('expenseChart').getContext('2d');

  expenseChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [],
        borderColor: '#0f172a',
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
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
            padding: 14,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
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
  if (!expenseChartInstance) return;

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
// Smooth Loading Screen Dismissal with delay
window.addEventListener('load', () => {
  const appLoader = document.getElementById('appLoader');
  if (appLoader) {
    setTimeout(() => {
      appLoader.classList.add('fade-out');
    }, 1200); // මෙතන අගය වැඩි කළාම ලෝඩින් ස්ක්‍රීන් එක තව ටික වෙලා තියෙලා යන්නේ
  }
});
document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
  window.print();
});
// ==========================================
// Professional PDF Export using jsPDF for Mobile & Desktop
// ==========================================
document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FinPulse Expenses Tracker", 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Financial Analytics Report", 14, 26);

  doc.setLineWidth(0.5);
  doc.line(14, 30, 196, 30);

  // Table Headers / Content from Transactions
  let y = 40;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Description", 14, y);
  doc.text("Category", 100, y);
  doc.text("Amount", 160, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (transactions.length === 0) {
    doc.text("No transactions available.", 14, y);
  } else {
    transactions.forEach(t => {
      if (y > 270) { // New page if limit reached
        doc.addPage();
        y = 20;
      }

      let desc = t.description.length > 35 ? t.description.substring(0, 32) + '...' : t.description;
      let amtText = (t.type === 'income' ? '+' : '-') + t.amount + ' ' + currentCurrency;

      doc.text(desc, 14, y);
      doc.text(t.category, 100, y);
      doc.text(amtText, 160, y);

      y += 8;
    });
  }

  // Save PDF file (Mobile & PC friendly)
  doc.save(`finpulse_report_${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('PDF downloaded successfully!', 'success');
});
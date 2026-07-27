/**
 * FinPulse - Expense Tracker & Visual Analytics
 * Enhanced Core JavaScript Logic (with LKR & USD Currency Converter)
 */

// App Version Configuration for Update Notifications
const CURRENT_APP_VERSION = '1.0.1';

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

const clearAllBtn = document.getElementById('clearAllBtn');
const confirmModal = document.getElementById('confirmModal');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const confirmModalBtn = document.getElementById('confirmModalBtn');

const topExpenseCategoryBadge = document.getElementById('topExpenseCategoryBadge');
const chartEmptyStateEl = document.getElementById('chartEmptyState');
const toastContainer = document.getElementById('toastContainer');
const currencySelect = document.getElementById('currencySelect');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Check for App Updates
  const savedVersion = localStorage.getItem('finpulse_version');
  if (!savedVersion) {
    localStorage.setItem('finpulse_version', CURRENT_APP_VERSION);
  } else if (savedVersion !== CURRENT_APP_VERSION) {
    const updateBanner = document.getElementById('updateBanner');
    if (updateBanner) {
      updateBanner.style.display = 'block';
    }
  }

  if (dateInput) {
    dateInput.value = getFormattedDate(0);
  }

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

  loadTransactions();
  populateMonthFilter();
  initChart();
  renderApp();

  if (transactionForm) {
    transactionForm.addEventListener('submit', handleAddTransaction);
  }
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

  if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', hideConfirmModal);
  }

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
});

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
  }

  transactions = [...DEMO_TRANSACTIONS];
  saveTransactions();
}

function saveTransactions() {
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

function handleAddTransaction(e) {
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

  if (itemEl) itemEl.classList.add('deleting');

  setTimeout(() => {
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    populateMonthFilter();
    renderApp();
    showToast(`Removed "${target.description}"`, 'info');
  }, 280);
};

function confirmClearAll() {
  transactions = [];
  saveTransactions();
  populateMonthFilter();
  renderApp();
  showToast('All transaction records cleared.', 'danger');
}

function showConfirmModal() {
  if (confirmModal) confirmModal.classList.remove('hidden');
}

function hideConfirmModal() {
  if (confirmModal) confirmModal.classList.add('hidden');
}

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

// Smooth Loading Screen Dismissal
window.addEventListener('load', () => {
  const appLoader = document.getElementById('appLoader');
  if (appLoader) {
    setTimeout(() => {
      appLoader.classList.add('fade-out');
    }, 800);
  }
});

// Clean & Fixed PDF File Download using jsPDF
document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      showToast('PDF Library not loaded. Check internet connection.', 'danger');
      return;
    }

    const doc = new jsPDF();

    // Calculate Summary Values
    let totalIncome = 0;
    let totalExpenses = 0;
    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') totalIncome += amt;
      else totalExpenses += amt;
    });
    const totalBalance = totalIncome - totalExpenses;

    // --- Title & Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("FinPulse Financial Report", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toISOString().split('T')[0]} | Currency: ${currentCurrency}`, 14, 25);

    // --- Summary Section ---
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

    // Divider Line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 63, 196, 63);

    // --- Table Headers ---
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

    // --- Transactions List ---
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
          doc.setTextColor(16, 185, 129); // Green
        } else {
          doc.setTextColor(244, 63, 94); // Red
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
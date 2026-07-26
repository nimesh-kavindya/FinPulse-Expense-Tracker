/* ==========================================
   FinPulse - Main Application Script
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const transactionForm = document.getElementById('transactionForm');
  const descriptionInput = document.getElementById('description');
  const amountInput = document.getElementById('amount');
  const categorySelect = document.getElementById('category');
  const dateInput = document.getElementById('date');
  const typeExpenseRadio = document.getElementById('typeExpense');
  const typeIncomeRadio = document.getElementById('typeIncome');

  const totalBalanceEl = document.getElementById('totalBalance');
  const totalIncomeEl = document.getElementById('totalIncome');
  const totalExpensesEl = document.getElementById('totalExpenses');
  const balanceStatusEl = document.getElementById('balanceStatus');

  const transactionListEl = document.getElementById('transactionList');
  const emptyListStateEl = document.getElementById('emptyListState');
  const transactionCountEl = document.getElementById('transactionCount');

  const searchInput = document.getElementById('searchInput');
  const filterMonthSelect = document.getElementById('filterMonth');
  const filterCategorySelect = document.getElementById('filterCategory');
  const filterTypeSelect = document.getElementById('filterType');

  const resetDemoBtn = document.getElementById('resetDemoBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const currencySelect = document.getElementById('currencySelect');
  const currencySymbolIcon = document.getElementById('currencySymbolIcon');
  const amountLabel = document.getElementById('amountLabel');

  const confirmModal = document.getElementById('confirmModal');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const confirmModalBtn = document.getElementById('confirmModalBtn');

  const chartEmptyState = document.getElementById('chartEmptyState');
  const topExpenseCategoryBadge = document.getElementById('topExpenseCategoryBadge');

  // State Management
  let transactions = JSON.parse(localStorage.getItem('finpulse_transactions')) || [];
  let currentCurrency = localStorage.getItem('finpulse_currency') || 'LKR';
  let expenseChartInstance = null;

  // Set Default Date to Today
  dateInput.valueAsDate = new Date();
  currencySelect.value = currentCurrency;

  // Initialize App
  updateCurrencyUI();
  initChart();
  renderApp();

  // Event Listeners
  transactionForm.addEventListener('submit', handleAddTransaction);
  typeExpenseRadio.addEventListener('change', updateFormTypeUI);
  typeIncomeRadio.addEventListener('change', updateFormTypeUI);

  searchInput.addEventListener('input', renderTransactions);
  filterMonthSelect.addEventListener('change', renderTransactions);
  filterCategorySelect.addEventListener('change', renderTransactions);
  filterTypeSelect.addEventListener('change', renderTransactions);

  resetDemoBtn.addEventListener('click', handleResetDemo);
  clearAllBtn.addEventListener('click', () => confirmModal.classList.remove('hidden'));
  cancelModalBtn.addEventListener('click', () => confirmModal.classList.add('hidden'));
  confirmModalBtn.addEventListener('click', handleClearAll);

  currencySelect.addEventListener('change', (e) => {
    currentCurrency = e.target.value;
    localStorage.setItem('finpulse_currency', currentCurrency);
    updateCurrencyUI();
    renderApp();
    showToast(`Currency changed to ${currentCurrency}`, 'success');
  });

  function updateCurrencyUI() {
    if (currentCurrency === 'LKR') {
      currencySymbolIcon.textContent = 'Rs.';
      amountLabel.textContent = 'Amount (LKR)';
    } else {
      currencySymbolIcon.textContent = '$';
      amountLabel.textContent = 'Amount (USD)';
    }
  }

  function formatMoney(amount) {
    const symbol = currentCurrency === 'LKR' ? 'Rs. ' : '$';
    return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function updateFormTypeUI() {
    if (typeIncomeRadio.checked) {
      categorySelect.value = 'Salary';
    } else {
      categorySelect.value = 'Food';
    }
  }

  function handleAddTransaction(e) {
    e.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const category = categorySelect.value;
    const date = dateInput.value;
    const type = typeIncomeRadio.checked ? 'income' : 'expense';

    if (!description || isNaN(amount) || amount <= 0 || !date) {
      showToast('Please fill out all fields correctly.', 'error');
      return;
    }

    const newTransaction = {
      id: 'txn_' + Date.now(),
      description,
      amount,
      category,
      date,
      type
    };

    transactions.unshift(newTransaction);
    saveAndRender();
    transactionForm.reset();
    dateInput.valueAsDate = new Date();
    updateFormTypeUI();

    showToast('Transaction added successfully!', 'success');
  }

  function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveAndRender();
    showToast('Transaction removed.', 'success');
  }

  function handleResetDemo() {
    const demoData = [
      { id: 'demo_1', description: 'Monthly Salary', amount: 150000, category: 'Salary', date: '2026-07-01', type: 'income' },
      { id: 'demo_2', description: 'Supermarket Grocery', amount: 18500, category: 'Food', date: '2026-07-05', type: 'expense' },
      { id: 'demo_3', description: 'Electricity & Water Bill', amount: 6200, category: 'Utilities', date: '2026-07-10', type: 'expense' },
      { id: 'demo_4', description: 'Movie Night & Dinner', amount: 4500, category: 'Entertainment', date: '2026-07-15', type: 'expense' },
      { id: 'demo_5', description: 'New Running Shoes', amount: 12000, category: 'Shopping', date: '2026-07-20', type: 'expense' }
    ];
    transactions = demoData;
    saveAndRender();
    showToast('Demo sample data loaded!', 'success');
  }

  function handleClearAll() {
    transactions = [];
    saveAndRender();
    confirmModal.classList.add('hidden');
    showToast('All transaction records cleared.', 'error');
  }

  function saveAndRender() {
    localStorage.setItem('finpulse_transactions', JSON.stringify(transactions));
    renderApp();
  }

  function renderApp() {
    populateMonthFilterOptions();
    renderSummary();
    renderTransactions();
    updateChart();
  }

  function populateMonthFilterOptions() {
    const months = [...new Set(transactions.map(t => t.date.substring(0, 7)))].sort().reverse();
    const currentSelectedMonth = filterMonthSelect.value;

    filterMonthSelect.innerHTML = '<option value="all">All Months</option>';
    months.forEach(monthStr => {
      const [year, month] = monthStr.split('-');
      const dateObj = new Date(year, month - 1, 1);
      const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const option = document.createElement('option');
      option.value = monthStr;
      option.textContent = monthName;
      filterMonthSelect.appendChild(option);
    });

    if (months.includes(currentSelectedMonth)) {
      filterMonthSelect.value = currentSelectedMonth;
    }
  }

  function getFilteredTransactions() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedMonth = filterMonthSelect.value;
    const selectedCategory = filterCategorySelect.value;
    const selectedType = filterTypeSelect.value;

    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm) || t.category.toLowerCase().includes(searchTerm);
      const matchesMonth = selectedMonth === 'all' || t.date.startsWith(selectedMonth);
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      const matchesType = selectedType === 'all' || t.type === selectedType;

      return matchesSearch && matchesMonth && matchesCategory && matchesType;
    });
  }

  function renderSummary() {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const totalBalance = totalIncome - totalExpenses;

    totalIncomeEl.textContent = formatMoney(totalIncome);
    totalExpensesEl.textContent = formatMoney(totalExpenses);
    totalBalanceEl.textContent = formatMoney(totalBalance);

    if (totalBalance >= 0) {
      balanceStatusEl.className = 'metric-status positive';
      balanceStatusEl.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i> Net Surplus Standing';
    } else {
      balanceStatusEl.className = 'metric-status negative';
      balanceStatusEl.innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i> Net Deficit Standing';
    }
  }

  function renderTransactions() {
    const filtered = getFilteredTransactions();
    transactionListEl.innerHTML = '';
    transactionCountEl.textContent = `${filtered.length} Items`;

    if (filtered.length === 0) {
      emptyListStateEl.classList.remove('hidden');
    } else {
      emptyListStateEl.classList.add('hidden');
      filtered.forEach(t => {
        const li = document.createElement('li');
        li.className = 'transaction-item';

        const iconClass = getCategoryIcon(t.category);

        li.innerHTML = `
          <div class="transaction-info">
            <div class="transaction-cat-icon cat-${t.category}">
              <i class="${iconClass}"></i>
            </div>
            <div class="transaction-details">
              <h4>${escapeHtml(t.description)}</h4>
              <div class="transaction-meta">
                <span><i class="fa-regular fa-calendar"></i> ${t.date}</span>
                <span>&bull;</span>
                <span>${t.category}</span>
              </div>
            </div>
          </div>
          <div class="transaction-right">
            <span class="transaction-amount ${t.type}">
              ${t.type === 'income' ? '+' : '-'}${formatMoney(t.amount)}
            </span>
            <button class="delete-btn" title="Delete Transaction" onclick="window.removeTxn('${t.id}')">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
        transactionListEl.appendChild(li);
      });
    }
  }

  window.removeTxn = function (id) {
    deleteTransaction(id);
  };

  function getCategoryIcon(category) {
    switch (category) {
      case 'Food': return 'fa-solid fa-utensils';
      case 'Utilities': return 'fa-solid fa-bolt';
      case 'Salary': return 'fa-solid fa-briefcase';
      case 'Entertainment': return 'fa-solid fa-film';
      case 'Shopping': return 'fa-solid fa-bag-shopping';
      default: return 'fa-solid fa-shapes';
    }
  }

  function initChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    expenseChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#a78bfa', '#ec4899', '#94a3b8'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#f8fafc',
              font: { family: 'Plus Jakarta Sans', size: 11 },
              boxWidth: 12,
              padding: 12
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  function updateChart() {
    const filtered = getFilteredTransactions().filter(t => t.type === 'expense');
    const categoryTotals = {};

    filtered.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    if (labels.length === 0) {
      chartEmptyState.classList.remove('hidden');
      topExpenseCategoryBadge.textContent = 'Top Category: N/A';
    } else {
      chartEmptyState.classList.add('hidden');
      const topCategory = labels.reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b);
      topExpenseCategoryBadge.textContent = `Top Category: ${topCategory}`;
    }

    expenseChartInstance.data.labels = labels;
    expenseChartInstance.data.datasets[0].data = data;
    expenseChartInstance.update();
  }

  function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-solid fa-circle-check';
    if (type === 'error') icon = 'fa-solid fa-circle-exclamation';

    toast.innerHTML = `<i class="${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
});

// Loading Screen Dismissal
window.addEventListener('load', () => {
  const appLoader = document.getElementById('appLoader');
  if (appLoader) {
    setTimeout(() => {
      appLoader.classList.add('fade-out');
    }, 450);
  }
});
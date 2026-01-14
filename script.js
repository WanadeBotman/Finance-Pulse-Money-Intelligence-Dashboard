// ─── DATA ────────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('financeTransactions')) || [];
let budgets = JSON.parse(localStorage.getItem('financeBudgets')) || {};
let savingsGoals = JSON.parse(localStorage.getItem('financeSavingsGoals')) || [];
let currentMonth = new Date();
let recurringTransactions = JSON.parse(localStorage.getItem('financeRecurring')) || [];
let charts = {};

// ─── DOM ELEMENTS ────────────────────────────────────────
const form          = document.getElementById('transactionForm');
const balanceEl     = document.getElementById('balance');
const healthEl      = document.getElementById('healthScore');
const healthLabel   = document.getElementById('healthLabel');
const monthSpending = document.getElementById('monthSpending');
const recentList    = document.getElementById('recentList');
const categoryBars  = document.getElementById('categoryBars');
const insightsList  = document.getElementById('insights');
const savingsRateEl = document.getElementById('savingsRate');
const analyticsGrid = document.getElementById('analyticsGrid');
const darkModeBtn   = document.getElementById('darkModeToggle');
const prevMonthBtn  = document.getElementById('prevMonth');
const nextMonthBtn  = document.getElementById('nextMonth');
const monthDisplay  = document.getElementById('currentMonth');
const exportCSVBtn  = document.getElementById('exportCSV');
const exportPDFBtn  = document.getElementById('exportPDF');
const searchInput   = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const typeFilter    = document.getElementById('typeFilter');
const clearFiltersBtn = document.getElementById('clearFilters');
const editModal     = document.getElementById('editModal');
const importModal   = document.getElementById('importModal');

// ─── UTILITIES ───────────────────────────────────────────
function saveData() {
  localStorage.setItem('financeTransactions', JSON.stringify(transactions));
  localStorage.setItem('financeBudgets', JSON.stringify(budgets));
  localStorage.setItem('financeSavingsGoals', JSON.stringify(savingsGoals));
  localStorage.setItem('financeRecurring', JSON.stringify(recurringTransactions));
}

function getCurrentMonthKey() {
  return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth()+1).padStart(2,'0')}`;
}

function getThisMonthTransactions() {
  const key = getCurrentMonthKey();
  return transactions.filter(t => t.date.startsWith(key));
}

function getMonthTransactions(monthKey) {
  return transactions.filter(t => t.date.startsWith(monthKey));
}

function calculateTotals(monthKey = null) {
  const thisMonth = monthKey ? getMonthTransactions(monthKey) : getThisMonthTransactions();

  let income  = 0;
  let expense = 0;
  const byCategory = {};

  thisMonth.forEach(t => {
    if (t.type === 'income') {
      income += t.amount;
    } else {
      expense += t.amount;
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    }
  });

  const balance = income - expense;

  // Budget health score
  let health = 100;
  if (income > 0) {
    if (expense > income * 0.9) health -= 40;
    if (expense > income)       health -= 35;
    if (expense > income * 1.3) health -= 30;
  }
  health = Math.max(0, Math.min(100, Math.round(health)));

  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;

  return { balance, income, expense, byCategory, health, savingsRate };
}

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentMonth);
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    const totals = calculateTotals(key);
    months.push({ key, ...totals });
  }
  return months;
}

function updateUI() {
  const { balance, income, expense, byCategory, health, savingsRate } = calculateTotals();

  // Update header month display
  const monthName = currentMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  monthDisplay.textContent = monthName;

  // Balance
  balanceEl.textContent = `R ${balance.toFixed(2)}`;
  balanceEl.className = 'big-number ' + (balance >= 0 ? '' : 'negative');

  // Health score
  healthEl.textContent = health + '%';
  healthEl.className = 'big-number';
  if      (health < 50) healthEl.classList.add('negative');
  else if (health < 75) healthEl.classList.add('warning');
  healthLabel.textContent = health >= 85 ? "Healthy" : health >= 65 ? "Moderate" : "Needs Attention";

  // Month spending
  monthSpending.textContent = `R ${expense.toFixed(2)}`;

  // Savings rate
  savingsRateEl.textContent = savingsRate + '%';
  savingsRateEl.className = 'big-number ' + (savingsRate >= 0 ? '' : 'negative');

  // Recent transactions (last 12)
  const filteredTransactions = getFilteredTransactions();
  recentList.innerHTML = filteredTransactions
    .slice(-12)
    .reverse()
    .map((t, idx) => `
      <div class="transaction-item" onclick="editTransaction(${transactions.indexOf(t)})">
        <div>
          <strong>${t.date}</strong> • ${t.category}
          <div style="color:#6c757d;font-size:0.9rem">${t.note || ''}</div>
        </div>
        <div class="${t.type}">
          ${t.type === 'income' ? '+' : '-'}R ${t.amount.toFixed(2)}
        </div>
      </div>
    `).join('');

  // Category bars
  const totalExpense = expense || 1;
  const sortedCats = Object.entries(byCategory)
    .sort((a,b) => b[1] - a[1])
    .slice(0,6);

  categoryBars.innerHTML = sortedCats.map(([cat, amt]) => {
    const pct = (amt / totalExpense * 100).toFixed(1);
    return `
      <div class="bar-item">
        <div class="bar-label">${cat}</div>
        <div class="bar-wrapper">
          <div class="bar-fill" style="width: ${pct}%"></div>
        </div>
        <div style="width:70px;text-align:right;font-weight:500">
          R ${amt.toFixed(0)}
        </div>
      </div>
    `;
  }).join('');

  // Update charts
  updateCharts(byCategory, income, expense);

  // Update analytics
  updateAnalytics(income, expense, byCategory);

  // Update budgets display
  updateBudgetsDisplay(byCategory);

  // Insights
  const insightItems = [];

  if (expense > 0) {
    const topCat = sortedCats[0] || ['',0];
    insightItems.push(`Your biggest spending category this month is <strong>${topCat[0]}</strong> (R ${topCat[1].toFixed(0)})`);
  }

  if (health < 60) {
    insightItems.push("You're spending more than you earn this month. Consider reviewing subscriptions and discretionary spending.");
  } else if (health < 80) {
    insightItems.push("You're close to your limit. Try to keep remaining expenses low for the rest of the month.");
  } else {
    insightItems.push("Good job! Your finances are in a healthy position this month.");
  }

  // Budget warnings
  Object.entries(budgets).forEach(([cat, limit]) => {
    const spent = byCategory[cat] || 0;
    if (spent > limit * 0.8) {
      insightItems.push(`⚠️ <strong>${cat}</strong>: You've spent R ${spent.toFixed(0)}/${limit} (${(spent/limit*100).toFixed(0)}%)`);
    }
  });

  insightsList.innerHTML = insightItems.map(txt => `<li>${txt}</li>`).join('');
}

function getFilteredTransactions() {
  const search = searchInput.value.toLowerCase();
  const category = categoryFilter.value;
  const type = typeFilter.value;
  const monthKey = getCurrentMonthKey();

  return transactions.filter(t => {
    const matchesMonth = t.date.startsWith(monthKey);
    const matchesSearch = !search || t.note.toLowerCase().includes(search) || t.category.toLowerCase().includes(search);
    const matchesCategory = !category || t.category === category;
    const matchesType = !type || t.type === type;
    
    return matchesMonth && matchesSearch && matchesCategory && matchesType;
  });
}

function updateCharts(byCategory, income, expense) {
  // Pie Chart
  const ctx1 = document.getElementById('pieChart');
  if (!ctx1) return;

  if (charts.pie) charts.pie.destroy();
  
  const cats = Object.keys(byCategory);
  const values = Object.values(byCategory);
  
  charts.pie = new Chart(ctx1, {
    type: 'doughnut',
    data: {
      labels: cats,
      datasets: [{
        data: values,
        backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14', '#e83e8c']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // Income vs Expense Chart
  const ctx2 = document.getElementById('incomeExpenseChart');
  if (charts.incomeExpense) charts.incomeExpense.destroy();

  charts.incomeExpense = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expense'],
      datasets: [{
        label: 'Amount (R)',
        data: [income, expense],
        backgroundColor: ['#198754', '#dc3545']
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } }
    }
  });

  // Trend Chart (Last 6 months)
  const ctx3 = document.getElementById('trendChart');
  if (charts.trend) charts.trend.destroy();

  const last6 = getLast6Months();
  const monthLabels = last6.map(m => m.key.slice(5));

  charts.trend = new Chart(ctx3, {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: 'Income',
          data: last6.map(m => m.income),
          borderColor: '#198754',
          backgroundColor: 'rgba(25, 135, 84, 0.1)',
          tension: 0.4
        },
        {
          label: 'Expense',
          data: last6.map(m => m.expense),
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function updateAnalytics(income, expense, byCategory) {
  const totalSpent = expense;
  const topCategory = Object.entries(byCategory).sort((a,b) => b[1] - a[1])[0] || ['N/A', 0];
  const avgExpense = Object.values(byCategory).length > 0 ? totalSpent / Object.values(byCategory).length : 0;
  const maxExpense = Math.max(...Object.values(byCategory), 0);
  const minExpense = Math.min(...Object.values(byCategory).filter(v => v > 0), Infinity);

  analyticsGrid.innerHTML = `
    <div class="analytics-item">
      <h4>Total Spending</h4>
      <div class="analytics-value">R ${totalSpent.toFixed(0)}</div>
    </div>
    <div class="analytics-item">
      <h4>Top Category</h4>
      <div class="analytics-value">${topCategory[0]}</div>
      <small>R ${topCategory[1].toFixed(0)}</small>
    </div>
    <div class="analytics-item">
      <h4>Average / Category</h4>
      <div class="analytics-value">R ${avgExpense.toFixed(0)}</div>
    </div>
    <div class="analytics-item">
      <h4>Highest Expense</h4>
      <div class="analytics-value">R ${maxExpense.toFixed(0)}</div>
    </div>
    <div class="analytics-item">
      <h4>Lowest Expense</h4>
      <div class="analytics-value">R ${(minExpense === Infinity ? 0 : minExpense).toFixed(0)}</div>
    </div>
    <div class="analytics-item">
      <h4>Monthly Income</h4>
      <div class="analytics-value">R ${income.toFixed(0)}</div>
    </div>
  `;
}

function updateBudgetsDisplay(byCategory) {
  const budgetsDisplay = document.getElementById('budgetsList');
  if (!budgetsDisplay) return;

  const budgetHTML = Object.entries(budgets).map(([cat, limit]) => {
    const spent = byCategory[cat] || 0;
    const pct = Math.round((spent / limit) * 100);
    const status = spent > limit ? 'exceeded' : spent > limit * 0.8 ? 'warning' : '';
    
    return `
      <div class="budget-item ${status}">
        <h4>${cat}</h4>
        <div>Spent: R ${spent.toFixed(0)} / R ${limit}</div>
        <div class="budget-bar">
          <div class="budget-fill" style="width: ${Math.min(pct, 100)}%">${pct}%</div>
        </div>
      </div>
    `;
  }).join('');

  budgetsDisplay.innerHTML = budgetHTML || '<p style="color: #6c757d;">No budgets set</p>';

  // Goals display
  const goalsDisplay = document.getElementById('goalsList');
  if (goalsDisplay) {
    const goalsHTML = savingsGoals.map(goal => {
      const saved = goal.currentAmount || 0;
      const pct = Math.round((saved / goal.targetAmount) * 100);
      
      return `
        <div class="goal-item">
          <h4>${goal.name}</h4>
          <div>Saved: R ${saved.toFixed(0)} / R ${goal.targetAmount}</div>
          <div class="goal-bar">
            <div class="goal-fill" style="width: ${Math.min(pct, 100)}%">${pct}%</div>
          </div>
        </div>
      `;
    }).join('');

    goalsDisplay.innerHTML = goalsHTML || '<p style="color: #6c757d;">No savings goals set</p>';
  }
}

// ─── FORM HANDLING ───────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();

  const amount = Number(document.getElementById('amount').value);
  const isRecurring = document.getElementById('isRecurring').checked;
  
  if (amount <= 0) return;

  const entry = {
    date:     document.getElementById('date').value,
    amount,
    category: document.getElementById('category').value,
    type:     document.getElementById('type').value,
    note:     document.getElementById('note').value.trim()
  };

  transactions.push(entry);
  
  // Add to recurring list if checked
  if (isRecurring) {
    recurringTransactions.push(entry);
  }

  saveData();
  updateUI();

  form.reset();
  document.getElementById('date').value = new Date().toISOString().slice(0,10);
  
  // Show brief success feedback
  const button = form.querySelector('button');
  const originalText = button.textContent;
  button.textContent = '✓ Added';
  setTimeout(() => {
    button.textContent = originalText;
  }, 1000);
});

// Edit Transaction
let editingIndex = -1;

function editTransaction(index) {
  editingIndex = index;
  const t = transactions[index];
  document.getElementById('editDate').value = t.date;
  document.getElementById('editAmount').value = t.amount;
  document.getElementById('editCategory').value = t.category;
  document.getElementById('editType').value = t.type;
  document.getElementById('editNote').value = t.note || '';
  editModal.classList.add('show');
}

document.getElementById('editForm').addEventListener('submit', e => {
  e.preventDefault();
  
  if (editingIndex < 0) return;
  
  transactions[editingIndex] = {
    date: document.getElementById('editDate').value,
    amount: Number(document.getElementById('editAmount').value),
    category: document.getElementById('editCategory').value,
    type: document.getElementById('editType').value,
    note: document.getElementById('editNote').value.trim()
  };
  
  saveData();
  updateUI();
  editModal.classList.remove('show');
});

document.getElementById('deleteTransactionBtn').addEventListener('click', () => {
  if (editingIndex >= 0) {
    transactions.splice(editingIndex, 1);
    saveData();
    updateUI();
    editModal.classList.remove('show');
  }
});

// Budget Management
document.getElementById('setBudgetBtn').addEventListener('click', () => {
  const category = document.getElementById('budgetCategory').value;
  const amount = Number(document.getElementById('budgetAmount').value);
  
  if (category && amount > 0) {
    budgets[category] = amount;
    saveData();
    updateUI();
    document.getElementById('budgetCategory').value = '';
    document.getElementById('budgetAmount').value = '';
  }
});

// Savings Goals
document.getElementById('setGoalBtn').addEventListener('click', () => {
  const name = document.getElementById('goalName').value;
  const amount = Number(document.getElementById('goalAmount').value);
  
  if (name && amount > 0) {
    savingsGoals.push({
      name,
      targetAmount: amount,
      currentAmount: 0,
      created: new Date().toISOString()
    });
    saveData();
    updateUI();
    document.getElementById('goalName').value = '';
    document.getElementById('goalAmount').value = '';
  }
});

// Month Navigation
prevMonthBtn.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  updateUI();
});

nextMonthBtn.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  updateUI();
});

// Filtering
searchInput.addEventListener('input', updateUI);
categoryFilter.addEventListener('change', updateUI);
typeFilter.addEventListener('change', updateUI);

clearFiltersBtn.addEventListener('click', () => {
  searchInput.value = '';
  categoryFilter.value = '';
  typeFilter.value = '';
  updateUI();
});

// Dark Mode
darkModeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
  updateFooterDarkModeLink();
});

function updateFooterDarkModeLink() {
  const footerLink = document.getElementById('footerDarkMode');
  if (footerLink) {
    const isDarkMode = document.body.classList.contains('dark-mode');
    footerLink.textContent = `Dark Mode: ${isDarkMode ? 'ON' : 'OFF'}`;
  }
}

// Clear all data
function clearAllData() {
  if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
    transactions = [];
    budgets = {};
    savingsGoals = [];
    recurringTransactions = [];
    saveData();
    updateUI();
    alert('All data has been cleared.');
  }
}

// Export CSV
exportCSVBtn.addEventListener('click', () => {
  const monthTransactions = getThisMonthTransactions();
  let csv = 'date,amount,category,type,note\n';
  monthTransactions.forEach(t => {
    csv += `${t.date},${t.amount},"${t.category}",${t.type},"${t.note}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${getCurrentMonthKey()}.csv`;
  a.click();
});

// Export PDF
exportPDFBtn.addEventListener('click', () => {
  const monthKey = getCurrentMonthKey();
  const { income, expense, savingsRate } = calculateTotals();
  const element = document.createElement('div');
  element.innerHTML = `
    <h2>Finance Report - ${monthKey}</h2>
    <p><strong>Income:</strong> R ${income.toFixed(2)}</p>
    <p><strong>Expenses:</strong> R ${expense.toFixed(2)}</p>
    <p><strong>Balance:</strong> R ${(income - expense).toFixed(2)}</p>
    <p><strong>Savings Rate:</strong> ${savingsRate}%</p>
  `;
  
  html2pdf().set({ margin: 10, filename: `report-${monthKey}.pdf` }).save(element);
});

// Modal close
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', e => {
    e.target.closest('.modal').classList.remove('show');
  });
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });
});

// ─── INIT ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('date').value = new Date().toISOString().slice(0,10);
  
  // Load dark mode preference
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
  
  // Update footer dark mode link
  updateFooterDarkModeLink();
  
  // Apply recurring transactions for this month if not already applied
  const monthKey = getCurrentMonthKey();
  const monthTransactions = getThisMonthTransactions();
  
  recurringTransactions.forEach(recurring => {
    if (!monthTransactions.some(t => t.date === recurring.date && t.amount === recurring.amount && t.category === recurring.category)) {
      transactions.push({
        ...recurring,
        date: new Date().toISOString().slice(0,10)
      });
    }
  });
  
  saveData();
  updateUI();
  
  // Prevent zoom on input focus for iOS
  document.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
      e.target.style.fontSize = '16px';
    }
  }, false);
});
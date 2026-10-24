/**
 * Paisa Plan — Smart Personal Expense Tracker
 * Core Application Logic & Data Controller (Classy & Animated Edition)
 */

'use strict';

(function () {
  // ==========================================================================
  // 1. CONSTANTS & CONFIGURATION
  // ==========================================================================
  const STORAGE_KEY_EXPENSES = 'paisa_plan_expenses_v1';
  const STORAGE_KEY_BUDGET = 'paisa_plan_monthly_budget_v1';
  const STORAGE_KEY_GOALS = 'paisa_plan_savings_goals_v1';
  const STORAGE_KEY_BILLS = 'paisa_plan_recurring_bills_v1';
  const STORAGE_KEY_THEME = 'paisa_plan_theme_v1';
  const STORAGE_KEY_CURRENCY = 'paisa_plan_currency_v1';
  const STORAGE_KEY_SOUND = 'paisa_plan_sound_v1';

  const DEFAULT_MONTHLY_BUDGET = 25000;

  const CURRENCY_CONFIG = {
    INR: { code: 'INR', symbol: '₹', locale: 'en-IN' },
    USD: { code: 'USD', symbol: '$', locale: 'en-US' },
    EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
    GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
    AED: { code: 'AED', symbol: 'د.إ', locale: 'ar-AE' },
    CAD: { code: 'CAD', symbol: 'C$', locale: 'en-CA' }
  };

  const CATEGORY_CONFIG = {
    Food: { icon: '🍔', color: '#f59e0b', label: 'Food & Dining' },
    Transport: { icon: '🚗', color: '#3b82f6', label: 'Transport & Travel' },
    Education: { icon: '📚', color: '#8b5cf6', label: 'Education & Books' },
    Shopping: { icon: '🛍️', color: '#ec4899', label: 'Shopping' },
    Subscriptions: { icon: '🔄', color: '#06b6d4', label: 'Subscriptions & Bills' },
    Other: { icon: '🏷️', color: '#94a3b8', label: 'Other Expenses' }
  };

  const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'Net Banking'];

  // ==========================================================================
  // 2. SYNTHESIZED WEB AUDIO FX ENGINE (ZERO EXTERNAL ASSETS)
  // ==========================================================================
  const soundFx = {
    ctx: null,
    enabled: true,

    init() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && !this.ctx) {
          this.ctx = new AudioCtx();
        }
      } catch (e) {
        this.enabled = false;
      }
    },

    playTone(freq, type, duration, gainVal = 0.08) {
      if (!this.enabled) return;
      try {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // Audio suspended or blocked
      }
    },

    playClick() {
      this.playTone(850, 'sine', 0.05, 0.04);
    },

    playSuccess() {
      if (!this.enabled) return;
      this.playTone(523.25, 'sine', 0.12, 0.06); // C5
      setTimeout(() => this.playTone(659.25, 'sine', 0.18, 0.07), 80); // E5
    },

    playCelebration() {
      if (!this.enabled) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.28, 0.08), idx * 90);
      });
    },

    playWarning() {
      if (!this.enabled) return;
      this.playTone(320, 'sawtooth', 0.16, 0.04);
    }
  };

  // ==========================================================================
  // 3. STATE OBJECT
  // ==========================================================================
  const state = {
    expenses: [],
    monthlyBudget: DEFAULT_MONTHLY_BUDGET,
    savingsGoals: [],
    recurringBills: [],
    currency: 'INR',
    theme: 'dark',
    soundEnabled: true,
    activeView: 'dashboard',
    selectedAnalyticsMonth: getCurrentYearMonth(),
    dateRangePreset: 'ALL',
    alertDismissed: false,
    filters: {
      search: '',
      category: 'ALL',
      payment: 'ALL',
      month: 'ALL',
      sort: 'date-desc'
    },
    charts: {
      category: null,
      trend: null,
      analyticsCategory: null,
      paymentMethod: null
    },
    pendingConfirmAction: null,
    pendingFundGoalId: null
  };

  // ==========================================================================
  // 4. UTILITIES, FORMATTERS & NUMBER COUNTER ROLL-UP
  // ==========================================================================
  function getCurrencyConfig() {
    return CURRENCY_CONFIG[state.currency] || CURRENCY_CONFIG.INR;
  }

  function formatRupee(amount, includeDecimals = false) {
    const val = Number(amount) || 0;
    const conf = getCurrencyConfig();
    try {
      return new Intl.NumberFormat(conf.locale, {
        style: 'currency',
        currency: conf.code,
        minimumFractionDigits: includeDecimals ? 2 : 0,
        maximumFractionDigits: includeDecimals ? 2 : 0
      }).format(val);
    } catch (e) {
      return `${conf.symbol}${val.toLocaleString('en-US', {
        minimumFractionDigits: includeDecimals ? 2 : 0,
        maximumFractionDigits: includeDecimals ? 2 : 0
      })}`;
    }
  }

  // Smooth number counter roll-up animation
  function animateNumberCounter(element, targetVal, isCurrency = true, duration = 650) {
    if (!element) return;
    const end = Math.round(Number(targetVal) || 0);
    const prev = element.dataset.prevVal !== undefined ? Number(element.dataset.prevVal) : 0;
    element.dataset.prevVal = String(end);

    if (prev === end) {
      element.textContent = isCurrency ? formatRupee(end) : String(end);
      return;
    }

    const startTime = performance.now();
    const diff = end - prev;

    function frame(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(prev + diff * ease);

      element.textContent = isCurrency ? formatRupee(current) : String(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        element.textContent = isCurrency ? formatRupee(end) : String(end);
      }
    }

    requestAnimationFrame(frame);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateReadable(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(getCurrencyConfig().locale, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getCurrentYearMonth() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ==========================================================================
  // 5. STORAGE & INITIALIZATION
  // ==========================================================================
  function loadData() {
    // 1. Theme
    try {
      const storedTheme = localStorage.getItem(STORAGE_KEY_THEME);
      if (storedTheme === 'light' || storedTheme === 'dark') {
        state.theme = storedTheme;
      }
    } catch (e) {
      state.theme = 'dark';
    }
    applyTheme(state.theme);

    // 2. Sound
    try {
      const storedSound = localStorage.getItem(STORAGE_KEY_SOUND);
      if (storedSound !== null) {
        state.soundEnabled = storedSound === 'true';
      }
    } catch (e) {
      state.soundEnabled = true;
    }
    soundFx.enabled = state.soundEnabled;
    updateSoundUI();

    // 3. Currency
    try {
      const storedCurr = localStorage.getItem(STORAGE_KEY_CURRENCY);
      if (storedCurr && CURRENCY_CONFIG[storedCurr]) {
        state.currency = storedCurr;
      }
    } catch (e) {
      state.currency = 'INR';
    }

    // 4. Budget
    try {
      const storedBudget = localStorage.getItem(STORAGE_KEY_BUDGET);
      if (storedBudget !== null) {
        const parsed = parseFloat(storedBudget);
        if (!isNaN(parsed) && parsed > 0) {
          state.monthlyBudget = parsed;
        }
      }
    } catch (e) {
      state.monthlyBudget = DEFAULT_MONTHLY_BUDGET;
    }

    // 5. Expenses
    try {
      const storedExpenses = localStorage.getItem(STORAGE_KEY_EXPENSES);
      if (storedExpenses) {
        const parsed = JSON.parse(storedExpenses);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.expenses = parsed.map(item => ({
            id: String(item.id || Date.now() + Math.random()),
            amount: Math.abs(parseFloat(item.amount) || 0),
            category: item.category in CATEGORY_CONFIG ? item.category : 'Other',
            date: item.date || getTodayDateString(),
            description: String(item.description || '').trim(),
            paymentMethod: PAYMENT_METHODS.includes(item.paymentMethod) ? item.paymentMethod : 'UPI',
            createdAt: item.createdAt || Date.now()
          }));
        } else {
          loadDefaultSampleData();
        }
      } else {
        loadDefaultSampleData();
      }
    } catch (e) {
      state.expenses = [];
      loadDefaultSampleData();
    }

    // 6. Savings Goals
    try {
      const storedGoals = localStorage.getItem(STORAGE_KEY_GOALS);
      if (storedGoals) {
        const parsed = JSON.parse(storedGoals);
        if (Array.isArray(parsed)) state.savingsGoals = parsed;
      }
    } catch (e) {
      state.savingsGoals = [];
    }

    // 7. Recurring Bills
    try {
      const storedBills = localStorage.getItem(STORAGE_KEY_BILLS);
      if (storedBills) {
        const parsed = JSON.parse(storedBills);
        if (Array.isArray(parsed)) state.recurringBills = parsed;
      }
    } catch (e) {
      state.recurringBills = [];
    }

    if (state.savingsGoals.length === 0 && state.recurringBills.length === 0) {
      populateSampleGoalsAndBills();
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(state.expenses));
      localStorage.setItem(STORAGE_KEY_BUDGET, String(state.monthlyBudget));
      localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(state.savingsGoals));
      localStorage.setItem(STORAGE_KEY_BILLS, JSON.stringify(state.recurringBills));
      localStorage.setItem(STORAGE_KEY_THEME, state.theme);
      localStorage.setItem(STORAGE_KEY_CURRENCY, state.currency);
      localStorage.setItem(STORAGE_KEY_SOUND, String(state.soundEnabled));
    } catch (e) {
      showToast('Warning: LocalStorage limit reached or blocked', 'error');
    }
  }

  function loadDefaultSampleData() {
    const today = new Date();
    const makeDate = (offsetDays) => {
      const d = new Date(today);
      d.setDate(today.getDate() - offsetDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth();
    const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const formatPrevD = (d) => `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const samples = [
      { id: 'tx-1', amount: 350, category: 'Food', date: makeDate(0), description: 'Campus Cafeteria Lunch', paymentMethod: 'UPI' },
      { id: 'tx-2', amount: 150, category: 'Transport', date: makeDate(0), description: 'Metro Pass Auto-Topup', paymentMethod: 'UPI' },
      { id: 'tx-3', amount: 1200, category: 'Shopping', date: makeDate(1), description: 'Wireless Mouse & Mousepad', paymentMethod: 'Card' },
      { id: 'tx-4', amount: 2400, category: 'Food', date: makeDate(3), description: 'Weekly Groceries at Supermarket', paymentMethod: 'Card' },
      { id: 'tx-5', amount: 1899, category: 'Education', date: makeDate(5), description: 'Data Structures & Algorithms Book', paymentMethod: 'Card' },
      { id: 'tx-6', amount: 699, category: 'Subscriptions', date: makeDate(8), description: 'Netflix & Music Subscription', paymentMethod: 'Net Banking' },
      { id: 'tx-7', amount: 850, category: 'Transport', date: makeDate(12), description: 'Cab Ride to Campus Tech Symposium', paymentMethod: 'UPI' },
      { id: 'tx-8', amount: 500, category: 'Other', date: makeDate(15), description: 'Project Report Binding & Stationery', paymentMethod: 'Cash' },
      { id: 'tx-9', amount: 1450, category: 'Food', date: makeDate(18), description: 'Team Dinner Celebration', paymentMethod: 'UPI' },
      { id: 'tx-10', amount: 480, category: 'Transport', date: makeDate(20), description: 'Bus Pass Monthly Renewal', paymentMethod: 'Cash' },
      { id: 'tx-11', amount: 2800, category: 'Food', date: formatPrevD(24), description: 'Weekend Dining & Treats', paymentMethod: 'Card' },
      { id: 'tx-12', amount: 1500, category: 'Education', date: formatPrevD(18), description: 'Cloud Certification Exam Fee', paymentMethod: 'Net Banking' },
      { id: 'tx-13', amount: 3500, category: 'Shopping', date: formatPrevD(12), description: 'Festive Shopping', paymentMethod: 'UPI' },
      { id: 'tx-14', amount: 1100, category: 'Transport', date: formatPrevD(5), description: 'Local Train Monthly Pass', paymentMethod: 'UPI' }
    ];

    state.expenses = samples.map((s, idx) => ({
      ...s,
      createdAt: Date.now() - idx * 86400000
    }));

    state.monthlyBudget = DEFAULT_MONTHLY_BUDGET;
    populateSampleGoalsAndBills();
    saveData();
  }

  function populateSampleGoalsAndBills() {
    state.savingsGoals = [
      { id: 'goal-1', name: '🛡️ Emergency Fund', targetAmount: 50000, currentAmount: 32000, icon: '🛡️', targetDate: '2026-12-31' },
      { id: 'goal-2', name: '💻 High-End Laptop Upgrade', targetAmount: 85000, currentAmount: 52000, icon: '💻', targetDate: '2027-03-31' },
      { id: 'goal-3', name: '✈️ Goa College Trip', targetAmount: 20000, currentAmount: 20000, icon: '✈️', targetDate: '2026-11-15' }
    ];

    state.recurringBills = [
      { id: 'bill-1', name: 'Netflix 4K Ultra', amount: 649, category: 'Subscriptions', billingDay: 15, paymentMethod: 'UPI', paidMonths: [getCurrentYearMonth()] },
      { id: 'bill-2', name: 'Airtel Fiber Broadband', amount: 999, category: 'Subscriptions', billingDay: 5, paymentMethod: 'Net Banking', paidMonths: [getCurrentYearMonth()] },
      { id: 'bill-3', name: 'Campus Gym Membership', amount: 1500, category: 'Other', billingDay: 1, paymentMethod: 'UPI', paidMonths: [] }
    ];
  }

  // ==========================================================================
  // 6. THEME, CURRENCY & AUDIO CONTROLLERS
  // ==========================================================================
  function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);

    const isLight = themeName === 'light';
    document.querySelectorAll('.sun-icon').forEach(el => el.classList.toggle('hidden', !isLight));
    document.querySelectorAll('.moon-icon').forEach(el => el.classList.toggle('hidden', isLight));

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = themeName;

    setTimeout(() => {
      initChartDefaults();
      renderCategoryChart();
      renderTrendChart();
      renderAnalyticsCharts();
    }, 50);
  }

  function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    saveData();
    soundFx.playTone(600, 'sine', 0.08, 0.05);
    showToast(`Switched to ${nextTheme === 'light' ? 'Executive Light' : 'Dark Navy'} mode!`, 'info');
  }

  function setCurrency(currencyCode) {
    if (!CURRENCY_CONFIG[currencyCode]) return;
    state.currency = currencyCode;
    const conf = getCurrencyConfig();

    document.querySelectorAll('.symbol-prefix').forEach(el => {
      el.textContent = conf.symbol;
    });

    const prefixEl = document.getElementById('settingsCurrencyPrefix');
    if (prefixEl) prefixEl.textContent = conf.symbol;

    saveData();
    renderAll();
    soundFx.playClick();
    showToast(`Currency set to ${conf.code} (${conf.symbol})`, 'success');
  }

  function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    soundFx.enabled = state.soundEnabled;
    updateSoundUI();
    saveData();
    if (state.soundEnabled) soundFx.playSuccess();
    showToast(state.soundEnabled ? 'Sound FX activated 🔊' : 'Sound FX muted 🔇', 'info');
  }

  function updateSoundUI() {
    const soundOnIcons = document.querySelectorAll('.sound-on');
    const soundOffIcons = document.querySelectorAll('.sound-off');
    soundOnIcons.forEach(el => el.classList.toggle('hidden', !state.soundEnabled));
    soundOffIcons.forEach(el => el.classList.toggle('hidden', state.soundEnabled));

    const soundSelect = document.getElementById('soundSettingSelect');
    if (soundSelect) soundSelect.value = state.soundEnabled ? 'enabled' : 'disabled';
  }

  // ==========================================================================
  // 7. COMPUTED FINANCIAL METRICS & PAISA HEALTH SCORE
  // ==========================================================================
  function getExpensesForMonth(yearMonth) {
    return state.expenses.filter(tx => tx.date.startsWith(yearMonth));
  }

  function calculateMonthMetrics(yearMonth = getCurrentYearMonth()) {
    const monthExpenses = getExpensesForMonth(yearMonth);
    const totalSpent = monthExpenses.reduce((sum, tx) => sum + tx.amount, 0);
    const budget = state.monthlyBudget;
    const remaining = budget - totalSpent;
    const utilizationPct = budget > 0 ? (totalSpent / budget) * 100 : 0;

    const todayStr = getTodayDateString();
    const todayExpenses = state.expenses.filter(tx => tx.date === todayStr);
    const todaySpent = todayExpenses.reduce((sum, tx) => sum + tx.amount, 0);

    const categoryTotals = {};
    Object.keys(CATEGORY_CONFIG).forEach(cat => { categoryTotals[cat] = 0; });
    monthExpenses.forEach(tx => {
      if (categoryTotals[tx.category] !== undefined) {
        categoryTotals[tx.category] += tx.amount;
      } else {
        categoryTotals['Other'] = (categoryTotals['Other'] || 0) + tx.amount;
      }
    });

    let topCategory = null;
    let topCategoryAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > topCategoryAmount) {
        topCategoryAmount = amt;
        topCategory = cat;
      }
    });

    const now = new Date();
    const [yStr, mStr] = yearMonth.split('-');
    const targetYear = parseInt(yStr, 10);
    const targetMonth = parseInt(mStr, 10);
    const totalDaysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    const isCurrentMonth = (targetYear === now.getFullYear() && targetMonth === (now.getMonth() + 1));
    const isPastMonth = (targetYear < now.getFullYear()) || (targetYear === now.getFullYear() && targetMonth < (now.getMonth() + 1));

    let daysRemaining = 0;
    let dailySafeLimit = 0;
    let dailyAverageSpent = 0;

    if (isCurrentMonth) {
      daysRemaining = Math.max(1, totalDaysInMonth - now.getDate() + 1);
      dailySafeLimit = remaining > 0 ? (remaining / daysRemaining) : 0;
      dailyAverageSpent = now.getDate() > 0 ? (totalSpent / now.getDate()) : 0;
    } else if (isPastMonth) {
      daysRemaining = 0;
      dailySafeLimit = 0;
      dailyAverageSpent = totalSpent / totalDaysInMonth;
    } else {
      daysRemaining = totalDaysInMonth;
      dailySafeLimit = budget / totalDaysInMonth;
      dailyAverageSpent = 0;
    }

    // Compute Paisa Financial Health Score (0 - 100)
    let score = 40; // baseline
    if (utilizationPct <= 60) score += 35;
    else if (utilizationPct <= 80) score += 25;
    else if (utilizationPct <= 100) score += 10;
    else score -= 15;

    if (remaining > 0) score += 15;
    if (state.savingsGoals.length > 0) score += 10;
    score = Math.max(10, Math.min(100, Math.round(score)));

    let grade = '✦ EXCELLENT PACING';
    let gradeDesc = 'Your spending velocity is well calibrated to your monthly budget limit.';
    if (score < 50) {
      grade = '🚨 DEFICIT ALERT';
      gradeDesc = 'Spending has exceeded or critically strained your monthly limit. Trim discretionary expenses.';
    } else if (score < 75) {
      grade = '⚠️ MODERATE PACING';
      gradeDesc = 'Approaching 80% utilization. Monitor discretionary weekend shopping and dining out.';
    } else if (score >= 90) {
      grade = '✦ STELLAR MASTERY';
      gradeDesc = 'Exceptional financial discipline! Healthy budget runway and steady savings habits.';
    }

    return {
      monthExpenses,
      totalSpent,
      budget,
      remaining,
      utilizationPct,
      todaySpent,
      todayTxCount: todayExpenses.length,
      categoryTotals,
      topCategory,
      topCategoryAmount,
      daysRemaining,
      dailySafeLimit,
      dailyAverageSpent,
      isCurrentMonth,
      isPastMonth,
      score,
      grade,
      gradeDesc
    };
  }

  // ==========================================================================
  // 8. CHART.JS & RESILIENT FALLBACK VISUALIZATIONS
  // ==========================================================================
  function hasChartJs() {
    return typeof Chart !== 'undefined';
  }

  function initChartDefaults() {
    if (!hasChartJs()) return;
    const isLight = state.theme === 'light';
    Chart.defaults.color = isLight ? '#475569' : '#94a3b8';
    Chart.defaults.font.family = "'Outfit', 'Plus Jakarta Sans', sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = isLight ? '#ffffff' : '#0f172a';
    Chart.defaults.plugins.tooltip.titleColor = isLight ? '#0f172a' : '#f8fafc';
    Chart.defaults.plugins.tooltip.bodyColor = '#10b981';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(16, 185, 129, 0.4)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.boxPadding = 6;
  }

  function renderCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    const emptyState = document.getElementById('categoryChartEmpty');
    const topCategoryTag = document.getElementById('topCategoryTag');
    if (!canvas) return;

    const metrics = calculateMonthMetrics();
    const labels = [];
    const data = [];
    const colors = [];

    Object.entries(metrics.categoryTotals).forEach(([cat, amt]) => {
      if (amt > 0) {
        labels.push(cat);
        data.push(amt);
        colors.push(CATEGORY_CONFIG[cat].color);
      }
    });

    if (topCategoryTag) {
      if (metrics.topCategory && metrics.topCategoryAmount > 0) {
        topCategoryTag.textContent = `Top: ${metrics.topCategory} (${formatRupee(metrics.topCategoryAmount)})`;
        topCategoryTag.classList.remove('hidden');
      } else {
        topCategoryTag.classList.add('hidden');
      }
    }

    if (data.length === 0) {
      if (state.charts.category) {
        state.charts.category.destroy();
        state.charts.category = null;
      }
      canvas.style.display = 'none';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    canvas.style.display = 'block';
    if (emptyState) emptyState.classList.add('hidden');

    if (!hasChartJs()) {
      renderOfflineCategoryFallback(canvas.parentElement, labels, data, colors);
      return;
    }

    if (state.charts.category) {
      state.charts.category.destroy();
    }

    const ctx = canvas.getContext('2d');
    state.charts.category = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: state.theme === 'light' ? '#ffffff' : '#121927',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 900
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 14,
              font: { size: 12, weight: 600 }
            }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const val = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${context.label}: ${formatRupee(val)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  function renderTrendChart() {
    const canvas = document.getElementById('trendChart');
    const emptyState = document.getElementById('trendChartEmpty');
    if (!canvas) return;

    const monthLabels = [];
    const monthKeys = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      monthKeys.push(`${y}-${m}`);
      monthLabels.push(d.toLocaleDateString(getCurrencyConfig().locale, { month: 'short' }));
    }

    const spendingData = monthKeys.map(key => {
      const exp = getExpensesForMonth(key);
      return exp.reduce((sum, item) => sum + item.amount, 0);
    });

    const hasAnyData = spendingData.some(val => val > 0);
    if (!hasAnyData) {
      if (state.charts.trend) {
        state.charts.trend.destroy();
        state.charts.trend = null;
      }
      canvas.style.display = 'none';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    canvas.style.display = 'block';
    if (emptyState) emptyState.classList.add('hidden');

    if (!hasChartJs()) {
      renderOfflineTrendFallback(canvas.parentElement, monthLabels, spendingData);
      return;
    }

    if (state.charts.trend) {
      state.charts.trend.destroy();
    }

    const isLight = state.theme === 'light';
    const ctx = canvas.getContext('2d');
    state.charts.trend = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Total Spent',
          data: spendingData,
          backgroundColor: '#10b981',
          hoverBackgroundColor: '#34d399',
          borderRadius: 8,
          maxBarThickness: 38
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { weight: 600 } }
          },
          y: {
            grid: { color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' },
            ticks: {
              callback: function (val) {
                const sym = getCurrencyConfig().symbol;
                return sym + (val >= 1000 ? (val / 1000) + 'k' : val);
              }
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ` Spent: ${formatRupee(ctx.parsed.y)}`;
              }
            }
          }
        }
      }
    });
  }

  function renderAnalyticsCharts() {
    const selectedMonth = state.selectedAnalyticsMonth || getCurrentYearMonth();
    const metrics = calculateMonthMetrics(selectedMonth);

    const catCanvas = document.getElementById('analyticsCategoryChart');
    if (catCanvas && hasChartJs()) {
      const labels = [];
      const data = [];
      const colors = [];

      Object.entries(metrics.categoryTotals).forEach(([cat, amt]) => {
        if (amt > 0) {
          labels.push(cat);
          data.push(amt);
          colors.push(CATEGORY_CONFIG[cat].color);
        }
      });

      if (state.charts.analyticsCategory) {
        state.charts.analyticsCategory.destroy();
      }

      if (data.length > 0) {
        const ctx = catCanvas.getContext('2d');
        state.charts.analyticsCategory = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: colors,
              borderColor: state.theme === 'light' ? '#ffffff' : '#121927',
              borderWidth: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%'
          }
        });
      }
    }

    const payCanvas = document.getElementById('paymentMethodChart');
    if (payCanvas && hasChartJs()) {
      const payTotals = { UPI: 0, Card: 0, Cash: 0, 'Net Banking': 0 };
      metrics.monthExpenses.forEach(tx => {
        if (payTotals[tx.paymentMethod] !== undefined) {
          payTotals[tx.paymentMethod] += tx.amount;
        } else {
          payTotals['UPI'] += tx.amount;
        }
      });

      const pLabels = Object.keys(payTotals);
      const pData = pLabels.map(k => payTotals[k]);
      const pColors = ['#10b981', '#3b82f6', '#f59e0b', '#06b6d4'];

      if (state.charts.paymentMethod) {
        state.charts.paymentMethod.destroy();
      }

      const isLight = state.theme === 'light';
      const ctx = payCanvas.getContext('2d');
      state.charts.paymentMethod = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: pLabels,
          datasets: [{
            label: 'Amount',
            data: pData,
            backgroundColor: pColors,
            borderRadius: 6,
            maxBarThickness: 34
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' },
              ticks: {
                callback: function (val) {
                  return getCurrencyConfig().symbol + (val >= 1000 ? (val / 1000) + 'k' : val);
                }
              }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  function renderOfflineCategoryFallback(container, labels, data, colors) {
    let fallback = container.querySelector('.offline-chart-fallback');
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.className = 'offline-chart-fallback';
      container.appendChild(fallback);
    }
    const total = data.reduce((a, b) => a + b, 0);
    fallback.innerHTML = `
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
        <p style="font-size: 0.75rem; color: var(--text-dim); text-align: center;">(Displaying in offline visual mode)</p>
        ${labels.map((lbl, i) => {
          const pct = total > 0 ? Math.round((data[i] / total) * 100) : 0;
          return `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 2px;">
                <span>${lbl}</span>
                <strong>${formatRupee(data[i])} (${pct}%)</strong>
              </div>
              <div style="height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: ${colors[i]};"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderOfflineTrendFallback(container, labels, data) {
    let fallback = container.querySelector('.offline-chart-fallback');
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.className = 'offline-chart-fallback';
      container.appendChild(fallback);
    }
    const maxVal = Math.max(...data, 1);
    fallback.innerHTML = `
      <div style="padding: 16px; display: flex; align-items: flex-end; justify-content: space-around; height: 180px;">
        ${labels.map((lbl, i) => {
          const h = Math.round((data[i] / maxVal) * 100);
          return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
              <span style="font-size: 0.7rem; color: var(--mint-light);">${formatRupee(data[i])}</span>
              <div style="width: 24px; height: ${Math.max(4, h)}px; background: var(--mint-primary); border-radius: 4px;"></div>
              <span style="font-size: 0.75rem; font-weight: 600;">${lbl}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ==========================================================================
  // 9. RULE-BASED SMART SPENDING INSIGHTS
  // ==========================================================================
  function generateSmartInsights() {
    const selectedMonth = state.selectedAnalyticsMonth || getCurrentYearMonth();
    const metrics = calculateMonthMetrics(selectedMonth);
    const { totalSpent, budget, remaining, utilizationPct, topCategory, topCategoryAmount, daysRemaining, dailySafeLimit, monthExpenses, isCurrentMonth } = metrics;

    const tipEl = document.getElementById('smartTipText');

    if (monthExpenses.length === 0) {
      if (tipEl) tipEl.textContent = 'No expenses recorded for this month. Add daily expenses to unlock smart budgeting suggestions.';
      renderDeepInsights([]);
      return;
    }

    const insights = [];

    if (utilizationPct >= 100) {
      const overBy = totalSpent - budget;
      insights.push({
        title: 'Monthly Budget Exceeded',
        icon: '🚨',
        body: `You have crossed your set budget of ${formatRupee(budget)} by ${formatRupee(overBy)}. Limit non-essential spending for the remainder of this cycle.`
      });
      if (tipEl && isCurrentMonth) {
        tipEl.textContent = `Warning: You have exceeded your budget by ${formatRupee(overBy)}. Prioritize necessities only.`;
      }
    } else if (utilizationPct >= 80) {
      insights.push({
        title: 'High Budget Utilization',
        icon: '⚠️',
        body: `You have consumed ${Math.round(utilizationPct)}% of your monthly budget. You have ${formatRupee(remaining)} remaining for the next ${daysRemaining} days.`
      });
      if (tipEl && isCurrentMonth) {
        tipEl.textContent = `Pacing Notice: ${Math.round(utilizationPct)}% of budget utilized. Safe daily spend is ${formatRupee(dailySafeLimit)}/day.`;
      }
    } else {
      insights.push({
        title: 'Budget On Track',
        icon: '✅',
        body: isCurrentMonth
          ? `Great financial pacing! You have utilized ${Math.round(utilizationPct)}% of your allowance with ${formatRupee(remaining)} remaining for ${daysRemaining} days (${formatRupee(dailySafeLimit)}/day).`
          : `This month finished comfortably under budget with ${formatRupee(remaining)} in surplus savings.`
      });
      if (tipEl && isCurrentMonth) {
        tipEl.textContent = `Healthy Pacing: You have ${formatRupee(remaining)} remaining. Recommended daily limit: ${formatRupee(dailySafeLimit)}.`;
      }
    }

    if (topCategory && topCategoryAmount > 0) {
      const catPct = totalSpent > 0 ? Math.round((topCategoryAmount / totalSpent) * 100) : 0;
      insights.push({
        title: `Primary Spend Area: ${topCategory}`,
        icon: CATEGORY_CONFIG[topCategory].icon,
        body: `${topCategory} accounts for ${catPct}% of your total expenditures (${formatRupee(topCategoryAmount)} across ${monthExpenses.filter(e => e.category === topCategory).length} transactions).`
      });
    }

    if (monthExpenses.length > 0) {
      const sortedByAmt = [...monthExpenses].sort((a, b) => b.amount - a.amount);
      const topTx = sortedByAmt[0];
      insights.push({
        title: 'Largest Single Purchase',
        icon: '💳',
        body: `Your highest single expenditure was ${formatRupee(topTx.amount)} for "${escapeHtml(topTx.description)}" on ${formatDateReadable(topTx.date)}.`
      });
    }

    const payCounts = {};
    monthExpenses.forEach(tx => {
      payCounts[tx.paymentMethod] = (payCounts[tx.paymentMethod] || 0) + 1;
    });
    let topPay = 'UPI';
    let maxPayCount = 0;
    Object.entries(payCounts).forEach(([pm, cnt]) => {
      if (cnt > maxPayCount) {
        maxPayCount = cnt;
        topPay = pm;
      }
    });
    const payPct = Math.round((maxPayCount / monthExpenses.length) * 100);
    insights.push({
      title: `Preferred Payment: ${topPay}`,
      icon: '📱',
      body: `You used ${topPay} for ${payPct}% of transactions (${maxPayCount} of ${monthExpenses.length} payments).`
    });

    renderDeepInsights(insights);
  }

  function renderDeepInsights(insights) {
    const container = document.getElementById('deepInsightsList');
    if (!container) return;

    if (insights.length === 0) {
      container.innerHTML = `
        <div class="insight-item-box" style="grid-column: 1 / -1; text-align: center; padding: 24px;">
          <p style="color: var(--text-dim);">No transactions available for this month to generate deep insights.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = insights.map(item => `
      <div class="insight-item-box">
        <div class="insight-item-header">
          <span class="insight-icon-pill">${item.icon}</span>
          <h4 class="insight-item-title">${escapeHtml(item.title)}</h4>
        </div>
        <p class="insight-item-body">${escapeHtml(item.body)}</p>
      </div>
    `).join('');
  }

  // ==========================================================================
  // 10. UI RENDER CONTROLLER (WITH ROLL-UP COUNTERS & SHOWCASE)
  // ==========================================================================
  function renderAll() {
    updateDateDisplay();
    renderDashboardMetrics();
    renderLuxuryShowcase();
    renderBudgetAlert();
    renderRecentTransactions();
    renderCategoryChart();
    renderTrendChart();
    renderFilteredTransactions();
    renderBudgetPlanner();
    renderAnalyticsCharts();
    generateSmartInsights();
    renderSavingsGoals();
    renderRecurringBills();
    renderSettingsView();
  }

  function updateDateDisplay() {
    const curDateEl = document.getElementById('currentDateDisplay');
    if (curDateEl) {
      const now = new Date();
      curDateEl.textContent = now.toLocaleDateString(getCurrencyConfig().locale, { month: 'short', year: 'numeric' });
    }
  }

  // Animate Dashboard Metric Cards
  function renderDashboardMetrics() {
    const metrics = calculateMonthMetrics();
    const { totalSpent, budget, remaining, utilizationPct, todaySpent, todayTxCount, monthExpenses } = metrics;

    animateNumberCounter(document.getElementById('monthSpentTotal'), totalSpent, true);
    animateNumberCounter(document.getElementById('todaySpentTotal'), todaySpent, true);
    animateNumberCounter(document.getElementById('dashboardMonthlyBudget'), budget, true);
    animateNumberCounter(document.getElementById('remainingBudgetTotal'), Math.abs(remaining), true);

    const monthTxCountEl = document.getElementById('monthTxCount');
    if (monthTxCountEl) monthTxCountEl.textContent = `${monthExpenses.length} expense${monthExpenses.length === 1 ? '' : 's'} recorded`;

    const todayTxCountEl = document.getElementById('todayTxCount');
    if (todayTxCountEl) todayTxCountEl.textContent = `${todayTxCount} transaction${todayTxCount === 1 ? '' : 's'} today`;

    const remainingBudgetTotalEl = document.getElementById('remainingBudgetTotal');
    if (remainingBudgetTotalEl) {
      remainingBudgetTotalEl.style.color = remaining >= 0 ? 'var(--text-main)' : 'var(--color-danger)';
    }

    const budgetUsagePillEl = document.getElementById('budgetUsagePill');
    const remainingIconBox = document.getElementById('remainingIconBox');
    if (budgetUsagePillEl) {
      const roundedPct = Math.round(utilizationPct);
      budgetUsagePillEl.textContent = `${roundedPct}% used`;
      budgetUsagePillEl.className = 'badge';

      if (remainingIconBox) remainingIconBox.className = 'metric-icon-box';

      if (roundedPct >= 100) {
        budgetUsagePillEl.classList.add('badge-danger');
        if (remainingIconBox) remainingIconBox.classList.add('danger');
      } else if (roundedPct >= 80) {
        budgetUsagePillEl.classList.add('badge-warning');
        if (remainingIconBox) remainingIconBox.classList.add('amber');
      } else {
        budgetUsagePillEl.classList.add('badge-safe');
        if (remainingIconBox) remainingIconBox.classList.add('mint');
      }
    }

    // Sidebar mini widget
    const sidebarSpentVal = document.getElementById('sidebarSpentVal');
    const sidebarBudgetVal = document.getElementById('sidebarBudgetVal');
    const sidebarBudgetPct = document.getElementById('sidebarBudgetPct');
    const sidebarProgressBar = document.getElementById('sidebarProgressBar');
    const navTxBadge = document.getElementById('navTxBadge');

    if (sidebarSpentVal) sidebarSpentVal.textContent = formatRupee(totalSpent);
    if (sidebarBudgetVal) sidebarBudgetVal.textContent = `/ ${formatRupee(budget)}`;
    if (navTxBadge) navTxBadge.textContent = String(state.expenses.length);

    if (sidebarBudgetPct && sidebarProgressBar) {
      const roundedPct = Math.round(utilizationPct);
      sidebarBudgetPct.textContent = `${roundedPct}%`;
      sidebarProgressBar.style.width = `${Math.min(100, roundedPct)}%`;

      sidebarBudgetPct.className = 'pct-pill';
      sidebarProgressBar.className = 'mini-progress-fill';

      if (roundedPct >= 100) {
        sidebarBudgetPct.classList.add('danger');
        sidebarProgressBar.classList.add('danger');
      } else if (roundedPct >= 80) {
        sidebarBudgetPct.classList.add('warning');
        sidebarProgressBar.classList.add('warning');
      } else {
        sidebarBudgetPct.classList.add('safe');
        sidebarProgressBar.classList.add('safe');
      }
    }
  }

  // Animate Luxury Showcase: Platinum Card & Paisa Score
  function renderLuxuryShowcase() {
    const metrics = calculateMonthMetrics();
    const { totalSpent, budget, score, grade, gradeDesc, daysRemaining, dailySafeLimit, utilizationPct } = metrics;

    // 1. Platinum Virtual Card
    const cardMonthlySpent = document.getElementById('cardMonthlySpent');
    const cardBudgetProgress = document.getElementById('cardBudgetProgress');
    const cardYearSuffix = document.getElementById('cardYearSuffix');

    animateNumberCounter(cardMonthlySpent, totalSpent, true);
    if (cardBudgetProgress) {
      cardBudgetProgress.style.width = `${Math.min(100, Math.round(utilizationPct))}%`;
    }
    if (cardYearSuffix) {
      cardYearSuffix.textContent = String(new Date().getFullYear());
    }

    // 2. Paisa Financial Health Score Meter
    const scoreValEl = document.getElementById('paisaScoreNumber');
    const scoreGradeEl = document.getElementById('paisaScoreGrade');
    const scoreDescEl = document.getElementById('paisaScoreDesc');
    const scoreRingCircle = document.getElementById('scoreRingCircle');
    const scorePacingPill = document.getElementById('scorePacingPill');
    const scoreRunwayPill = document.getElementById('scoreRunwayPill');

    animateNumberCounter(scoreValEl, score, false, 800);

    if (scoreGradeEl) {
      scoreGradeEl.textContent = grade;
      scoreGradeEl.style.color = score >= 75 ? 'var(--mint-light)' : (score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)');
      scoreGradeEl.style.borderColor = score >= 75 ? 'rgba(16,185,129,0.3)' : (score >= 50 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)');
    }

    if (scoreDescEl) scoreDescEl.textContent = gradeDesc;

    if (scorePacingPill) {
      scorePacingPill.textContent = `${formatRupee(dailySafeLimit)}/day`;
    }

    if (scoreRunwayPill) {
      scoreRunwayPill.textContent = `${daysRemaining} days remaining`;
    }

    if (scoreRingCircle) {
      const circumference = 2 * Math.PI * 50; // ~314.159
      const offset = circumference - (score / 100) * circumference;
      scoreRingCircle.style.strokeDashoffset = String(offset);
      scoreRingCircle.style.stroke = score >= 75 ? '#10b981' : (score >= 50 ? '#f59e0b' : '#ef4444');
    }
  }

  function renderBudgetAlert() {
    const banner = document.getElementById('budgetAlertBanner');
    const titleEl = document.getElementById('alertTitle');
    const msgEl = document.getElementById('alertMessage');
    const iconEl = document.getElementById('alertIcon');
    if (!banner || !titleEl || !msgEl) return;

    if (state.alertDismissed) {
      banner.classList.add('hidden');
      return;
    }

    const metrics = calculateMonthMetrics();
    const { totalSpent, budget, utilizationPct } = metrics;
    const rounded = Math.round(utilizationPct);

    if (rounded >= 100) {
      banner.className = 'alert-banner danger';
      iconEl.textContent = '🚨';
      titleEl.textContent = 'Monthly Budget Exceeded!';
      msgEl.textContent = `You have spent ${formatRupee(totalSpent)}, exceeding your monthly target of ${formatRupee(budget)} by ${formatRupee(totalSpent - budget)}.`;
      banner.classList.remove('hidden');
    } else if (rounded >= 80) {
      banner.className = 'alert-banner warning';
      iconEl.textContent = '⚠️';
      titleEl.textContent = 'Budget Limit Approaching';
      msgEl.textContent = `You have utilized ${rounded}% of your monthly limit (${formatRupee(totalSpent)} of ${formatRupee(budget)}).`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  function renderRecentTransactions() {
    const tbody = document.getElementById('recentTransactionsBody');
    const emptyState = document.getElementById('recentEmptyState');
    if (!tbody) return;

    const recent = [...state.expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt)
      .slice(0, 5);

    if (recent.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = recent.map(tx => {
      const cat = CATEGORY_CONFIG[tx.category] || CATEGORY_CONFIG['Other'];
      return `
        <tr>
          <td>
            <div class="tx-desc-cell">
              <span class="tx-cat-icon" style="background-color: ${cat.color}22; color: ${cat.color};">${cat.icon}</span>
              <span class="tx-title">${escapeHtml(tx.description)}</span>
            </div>
          </td>
          <td><span class="badge-cat ${tx.category}">${cat.icon} ${escapeHtml(tx.category)}</span></td>
          <td>${formatDateReadable(tx.date)}</td>
          <td><span class="badge-payment ${tx.paymentMethod.toLowerCase()}">${escapeHtml(tx.paymentMethod)}</span></td>
          <td class="text-right tx-amount">${formatRupee(tx.amount, true)}</td>
          <td class="text-center">
            <div class="row-actions">
              <button class="action-icon-btn edit-btn" data-action="edit" data-id="${tx.id}" title="Edit expense" aria-label="Edit expense">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="action-icon-btn delete-btn" data-action="delete" data-id="${tx.id}" title="Delete expense" aria-label="Delete expense">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function populateMonthSelectors() {
    const monthsSet = new Set();
    state.expenses.forEach(tx => {
      if (tx.date && tx.date.length >= 7) {
        monthsSet.add(tx.date.substring(0, 7));
      }
    });
    monthsSet.add(getCurrentYearMonth());
    const sortedMonths = Array.from(monthsSet).sort().reverse();

    const filterMonthSelect = document.getElementById('filterMonth');
    if (filterMonthSelect) {
      const curSelected = filterMonthSelect.value || 'ALL';
      filterMonthSelect.innerHTML = '<option value="ALL">All Time</option>' + sortedMonths.map(ym => {
        const [y, m] = ym.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const label = dateObj.toLocaleDateString(getCurrencyConfig().locale, { month: 'long', year: 'numeric' });
        return `<option value="${ym}">${label}</option>`;
      }).join('');
      filterMonthSelect.value = curSelected;
    }

    const analyticsMonthSelect = document.getElementById('analyticsMonthSelect');
    if (analyticsMonthSelect) {
      const curSelected = state.selectedAnalyticsMonth || getCurrentYearMonth();
      analyticsMonthSelect.innerHTML = sortedMonths.map(ym => {
        const [y, m] = ym.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const label = dateObj.toLocaleDateString(getCurrencyConfig().locale, { month: 'long', year: 'numeric' });
        return `<option value="${ym}">${label}</option>`;
      }).join('');
      analyticsMonthSelect.value = sortedMonths.includes(curSelected) ? curSelected : sortedMonths[0];
    }
  }

  // ==========================================================================
  // 11. TRANSACTIONS VIEW CONTROLLER
  // ==========================================================================
  function renderFilteredTransactions() {
    const tbody = document.getElementById('allTransactionsBody');
    const emptyState = document.getElementById('txEmptyState');
    const countDisplay = document.getElementById('filterCountDisplay');
    const totalSumDisplay = document.getElementById('filterTotalSum');
    if (!tbody) return;

    let filtered = [...state.expenses];

    const todayStr = getTodayDateString();
    const curYearMonth = getCurrentYearMonth();

    if (state.dateRangePreset === 'TODAY') {
      filtered = filtered.filter(tx => tx.date === todayStr);
    } else if (state.dateRangePreset === 'WEEK') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const minDateStr = sevenDaysAgo.toISOString().split('T')[0];
      filtered = filtered.filter(tx => tx.date >= minDateStr && tx.date <= todayStr);
    } else if (state.dateRangePreset === 'THIS_MONTH') {
      filtered = filtered.filter(tx => tx.date.startsWith(curYearMonth));
    } else if (state.dateRangePreset === 'LAST_MONTH') {
      const now = new Date();
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevYearMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      filtered = filtered.filter(tx => tx.date.startsWith(prevYearMonth));
    }

    const term = state.filters.search.toLowerCase().trim();
    if (term) {
      filtered = filtered.filter(tx =>
        tx.description.toLowerCase().includes(term) ||
        tx.category.toLowerCase().includes(term) ||
        tx.paymentMethod.toLowerCase().includes(term) ||
        String(tx.amount).includes(term)
      );
    }

    if (state.filters.category !== 'ALL') {
      filtered = filtered.filter(tx => tx.category === state.filters.category);
    }

    if (state.filters.payment !== 'ALL') {
      filtered = filtered.filter(tx => tx.paymentMethod === state.filters.payment);
    }

    if (state.dateRangePreset === 'ALL' && state.filters.month !== 'ALL') {
      filtered = filtered.filter(tx => tx.date.startsWith(state.filters.month));
    }

    switch (state.filters.sort) {
      case 'date-asc':
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
        break;
      case 'amount-desc':
        filtered.sort((a, b) => b.amount - a.amount);
        break;
      case 'amount-asc':
        filtered.sort((a, b) => a.amount - b.amount);
        break;
      case 'date-desc':
      default:
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);
        break;
    }

    const sum = filtered.reduce((acc, tx) => acc + tx.amount, 0);
    if (countDisplay) {
      countDisplay.textContent = `Showing ${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`;
    }
    if (totalSumDisplay) {
      totalSumDisplay.textContent = formatRupee(sum, true);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = filtered.map(tx => {
      const cat = CATEGORY_CONFIG[tx.category] || CATEGORY_CONFIG['Other'];
      return `
        <tr>
          <td>
            <div class="tx-desc-cell">
              <span class="tx-cat-icon" style="background-color: ${cat.color}22; color: ${cat.color};">${cat.icon}</span>
              <span class="tx-title">${escapeHtml(tx.description)}</span>
            </div>
          </td>
          <td><span class="badge-cat ${tx.category}">${cat.icon} ${escapeHtml(tx.category)}</span></td>
          <td>${formatDateReadable(tx.date)}</td>
          <td><span class="badge-payment ${tx.paymentMethod.toLowerCase()}">${escapeHtml(tx.paymentMethod)}</span></td>
          <td class="text-right tx-amount">${formatRupee(tx.amount, true)}</td>
          <td class="text-center">
            <div class="row-actions">
              <button class="action-icon-btn edit-btn" data-action="edit" data-id="${tx.id}" title="Edit expense" aria-label="Edit expense">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="action-icon-btn delete-btn" data-action="delete" data-id="${tx.id}" title="Delete expense" aria-label="Delete expense">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // 12. BUDGET PLANNER & CATEGORY TABLE
  // ==========================================================================
  function renderBudgetPlanner() {
    const selectedMonth = state.selectedAnalyticsMonth || getCurrentYearMonth();
    const metrics = calculateMonthMetrics(selectedMonth);
    const { totalSpent, budget, remaining, utilizationPct, dailySafeLimit, daysRemaining, isCurrentMonth, isPastMonth } = metrics;

    const budgetInput = document.getElementById('monthlyBudgetInput');
    if (budgetInput && document.activeElement !== budgetInput) {
      budgetInput.value = budget;
    }

    const gaugeSpent = document.getElementById('gaugeSpent');
    const gaugeRemaining = document.getElementById('gaugeRemaining');
    const gaugeStatusText = document.getElementById('gaugeStatusText');
    const gaugeProgressBar = document.getElementById('gaugeProgressBar');
    const gaugePct = document.getElementById('gaugePct');
    const gaugeDailyLimit = document.getElementById('gaugeDailyLimit');
    const gaugeDaysRemaining = document.getElementById('gaugeDaysRemaining');

    if (gaugeSpent) gaugeSpent.textContent = formatRupee(totalSpent);
    if (gaugeRemaining) {
      if (remaining >= 0) {
        gaugeRemaining.textContent = formatRupee(remaining);
        gaugeRemaining.style.color = 'var(--text-main)';
      } else {
        gaugeRemaining.textContent = '-' + formatRupee(Math.abs(remaining));
        gaugeRemaining.style.color = 'var(--color-danger)';
      }
    }

    const roundedPct = Math.round(utilizationPct);
    if (gaugePct) gaugePct.textContent = `${roundedPct}%`;

    if (gaugeDailyLimit) {
      if (isCurrentMonth) gaugeDailyLimit.textContent = `${formatRupee(dailySafeLimit)}/day`;
      else if (isPastMonth) gaugeDailyLimit.textContent = `Completed`;
      else gaugeDailyLimit.textContent = `${formatRupee(dailySafeLimit)}/day`;
    }

    if (gaugeDaysRemaining) {
      if (isCurrentMonth) gaugeDaysRemaining.textContent = `${daysRemaining} days`;
      else if (isPastMonth) gaugeDaysRemaining.textContent = `Month ended`;
      else gaugeDaysRemaining.textContent = `${daysRemaining} days`;
    }

    if (gaugeProgressBar && gaugeStatusText) {
      gaugeProgressBar.style.width = `${Math.min(100, roundedPct)}%`;
      gaugeProgressBar.className = 'budget-progress-fill';
      gaugeStatusText.className = 'badge';

      if (roundedPct >= 100) {
        gaugeProgressBar.classList.add('danger');
        gaugeStatusText.classList.add('badge-danger');
        gaugeStatusText.textContent = 'Exceeded';
      } else if (roundedPct >= 80) {
        gaugeProgressBar.classList.add('warning');
        gaugeStatusText.classList.add('badge-warning');
        gaugeStatusText.textContent = 'Approaching Limit';
      } else {
        gaugeProgressBar.classList.add('safe');
        gaugeStatusText.classList.add('badge-safe');
        gaugeStatusText.textContent = 'On Track';
      }
    }

    const catBody = document.getElementById('categoryBreakdownBody');
    if (catBody) {
      const monthExpenses = metrics.monthExpenses;
      const catCounts = {};
      Object.keys(CATEGORY_CONFIG).forEach(c => { catCounts[c] = 0; });
      monthExpenses.forEach(tx => {
        catCounts[tx.category] = (catCounts[tx.category] || 0) + 1;
      });

      catBody.innerHTML = Object.entries(CATEGORY_CONFIG).map(([catKey, catDef]) => {
        const spent = metrics.categoryTotals[catKey] || 0;
        const count = catCounts[catKey] || 0;
        const pct = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;

        return `
          <tr>
            <td>
              <div class="tx-desc-cell">
                <span class="tx-cat-icon" style="background-color: ${catDef.color}22; color: ${catDef.color};">${catDef.icon}</span>
                <span class="tx-title">${catDef.label}</span>
              </div>
            </td>
            <td>${count} txns</td>
            <td class="tx-amount">${formatRupee(spent, true)}</td>
            <td><strong>${pct}%</strong> of total</td>
            <td class="cat-progress-cell">
              <div class="cat-progress-bar">
                <div class="cat-progress-fill" style="width: ${pct}%; background-color: ${catDef.color};"></div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // ==========================================================================
  // 13. SAVINGS GOALS CONTROLLER (WITH CELEBRATION ENGINE)
  // ==========================================================================
  function renderSavingsGoals() {
    const grid = document.getElementById('savingsGoalsGrid');
    const empty = document.getElementById('savingsGoalsEmpty');
    if (!grid) return;

    if (!state.savingsGoals || state.savingsGoals.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    grid.innerHTML = state.savingsGoals.map(goal => {
      const saved = Math.max(0, goal.currentAmount || 0);
      const target = Math.max(1, goal.targetAmount || 1);
      const pct = Math.min(100, Math.round((saved / target) * 100));
      const isCompleted = saved >= target;
      const remainingAmt = Math.max(0, target - saved);

      return `
        <div class="goal-card ${isCompleted ? 'completed' : ''}" data-goal-id="${goal.id}">
          <div class="goal-card-header">
            <div class="goal-title-wrap">
              <div class="goal-icon-box">${goal.icon || '🎯'}</div>
              <div>
                <h4 class="goal-title">${escapeHtml(goal.name)}</h4>
                <div class="goal-target-date">
                  ${goal.targetDate ? `Target: ${formatDateReadable(goal.targetDate)}` : 'Continuous Goal'}
                </div>
              </div>
            </div>
            ${isCompleted ? '<span class="badge badge-safe">✦ 100% REACHED</span>' : ''}
          </div>

          <div class="goal-amounts-row">
            <span class="goal-saved-val">${formatRupee(saved)}</span>
            <span class="goal-target-val">Target: ${formatRupee(target)}</span>
          </div>

          <div class="goal-progress-track">
            <div class="goal-progress-fill ${isCompleted ? 'completed' : ''}" style="width: ${pct}%;"></div>
          </div>

          <div class="goal-actions-row">
            <div class="goal-pct-badge">${pct}% saved ${!isCompleted ? `(${formatRupee(remainingAmt)} left)` : ''}</div>
            <div class="goal-btn-group">
              <button class="btn btn-sm btn-mint deposit-goal-btn" data-goal-id="${goal.id}">+ Deposit</button>
              <button class="action-icon-btn edit-goal-btn" data-goal-id="${goal.id}" title="Edit goal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="action-icon-btn delete-goal-btn" data-goal-id="${goal.id}" title="Delete goal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function openAddGoalModal() {
    const modal = document.getElementById('savingsGoalModal');
    const form = document.getElementById('savingsGoalForm');
    const title = document.getElementById('goalModalTitle');
    const idInput = document.getElementById('goalIdInput');
    if (!modal || !form) return;

    form.reset();
    idInput.value = '';
    title.textContent = 'Create Savings Goal';
    document.getElementById('goalCurrentAmount').value = 0;
    modal.classList.remove('hidden');
    soundFx.playClick();
    document.getElementById('goalName').focus();
  }

  function openEditGoalModal(id) {
    const goal = state.savingsGoals.find(g => g.id === id);
    if (!goal) return;

    const modal = document.getElementById('savingsGoalModal');
    const title = document.getElementById('goalModalTitle');
    const idInput = document.getElementById('goalIdInput');

    idInput.value = goal.id;
    title.textContent = 'Edit Savings Goal';
    document.getElementById('goalName').value = goal.name;
    document.getElementById('goalTargetAmount').value = goal.targetAmount;
    document.getElementById('goalCurrentAmount').value = goal.currentAmount || 0;
    document.getElementById('goalCategory').value = goal.icon || '🎯';
    document.getElementById('goalTargetDate').value = goal.targetDate || '';

    modal.classList.remove('hidden');
    soundFx.playClick();
    document.getElementById('goalName').focus();
  }

  function handleSavingsGoalSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById('goalIdInput');
    const nameInput = document.getElementById('goalName');
    const targetInput = document.getElementById('goalTargetAmount');
    const currentInput = document.getElementById('goalCurrentAmount');
    const iconInput = document.getElementById('goalCategory');
    const dateInput = document.getElementById('goalTargetDate');

    const nameVal = nameInput.value.trim();
    const targetVal = parseFloat(targetInput.value);
    const currentVal = parseFloat(currentInput.value) || 0;

    if (!nameVal || isNaN(targetVal) || targetVal <= 0) {
      soundFx.playWarning();
      showToast('Please enter a valid goal name and target amount', 'error');
      return;
    }

    const isEdit = Boolean(idInput.value);
    if (isEdit) {
      const idx = state.savingsGoals.findIndex(g => g.id === idInput.value);
      if (idx !== -1) {
        state.savingsGoals[idx] = {
          ...state.savingsGoals[idx],
          name: nameVal,
          targetAmount: targetVal,
          currentAmount: currentVal,
          icon: iconInput.value,
          targetDate: dateInput.value
        };
        showToast('Savings goal updated!', 'success');
      }
    } else {
      const newGoal = {
        id: 'goal-' + Date.now().toString(36),
        name: nameVal,
        targetAmount: targetVal,
        currentAmount: currentVal,
        icon: iconInput.value,
        targetDate: dateInput.value
      };
      state.savingsGoals.push(newGoal);
      showToast('New savings goal created!', 'success');
    }

    soundFx.playSuccess();
    saveData();
    renderSavingsGoals();
    renderLuxuryShowcase();
    document.getElementById('savingsGoalModal').classList.add('hidden');
  }

  function deleteGoal(id) {
    const goal = state.savingsGoals.find(g => g.id === id);
    if (!goal) return;

    openConfirmModal(
      'Delete Savings Goal',
      `Are you sure you want to remove the goal "${goal.name}"?`,
      () => {
        state.savingsGoals = state.savingsGoals.filter(g => g.id !== id);
        saveData();
        renderSavingsGoals();
        renderLuxuryShowcase();
        soundFx.playClick();
        showToast('Savings goal removed', 'info');
      }
    );
  }

  function openFundGoalModal(goalId) {
    const goal = state.savingsGoals.find(g => g.id === goalId);
    if (!goal) return;

    const modal = document.getElementById('fundGoalModal');
    const subtitle = document.getElementById('fundGoalSubtitle');
    const fundGoalId = document.getElementById('fundGoalId');
    const amountInput = document.getElementById('fundAmount');

    fundGoalId.value = goal.id;
    subtitle.textContent = `Deposit into "${goal.name}" (Current: ${formatRupee(goal.currentAmount || 0)} / ${formatRupee(goal.targetAmount)})`;
    amountInput.value = '';
    modal.classList.remove('hidden');
    soundFx.playClick();
    amountInput.focus();
  }

  function handleFundGoalSubmit(e) {
    e.preventDefault();
    const fundGoalId = document.getElementById('fundGoalId').value;
    const amountInput = document.getElementById('fundAmount');
    const depositAmt = parseFloat(amountInput.value);

    if (isNaN(depositAmt) || depositAmt <= 0) {
      soundFx.playWarning();
      showToast('Please enter a valid deposit amount', 'error');
      return;
    }

    const goal = state.savingsGoals.find(g => g.id === fundGoalId);
    if (!goal) return;

    goal.currentAmount = (goal.currentAmount || 0) + depositAmt;
    saveData();
    renderSavingsGoals();
    renderLuxuryShowcase();
    document.getElementById('fundGoalModal').classList.add('hidden');

    if (goal.currentAmount >= goal.targetAmount) {
      soundFx.playCelebration();
      showToast(`🎉 Outstanding! You reached your goal "${goal.name}"!`, 'success');
      triggerConfetti();
    } else {
      soundFx.playSuccess();
      showToast(`Deposited ${formatRupee(depositAmt)} into "${goal.name}"!`, 'success');
    }
  }

  // ==========================================================================
  // 14. RECURRING BILLS CONTROLLER
  // ==========================================================================
  function renderRecurringBills() {
    const tbody = document.getElementById('recurringBillsBody');
    const empty = document.getElementById('recurringBillsEmpty');
    const totalPill = document.getElementById('recurringMonthlyTotalPill');
    if (!tbody) return;

    const bills = state.recurringBills || [];
    const monthlyTotal = bills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
    if (totalPill) totalPill.textContent = `Total: ${formatRupee(monthlyTotal)}/mo`;

    if (bills.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    const curMonthKey = getCurrentYearMonth();

    tbody.innerHTML = bills.map(bill => {
      const isPaid = Array.isArray(bill.paidMonths) && bill.paidMonths.includes(curMonthKey);
      const cat = CATEGORY_CONFIG[bill.category] || CATEGORY_CONFIG['Other'];

      return `
        <tr>
          <td>
            <div class="tx-desc-cell">
              <span class="tx-cat-icon" style="background-color: ${cat.color}22; color: ${cat.color};">${cat.icon}</span>
              <span class="tx-title">${escapeHtml(bill.name)}</span>
            </div>
          </td>
          <td><span class="badge-cat ${bill.category}">${cat.icon} ${escapeHtml(bill.category)}</span></td>
          <td>Due on ${bill.billingDay}${getOrdinalSuffix(bill.billingDay)} of month</td>
          <td><span class="badge-payment ${bill.paymentMethod.toLowerCase()}">${escapeHtml(bill.paymentMethod)}</span></td>
          <td class="text-right tx-amount">${formatRupee(bill.amount, true)}</td>
          <td class="text-center">
            <span class="bill-status-pill ${isPaid ? 'paid' : 'due'} toggle-bill-status-btn" data-bill-id="${bill.id}" title="Click to toggle Paid/Due status">
              ${isPaid ? '✓ Paid' : '⏳ Due'}
            </span>
          </td>
          <td class="text-center">
            <div class="row-actions">
              <button class="bill-quick-log-btn log-bill-expense-btn" data-bill-id="${bill.id}" title="Log this bill as today's expense">+ Log Today</button>
              <button class="action-icon-btn edit-bill-btn" data-bill-id="${bill.id}" title="Edit bill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="action-icon-btn delete-bill-btn" data-bill-id="${bill.id}" title="Delete bill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function getOrdinalSuffix(day) {
    const d = parseInt(day, 10);
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  function toggleBillStatus(id) {
    const bill = state.recurringBills.find(b => b.id === id);
    if (!bill) return;

    const curMonthKey = getCurrentYearMonth();
    if (!Array.isArray(bill.paidMonths)) bill.paidMonths = [];

    const idx = bill.paidMonths.indexOf(curMonthKey);
    if (idx !== -1) {
      bill.paidMonths.splice(idx, 1);
      soundFx.playClick();
      showToast(`Marked "${bill.name}" as Due for this month.`, 'info');
    } else {
      bill.paidMonths.push(curMonthKey);
      soundFx.playSuccess();
      showToast(`Marked "${bill.name}" as Paid for this month!`, 'success');
    }

    saveData();
    renderRecurringBills();
  }

  function quickLogBillExpense(id) {
    const bill = state.recurringBills.find(b => b.id === id);
    if (!bill) return;

    const newExpense = {
      id: 'tx-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      amount: bill.amount,
      description: bill.name,
      category: bill.category || 'Subscriptions',
      paymentMethod: bill.paymentMethod || 'UPI',
      date: getTodayDateString(),
      createdAt: Date.now()
    };

    state.expenses.unshift(newExpense);

    const curMonthKey = getCurrentYearMonth();
    if (!Array.isArray(bill.paidMonths)) bill.paidMonths = [];
    if (!bill.paidMonths.includes(curMonthKey)) {
      bill.paidMonths.push(curMonthKey);
    }

    soundFx.playSuccess();
    saveData();
    populateMonthSelectors();
    renderAll();
    showToast(`Logged "${bill.name}" (${formatRupee(bill.amount)}) to expenses!`, 'success');
  }

  function openAddBillModal() {
    const modal = document.getElementById('recurringBillModal');
    const form = document.getElementById('recurringBillForm');
    const title = document.getElementById('billModalTitle');
    const idInput = document.getElementById('billIdInput');
    if (!modal || !form) return;

    form.reset();
    idInput.value = '';
    title.textContent = 'Add Recurring Subscription / Bill';
    document.getElementById('billDay').value = 1;
    modal.classList.remove('hidden');
    soundFx.playClick();
    document.getElementById('billName').focus();
  }

  function openEditBillModal(id) {
    const bill = state.recurringBills.find(b => b.id === id);
    if (!bill) return;

    const modal = document.getElementById('recurringBillModal');
    const title = document.getElementById('billModalTitle');
    const idInput = document.getElementById('billIdInput');

    idInput.value = bill.id;
    title.textContent = 'Edit Recurring Bill';
    document.getElementById('billName').value = bill.name;
    document.getElementById('billAmount').value = bill.amount;
    document.getElementById('billDay').value = bill.billingDay || 1;
    document.getElementById('billCategory').value = bill.category || 'Subscriptions';
    document.getElementById('billPayment').value = bill.paymentMethod || 'UPI';

    modal.classList.remove('hidden');
    soundFx.playClick();
    document.getElementById('billName').focus();
  }

  function handleRecurringBillSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById('billIdInput');
    const nameInput = document.getElementById('billName');
    const amountInput = document.getElementById('billAmount');
    const dayInput = document.getElementById('billDay');
    const catInput = document.getElementById('billCategory');
    const payInput = document.getElementById('billPayment');

    const nameVal = nameInput.value.trim();
    const amountVal = parseFloat(amountInput.value);
    const dayVal = parseInt(dayInput.value, 10);

    if (!nameVal || isNaN(amountVal) || amountVal <= 0) {
      soundFx.playWarning();
      showToast('Please enter a valid bill name and amount', 'error');
      return;
    }

    const isEdit = Boolean(idInput.value);
    if (isEdit) {
      const idx = state.recurringBills.findIndex(b => b.id === idInput.value);
      if (idx !== -1) {
        state.recurringBills[idx] = {
          ...state.recurringBills[idx],
          name: nameVal,
          amount: amountVal,
          billingDay: Math.min(31, Math.max(1, dayVal || 1)),
          category: catInput.value,
          paymentMethod: payInput.value
        };
        showToast('Recurring bill updated!', 'success');
      }
    } else {
      const newBill = {
        id: 'bill-' + Date.now().toString(36),
        name: nameVal,
        amount: amountVal,
        billingDay: Math.min(31, Math.max(1, dayVal || 1)),
        category: catInput.value,
        paymentMethod: payInput.value,
        paidMonths: []
      };
      state.recurringBills.push(newBill);
      showToast('Recurring bill added!', 'success');
    }

    soundFx.playSuccess();
    saveData();
    renderRecurringBills();
    document.getElementById('recurringBillModal').classList.add('hidden');
  }

  function deleteBill(id) {
    const bill = state.recurringBills.find(b => b.id === id);
    if (!bill) return;

    openConfirmModal(
      'Delete Recurring Bill',
      `Are you sure you want to delete the bill "${bill.name}"?`,
      () => {
        state.recurringBills = state.recurringBills.filter(b => b.id !== id);
        saveData();
        renderRecurringBills();
        soundFx.playClick();
        showToast('Recurring bill removed', 'info');
      }
    );
  }

  // ==========================================================================
  // 15. EXPENSE CRUD (ADD, EDIT, DELETE)
  // ==========================================================================
  function openAddExpenseModal() {
    const modal = document.getElementById('expenseModal');
    const form = document.getElementById('expenseForm');
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('saveExpenseBtn');
    const idInput = document.getElementById('expenseIdInput');
    const dateInput = document.getElementById('expenseDate');

    if (!modal || !form) return;

    form.reset();
    clearFormErrors();
    idInput.value = '';
    modalTitle.textContent = 'Add New Expense';
    saveBtn.innerHTML = '<span>Save Expense</span>';
    dateInput.value = getTodayDateString();

    modal.classList.remove('hidden');
    soundFx.playClick();
    document.getElementById('expenseAmount').focus();
  }

  function openEditExpenseModal(id) {
    const expense = state.expenses.find(x => x.id === id);
    if (!expense) return;

    const modal = document.getElementById('expenseModal');
    const form = document.getElementById('expenseForm');
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('saveExpenseBtn');
    const idInput = document.getElementById('expenseIdInput');

    clearFormErrors();
    idInput.value = expense.id;
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('expenseDescription').value = expense.description;
    document.getElementById('expenseCategory').value = expense.category;
    document.getElementById('expensePayment').value = expense.paymentMethod;
    document.getElementById('expenseDate').value = expense.date;

    modalTitle.textContent = 'Edit Expense';
    saveBtn.innerHTML = '<span>Update Expense</span>';

    modal.classList.remove('hidden');
    soundFx.playClick();
    document.getElementById('expenseAmount').focus();
  }

  function closeModal() {
    const modal = document.getElementById('expenseModal');
    if (modal) modal.classList.add('hidden');
    clearFormErrors();
  }

  function clearFormErrors() {
    const form = document.getElementById('expenseForm');
    if (!form) return;
    const errorGroups = form.querySelectorAll('.form-group.has-error');
    errorGroups.forEach(g => g.classList.remove('has-error'));
  }

  function handleExpenseFormSubmit(e) {
    e.preventDefault();
    clearFormErrors();

    const idInput = document.getElementById('expenseIdInput');
    const amountInput = document.getElementById('expenseAmount');
    const descInput = document.getElementById('expenseDescription');
    const catInput = document.getElementById('expenseCategory');
    const paymentInput = document.getElementById('expensePayment');
    const dateInput = document.getElementById('expenseDate');

    const amountVal = parseFloat(amountInput.value);
    const descVal = descInput.value.trim();
    const catVal = catInput.value;
    const paymentVal = paymentInput.value;
    const dateVal = dateInput.value;

    let hasError = false;

    if (isNaN(amountVal) || amountVal <= 0) {
      amountInput.closest('.form-group').classList.add('has-error');
      hasError = true;
    }

    if (!descVal) {
      descInput.closest('.form-group').classList.add('has-error');
      hasError = true;
    }

    if (!dateVal) {
      dateInput.closest('.form-group').classList.add('has-error');
      hasError = true;
    }

    if (hasError) {
      soundFx.playWarning();
      return;
    }

    const isEdit = Boolean(idInput.value);

    if (isEdit) {
      const idx = state.expenses.findIndex(x => x.id === idInput.value);
      if (idx !== -1) {
        state.expenses[idx] = {
          ...state.expenses[idx],
          amount: amountVal,
          description: descVal,
          category: catVal,
          paymentMethod: paymentVal,
          date: dateVal
        };
        showToast('Expense updated successfully!', 'success');
      }
    } else {
      const newExpense = {
        id: 'tx-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        amount: amountVal,
        description: descVal,
        category: catVal,
        paymentMethod: paymentVal,
        date: dateVal,
        createdAt: Date.now()
      };
      state.expenses.unshift(newExpense);
      showToast('New expense recorded!', 'success');
    }

    soundFx.playSuccess();
    saveData();
    populateMonthSelectors();
    renderAll();
    closeModal();
  }

  function deleteExpense(id) {
    const expense = state.expenses.find(x => x.id === id);
    if (!expense) return;

    openConfirmModal(
      'Delete Expense',
      `Are you sure you want to delete "${expense.description}" of ${formatRupee(expense.amount)}?`,
      () => {
        state.expenses = state.expenses.filter(x => x.id !== id);
        saveData();
        populateMonthSelectors();
        renderAll();
        soundFx.playClick();
        showToast('Expense deleted', 'info');
      }
    );
  }

  // ==========================================================================
  // 16. CONFIRMATION MODAL & TOAST SYSTEM
  // ==========================================================================
  function openConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    if (!modal) return;

    titleEl.textContent = title;
    msgEl.textContent = message;
    state.pendingConfirmAction = onConfirm;

    modal.classList.remove('hidden');
    soundFx.playWarning();
  }

  function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.add('hidden');
    state.pendingConfirmAction = null;
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : ''}`;

    let icon = '✨';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.95)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // ==========================================================================
  // 17. EXPORT / IMPORT (CSV & JSON FULL BACKUP)
  // ==========================================================================
  function exportExpensesToCsv() {
    if (state.expenses.length === 0) {
      showToast('No expenses available to export', 'warning');
      return;
    }

    const headers = ['ID', 'Date', 'Description', 'Category', 'Payment Method', `Amount (${state.currency})`];
    const rows = state.expenses.map(tx => [
      `"${tx.id}"`,
      `"${tx.date}"`,
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${tx.category}"`,
      `"${tx.paymentMethod}"`,
      tx.amount.toFixed(2)
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    downloadBlob(csvContent, `paisa-plan-expenses-${getTodayDateString()}.csv`, 'text/csv;charset=utf-8;');
    soundFx.playSuccess();
    showToast('Expenses exported successfully to CSV!', 'success');
  }

  function exportAllDataJson() {
    const backupData = {
      app: 'Paisa Plan',
      edition: 'Classy & Animated',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      currency: state.currency,
      monthlyBudget: state.monthlyBudget,
      theme: state.theme,
      expenses: state.expenses,
      savingsGoals: state.savingsGoals,
      recurringBills: state.recurringBills
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    downloadBlob(jsonString, `paisa-plan-full-backup-${getTodayDateString()}.json`, 'application/json');
    soundFx.playSuccess();
    showToast('Full backup snapshot downloaded (.json)!', 'success');
  }

  function importAllDataJson(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !Array.isArray(data.expenses)) {
          throw new Error('Invalid structure');
        }

        state.expenses = data.expenses;
        if (typeof data.monthlyBudget === 'number') state.monthlyBudget = data.monthlyBudget;
        if (Array.isArray(data.savingsGoals)) state.savingsGoals = data.savingsGoals;
        if (Array.isArray(data.recurringBills)) state.recurringBills = data.recurringBills;
        if (data.currency && CURRENCY_CONFIG[data.currency]) state.currency = data.currency;
        if (data.theme === 'light' || data.theme === 'dark') applyTheme(data.theme);

        saveData();
        populateMonthSelectors();
        renderAll();
        soundFx.playCelebration();
        showToast(`Restored ${state.expenses.length} records successfully!`, 'success');
      } catch (err) {
        soundFx.playWarning();
        showToast('Error restoring backup file: Invalid JSON format.', 'error');
      }
    };
    reader.readAsText(file);
  }

  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ==========================================================================
  // 18. PRINTABLE MONTHLY STATEMENT PREVIEW
  // ==========================================================================
  function openStatementModal() {
    const modal = document.getElementById('statementModal');
    const printArea = document.getElementById('statementPrintArea');
    if (!modal || !printArea) return;

    const selectedMonth = state.selectedAnalyticsMonth || getCurrentYearMonth();
    const metrics = calculateMonthMetrics(selectedMonth);
    const [y, m] = selectedMonth.split('-');
    const monthObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    const monthName = monthObj.toLocaleDateString(getCurrencyConfig().locale, { month: 'long', year: 'numeric' });

    printArea.innerHTML = `
      <div class="statement-header">
        <div class="statement-title-wrap">
          <h2>Paisa Plan — Monthly Financial Statement</h2>
          <p style="color: var(--text-dim); font-size: 0.9rem;">Period: <strong>${monthName}</strong> | Generated on: ${formatDateReadable(getTodayDateString())}</p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 1.5rem; font-weight: 800; color: var(--mint-light);">${getCurrencyConfig().symbol}</span>
        </div>
      </div>

      <div class="statement-metrics-grid">
        <div class="statement-metric-box">
          <div class="label">Monthly Budget</div>
          <div class="val">${formatRupee(metrics.budget)}</div>
        </div>
        <div class="statement-metric-box">
          <div class="label">Total Spent</div>
          <div class="val" style="color: ${metrics.totalSpent > metrics.budget ? 'var(--color-danger)' : 'var(--mint-light)'};">${formatRupee(metrics.totalSpent)}</div>
        </div>
        <div class="statement-metric-box">
          <div class="label">Net Balance</div>
          <div class="val" style="color: ${metrics.remaining < 0 ? 'var(--color-danger)' : 'var(--mint-light)'};">${formatRupee(metrics.remaining)}</div>
        </div>
        <div class="statement-metric-box">
          <div class="label">Utilization</div>
          <div class="val">${Math.round(metrics.utilizationPct)}%</div>
        </div>
      </div>

      <h4 style="margin: 20px 0 10px 0; font-size: 1rem;">Category Allocation</h4>
      <table class="data-table" style="width: 100%; margin-bottom: 24px;">
        <thead>
          <tr>
            <th>Category</th>
            <th>Transactions</th>
            <th class="text-right">Total Spent</th>
            <th class="text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(metrics.categoryTotals).map(([cat, amt]) => {
            const count = metrics.monthExpenses.filter(e => e.category === cat).length;
            const pct = metrics.totalSpent > 0 ? Math.round((amt / metrics.totalSpent) * 100) : 0;
            return `
              <tr>
                <td>${CATEGORY_CONFIG[cat].icon} ${cat}</td>
                <td>${count} txns</td>
                <td class="text-right">${formatRupee(amt, true)}</td>
                <td class="text-right">${pct}%</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <h4 style="margin: 20px 0 10px 0; font-size: 1rem;">Recorded Transactions (${metrics.monthExpenses.length})</h4>
      <table class="data-table" style="width: 100%;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Payment</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.monthExpenses.map(tx => `
            <tr>
              <td>${formatDateReadable(tx.date)}</td>
              <td>${escapeHtml(tx.description)}</td>
              <td>${tx.category}</td>
              <td>${tx.paymentMethod}</td>
              <td class="text-right">${formatRupee(tx.amount, true)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    modal.classList.remove('hidden');
    soundFx.playClick();
  }

  // ==========================================================================
  // 19. CONFETTI CELEBRATION ENGINE
  // ==========================================================================
  function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#10b981', '#34d399', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#fbbf24'];

    for (let i = 0; i < 110; i++) {
      particles.push({
        x: canvas.width * 0.5,
        y: canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 18,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        gravity: 0.32,
        alpha: 1
      });
    }

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.vr;
        p.alpha -= 0.011;

        if (p.alpha > 0) {
          active = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      frame++;
      if (active && frame < 130) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    requestAnimationFrame(animate);
  }

  // ==========================================================================
  // 20. VIEW NAVIGATION & SETTINGS
  // ==========================================================================
  function switchView(viewName) {
    if (state.activeView !== viewName) {
      soundFx.playClick();
    }
    state.activeView = viewName;

    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    const views = {
      dashboard: document.getElementById('viewDashboard'),
      transactions: document.getElementById('viewTransactions'),
      analytics: document.getElementById('viewAnalytics'),
      settings: document.getElementById('viewSettings')
    };

    Object.entries(views).forEach(([name, el]) => {
      if (el) el.classList.toggle('active', name === viewName);
    });

    const titleEl = document.getElementById('pageTitle');
    const subEl = document.getElementById('pageSubtitle');

    if (titleEl && subEl) {
      switch (viewName) {
        case 'dashboard':
          titleEl.textContent = 'Dashboard';
          subEl.textContent = "Welcome to Paisa Plan! Track and control your spending.";
          break;
        case 'transactions':
          titleEl.textContent = 'Transactions';
          subEl.textContent = 'Filter, search, and audit all your expenditures with precision.';
          break;
        case 'analytics':
          titleEl.textContent = 'Budget, Goals & Analytics';
          subEl.textContent = 'Track savings targets, manage recurring bills, and review pacing.';
          break;
        case 'settings':
          titleEl.textContent = 'Settings & Privacy';
          subEl.textContent = 'Configure preferences, manage data backups, and review local privacy.';
          break;
      }
    }

    closeMobileSidebar();

    if (viewName === 'dashboard' || viewName === 'analytics') {
      setTimeout(() => {
        if (state.charts.category) state.charts.category.resize();
        if (state.charts.trend) state.charts.trend.resize();
        if (state.charts.analyticsCategory) state.charts.analyticsCategory.resize();
        if (state.charts.paymentMethod) state.charts.paymentMethod.resize();
      }, 50);
    }
  }

  function toggleMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    }
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && overlay) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
  }

  function renderSettingsView() {
    const defaultBudgetEl = document.getElementById('defaultBudgetSetting');
    if (defaultBudgetEl && document.activeElement !== defaultBudgetEl) {
      defaultBudgetEl.value = state.monthlyBudget;
    }

    const txCountEl = document.getElementById('settingsTxCount');
    if (txCountEl) {
      txCountEl.textContent = `${state.expenses.length} records`;
    }

    const currSelect = document.getElementById('currencySelect');
    if (currSelect) currSelect.value = state.currency;

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = state.theme;

    const soundSelect = document.getElementById('soundSettingSelect');
    if (soundSelect) soundSelect.value = state.soundEnabled ? 'enabled' : 'disabled';
  }

  // ==========================================================================
  // 21. EVENT LISTENERS INITIALIZATION
  // ==========================================================================
  function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view) switchView(view);
      });
    });

    // Theme toggles
    const mobileThemeToggleBtn = document.getElementById('mobileThemeToggleBtn');
    const topBarThemeToggleBtn = document.getElementById('topBarThemeToggleBtn');
    const sidebarThemeToggleBtn = document.getElementById('sidebarThemeToggleBtn');
    const themeSelect = document.getElementById('themeSelect');

    if (mobileThemeToggleBtn) mobileThemeToggleBtn.addEventListener('click', toggleTheme);
    if (topBarThemeToggleBtn) topBarThemeToggleBtn.addEventListener('click', toggleTheme);
    if (sidebarThemeToggleBtn) sidebarThemeToggleBtn.addEventListener('click', toggleTheme);
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        applyTheme(e.target.value);
        saveData();
      });
    }

    // Sound toggle
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const soundSettingSelect = document.getElementById('soundSettingSelect');
    if (soundToggleBtn) soundToggleBtn.addEventListener('click', toggleSound);
    if (soundSettingSelect) {
      soundSettingSelect.addEventListener('change', (e) => {
        state.soundEnabled = e.target.value === 'enabled';
        soundFx.enabled = state.soundEnabled;
        updateSoundUI();
        saveData();
        if (state.soundEnabled) soundFx.playSuccess();
      });
    }

    // Currency selector
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
      currencySelect.addEventListener('change', (e) => {
        setCurrency(e.target.value);
      });
    }

    // Mobile Navbar Toggles
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mobileAddBtn = document.getElementById('mobileAddBtn');

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
    if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);
    if (mobileAddBtn) mobileAddBtn.addEventListener('click', openAddExpenseModal);

    // "+ Add Expense" Trigger Buttons
    const openAddModalBtn = document.getElementById('openAddModalBtn');
    const quickAddExpenseBtn = document.getElementById('quickAddExpenseBtn');
    if (openAddModalBtn) openAddModalBtn.addEventListener('click', openAddExpenseModal);
    if (quickAddExpenseBtn) quickAddExpenseBtn.addEventListener('click', openAddExpenseModal);

    document.addEventListener('click', (e) => {
      if (e.target.closest('.open-add-modal-trigger')) {
        openAddExpenseModal();
      }
    });

    // Modal Close Buttons
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const expenseModal = document.getElementById('expenseModal');

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
    if (expenseModal) {
      expenseModal.addEventListener('click', (e) => {
        if (e.target === expenseModal) closeModal();
      });
    }

    const expenseForm = document.getElementById('expenseForm');
    if (expenseForm) expenseForm.addEventListener('submit', handleExpenseFormSubmit);

    // Quick Amount Chips in Modal
    document.querySelectorAll('.quick-amount-chips .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const addVal = parseFloat(btn.dataset.add) || 0;
        const amountInput = document.getElementById('expenseAmount');
        const cur = parseFloat(amountInput.value) || 0;
        amountInput.value = (cur + addVal).toFixed(0);
        soundFx.playClick();
        amountInput.focus();
      });
    });

    // Quick Date Range Filter Pills in Transactions
    document.querySelectorAll('.quick-date-pills .date-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quick-date-pills .date-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.dateRangePreset = btn.dataset.range || 'ALL';
        soundFx.playClick();
        renderFilteredTransactions();
      });
    });

    // Table Row Action Delegation (Edit & Delete Expenses)
    document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;

      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;

      if (action === 'edit' && id) {
        openEditExpenseModal(id);
      } else if (action === 'delete' && id) {
        deleteExpense(id);
      }
    });

    // Navigation shortcuts
    const viewAllTxBtn = document.getElementById('viewAllTxBtn');
    if (viewAllTxBtn) viewAllTxBtn.addEventListener('click', () => switchView('transactions'));

    const quickEditBudgetBtn = document.getElementById('quickEditBudgetBtn');
    if (quickEditBudgetBtn) quickEditBudgetBtn.addEventListener('click', () => switchView('analytics'));

    // Filter Controls in Transactions View
    const txSearchInput = document.getElementById('txSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const filterCategory = document.getElementById('filterCategory');
    const filterPayment = document.getElementById('filterPayment');
    const filterMonth = document.getElementById('filterMonth');
    const sortTransactions = document.getElementById('sortTransactions');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const clearFiltersActionBtn = document.getElementById('clearFiltersActionBtn');

    if (txSearchInput) {
      txSearchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !e.target.value);
        renderFilteredTransactions();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        txSearchInput.value = '';
        state.filters.search = '';
        clearSearchBtn.classList.add('hidden');
        soundFx.playClick();
        renderFilteredTransactions();
      });
    }

    if (filterCategory) {
      filterCategory.addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        soundFx.playClick();
        renderFilteredTransactions();
      });
    }

    if (filterPayment) {
      filterPayment.addEventListener('change', (e) => {
        state.filters.payment = e.target.value;
        soundFx.playClick();
        renderFilteredTransactions();
      });
    }

    if (filterMonth) {
      filterMonth.addEventListener('change', (e) => {
        state.filters.month = e.target.value;
        soundFx.playClick();
        renderFilteredTransactions();
      });
    }

    if (sortTransactions) {
      sortTransactions.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        soundFx.playClick();
        renderFilteredTransactions();
      });
    }

    const resetFilterHandler = () => {
      state.filters = {
        search: '',
        category: 'ALL',
        payment: 'ALL',
        month: 'ALL',
        sort: 'date-desc'
      };
      state.dateRangePreset = 'ALL';
      document.querySelectorAll('.quick-date-pills .date-pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.range === 'ALL');
      });
      if (txSearchInput) txSearchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
      if (filterCategory) filterCategory.value = 'ALL';
      if (filterPayment) filterPayment.value = 'ALL';
      if (filterMonth) filterMonth.value = 'ALL';
      if (sortTransactions) sortTransactions.value = 'date-desc';
      soundFx.playClick();
      renderFilteredTransactions();
    };

    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetFilterHandler);
    if (clearFiltersActionBtn) clearFiltersActionBtn.addEventListener('click', resetFilterHandler);

    // CSV & JSON Export / Import
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const settingsExportCsvBtn = document.getElementById('settingsExportCsvBtn');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportExpensesToCsv);
    if (settingsExportCsvBtn) settingsExportCsvBtn.addEventListener('click', exportExpensesToCsv);

    const exportJsonBtn = document.getElementById('exportJsonBtn');
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportAllDataJson);

    const importJsonBtn = document.getElementById('importJsonBtn');
    const importJsonFileInput = document.getElementById('importJsonFileInput');
    if (importJsonBtn && importJsonFileInput) {
      importJsonBtn.addEventListener('click', () => importJsonFileInput.click());
      importJsonFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          importAllDataJson(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // Budget Planner Form
    const budgetSettingForm = document.getElementById('budgetSettingForm');
    const monthlyBudgetInput = document.getElementById('monthlyBudgetInput');
    const analyticsMonthSelect = document.getElementById('analyticsMonthSelect');

    if (budgetSettingForm && monthlyBudgetInput) {
      budgetSettingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newBudget = parseFloat(monthlyBudgetInput.value);
        if (!isNaN(newBudget) && newBudget > 0) {
          state.monthlyBudget = newBudget;
          soundFx.playSuccess();
          saveData();
          renderAll();
          showToast(`Monthly budget set to ${formatRupee(newBudget)}!`, 'success');
        } else {
          soundFx.playWarning();
          showToast('Please enter a valid budget amount', 'error');
        }
      });
    }

    document.querySelectorAll('.budget-presets .preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.preset);
        if (monthlyBudgetInput && !isNaN(val)) {
          monthlyBudgetInput.value = val;
          state.monthlyBudget = val;
          soundFx.playClick();
          saveData();
          renderAll();
          showToast(`Budget set to ${formatRupee(val)}`, 'info');
        }
      });
    });

    if (analyticsMonthSelect) {
      analyticsMonthSelect.addEventListener('change', (e) => {
        state.selectedAnalyticsMonth = e.target.value;
        soundFx.playClick();
        renderBudgetPlanner();
        renderAnalyticsCharts();
        generateSmartInsights();
      });
    }

    // Savings Goals
    const openAddGoalBtn = document.getElementById('openAddGoalBtn');
    const emptyAddGoalBtn = document.getElementById('emptyAddGoalBtn');
    const closeGoalModalBtn = document.getElementById('closeGoalModalBtn');
    const cancelGoalModalBtn = document.getElementById('cancelGoalModalBtn');
    const savingsGoalForm = document.getElementById('savingsGoalForm');

    if (openAddGoalBtn) openAddGoalBtn.addEventListener('click', openAddGoalModal);
    if (emptyAddGoalBtn) emptyAddGoalBtn.addEventListener('click', openAddGoalModal);
    if (closeGoalModalBtn) closeGoalModalBtn.addEventListener('click', () => document.getElementById('savingsGoalModal').classList.add('hidden'));
    if (cancelGoalModalBtn) cancelGoalModalBtn.addEventListener('click', () => document.getElementById('savingsGoalModal').classList.add('hidden'));
    if (savingsGoalForm) savingsGoalForm.addEventListener('submit', handleSavingsGoalSubmit);

    document.addEventListener('click', (e) => {
      const depBtn = e.target.closest('.deposit-goal-btn');
      if (depBtn) {
        openFundGoalModal(depBtn.dataset.goalId);
        return;
      }
      const editBtn = e.target.closest('.edit-goal-btn');
      if (editBtn) {
        openEditGoalModal(editBtn.dataset.goalId);
        return;
      }
      const delBtn = e.target.closest('.delete-goal-btn');
      if (delBtn) {
        deleteGoal(delBtn.dataset.goalId);
        return;
      }
    });

    const closeFundModalBtn = document.getElementById('closeFundModalBtn');
    const cancelFundModalBtn = document.getElementById('cancelFundModalBtn');
    const fundGoalForm = document.getElementById('fundGoalForm');

    if (closeFundModalBtn) closeFundModalBtn.addEventListener('click', () => document.getElementById('fundGoalModal').classList.add('hidden'));
    if (cancelFundModalBtn) cancelFundModalBtn.addEventListener('click', () => document.getElementById('fundGoalModal').classList.add('hidden'));
    if (fundGoalForm) fundGoalForm.addEventListener('submit', handleFundGoalSubmit);

    document.querySelectorAll('.fund-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const addVal = parseFloat(btn.dataset.fund) || 0;
        const input = document.getElementById('fundAmount');
        const cur = parseFloat(input.value) || 0;
        input.value = (cur + addVal).toFixed(0);
        soundFx.playClick();
        input.focus();
      });
    });

    // Recurring Bills
    const openAddBillBtn = document.getElementById('openAddBillBtn');
    const emptyAddBillBtn = document.getElementById('emptyAddBillBtn');
    const closeBillModalBtn = document.getElementById('closeBillModalBtn');
    const cancelBillModalBtn = document.getElementById('cancelBillModalBtn');
    const recurringBillForm = document.getElementById('recurringBillForm');

    if (openAddBillBtn) openAddBillBtn.addEventListener('click', openAddBillModal);
    if (emptyAddBillBtn) emptyAddBillBtn.addEventListener('click', openAddBillModal);
    if (closeBillModalBtn) closeBillModalBtn.addEventListener('click', () => document.getElementById('recurringBillModal').classList.add('hidden'));
    if (cancelBillModalBtn) cancelBillModalBtn.addEventListener('click', () => document.getElementById('recurringBillModal').classList.add('hidden'));
    if (recurringBillForm) recurringBillForm.addEventListener('submit', handleRecurringBillSubmit);

    document.addEventListener('click', (e) => {
      const statusBtn = e.target.closest('.toggle-bill-status-btn');
      if (statusBtn) {
        toggleBillStatus(statusBtn.dataset.billId);
        return;
      }
      const logBtn = e.target.closest('.log-bill-expense-btn');
      if (logBtn) {
        quickLogBillExpense(logBtn.dataset.billId);
        return;
      }
      const editBtn = e.target.closest('.edit-bill-btn');
      if (editBtn) {
        openEditBillModal(editBtn.dataset.billId);
        return;
      }
      const delBtn = e.target.closest('.delete-bill-btn');
      if (delBtn) {
        deleteBill(delBtn.dataset.billId);
        return;
      }
    });

    // Keyboard Shortcuts
    const openShortcutsBtn = document.getElementById('openShortcutsBtn');
    const sidebarShortcutsBtn = document.getElementById('sidebarShortcutsBtn');
    const closeShortcutsModalBtn = document.getElementById('closeShortcutsModalBtn');
    const dismissShortcutsModalBtn = document.getElementById('dismissShortcutsModalBtn');
    const shortcutsModal = document.getElementById('shortcutsModal');

    const showShortcuts = () => { soundFx.playClick(); if (shortcutsModal) shortcutsModal.classList.remove('hidden'); };
    const hideShortcuts = () => { if (shortcutsModal) shortcutsModal.classList.add('hidden'); };

    if (openShortcutsBtn) openShortcutsBtn.addEventListener('click', showShortcuts);
    if (sidebarShortcutsBtn) sidebarShortcutsBtn.addEventListener('click', showShortcuts);
    if (closeShortcutsModalBtn) closeShortcutsModalBtn.addEventListener('click', hideShortcuts);
    if (dismissShortcutsModalBtn) dismissShortcutsModalBtn.addEventListener('click', hideShortcuts);

    // Printable Statement
    const topBarPrintBtn = document.getElementById('topBarPrintBtn');
    const settingsPrintBtn = document.getElementById('settingsPrintBtn');
    const closeStatementModalBtn = document.getElementById('closeStatementModalBtn');
    const cancelStatementBtn = document.getElementById('cancelStatementBtn');
    const triggerPrintBtn = document.getElementById('triggerPrintBtn');
    const statementModal = document.getElementById('statementModal');

    if (topBarPrintBtn) topBarPrintBtn.addEventListener('click', openStatementModal);
    if (settingsPrintBtn) settingsPrintBtn.addEventListener('click', openStatementModal);
    if (closeStatementModalBtn) closeStatementModalBtn.addEventListener('click', () => statementModal.classList.add('hidden'));
    if (cancelStatementBtn) cancelStatementBtn.addEventListener('click', () => statementModal.classList.add('hidden'));
    if (triggerPrintBtn) triggerPrintBtn.addEventListener('click', () => window.print());

    // Demo Data & Clear Data
    const loadSampleDataBtn = document.getElementById('loadSampleDataBtn');
    if (loadSampleDataBtn) {
      loadSampleDataBtn.addEventListener('click', () => {
        openConfirmModal(
          'Load Demo Sample Data',
          'This will populate realistic expenses, savings goals, and recurring bills for presentation & evaluation. Existing records will be refreshed.',
          () => {
            loadDefaultSampleData();
            populateMonthSelectors();
            renderAll();
            soundFx.playCelebration();
            showToast('Demo data loaded successfully!', 'success');
          }
        );
      });
    }

    const clearAllDataBtn = document.getElementById('clearAllDataBtn');
    if (clearAllDataBtn) {
      clearAllDataBtn.addEventListener('click', () => {
        openConfirmModal(
          'Reset All Records',
          'Are you sure you want to permanently delete all recorded expenses, budgets, savings goals, and recurring bills? This action cannot be undone.',
          () => {
            state.expenses = [];
            state.savingsGoals = [];
            state.recurringBills = [];
            state.monthlyBudget = DEFAULT_MONTHLY_BUDGET;
            saveData();
            populateMonthSelectors();
            renderAll();
            soundFx.playWarning();
            showToast('All transaction records have been erased.', 'warning');
          }
        );
      });
    }

    // Confirmation Modal
    const confirmAcceptBtn = document.getElementById('confirmAcceptBtn');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const confirmModal = document.getElementById('confirmModal');

    if (confirmAcceptBtn) {
      confirmAcceptBtn.addEventListener('click', () => {
        if (typeof state.pendingConfirmAction === 'function') {
          state.pendingConfirmAction();
        }
        closeConfirmModal();
      });
    }

    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeConfirmModal);
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeConfirmModal();
      });
    }

    // Dismiss Alert
    const alertDismissBtn = document.getElementById('alertDismissBtn');
    const budgetAlertBanner = document.getElementById('budgetAlertBanner');
    if (alertDismissBtn && budgetAlertBanner) {
      alertDismissBtn.addEventListener('click', () => {
        state.alertDismissed = true;
        soundFx.playClick();
        budgetAlertBanner.classList.add('hidden');
      });
    }

    // 3D Tilt Effect on Platinum Card
    const cardEl = document.getElementById('platinumCard');
    if (cardEl) {
      cardEl.addEventListener('mousemove', (e) => {
        const rect = cardEl.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const rotateX = -(y / rect.height) * 14;
        const rotateY = (x / rect.width) * 14;
        cardEl.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      });

      cardEl.addEventListener('mouseleave', () => {
        cardEl.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      });
    }

    // Keyboard Hotkeys
    document.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (e.key === 'Escape') {
        closeModal();
        closeConfirmModal();
        closeMobileSidebar();
        if (shortcutsModal) hideShortcuts();
        if (statementModal) statementModal.classList.add('hidden');
        const gModal = document.getElementById('savingsGoalModal');
        if (gModal) gModal.classList.add('hidden');
        const fModal = document.getElementById('fundGoalModal');
        if (fModal) fModal.classList.add('hidden');
        const bModal = document.getElementById('recurringBillModal');
        if (bModal) bModal.classList.add('hidden');
        return;
      }

      if (isInput) return;

      const key = e.key.toLowerCase();
      if (key === 'n' || key === '+') {
        e.preventDefault();
        openAddExpenseModal();
      } else if (key === '/') {
        e.preventDefault();
        switchView('transactions');
        const sInput = document.getElementById('txSearchInput');
        if (sInput) sInput.focus();
      } else if (key === 'd' || key === '1') {
        switchView('dashboard');
      } else if (key === 't' || key === '2') {
        switchView('transactions');
      } else if (key === 'b' || key === '3') {
        switchView('analytics');
      } else if (key === 's' || key === '4') {
        switchView('settings');
      } else if (key === 'm') {
        toggleTheme();
      } else if (key === 'p') {
        openStatementModal();
      } else if (e.key === '?') {
        showShortcuts();
      }
    });
  }

  // ==========================================================================
  // 22. BOOTSTRAP
  // ==========================================================================
  function init() {
    loadData();
    initChartDefaults();
    populateMonthSelectors();
    setupEventListeners();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

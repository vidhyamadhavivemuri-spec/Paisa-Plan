
"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const KEYS = {
    expenses: "paisaPlanExpenses",
    budget: "paisaPlanBudget"
  };

  const CATEGORIES = [
    "Food", "Transport", "Education", "Shopping",
    "Subscriptions", "Bills", "Health", "Other"
  ];

  const COLORS = [
    "#a78bfa", "#34d399", "#60a5fa", "#fb7185",
    "#fbbf24", "#22d3ee", "#f97316", "#c084fc"
  ];

  let expenses = [];
  let budget = 5000;
  let editingId = null;
  let categoryChart = null;
  let trendChart = null;

  function todayString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function money(value) {
    return Number(value).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function readExpenses() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEYS.expenses) || "[]");
      if (!Array.isArray(saved)) return [];

      return saved.filter((e) =>
        e && typeof e.id === "string" &&
        Number.isFinite(Number(e.amount)) &&
        Number(e.amount) > 0 &&
        typeof e.date === "string"
      ).map((e) => ({
        ...e,
        amount: Number(e.amount),
        description: String(e.description || ""),
        category: String(e.category || "Other"),
        payment: String(e.payment || "Other")
      }));
    } catch (error) {
      console.error("Loading expenses failed:", error);
      return [];
    }
  }

  function readBudget() {
    try {
      const value = Number(localStorage.getItem(KEYS.budget));
      return Number.isFinite(value) && value > 0 ? value : 5000;
    } catch {
      return 5000;
    }
  }

  function persistExpenses() {
    try {
      localStorage.setItem(KEYS.expenses, JSON.stringify(expenses));
      return true;
    } catch (error) {
      console.error(error);
      showMessage("Could not save. Check your browser storage.", true);
      return false;
    }
  }

  function persistBudget() {
    try {
      localStorage.setItem(KEYS.budget, String(budget));
      return true;
    } catch (error) {
      console.error(error);
      showMessage("Could not save your budget.", true);
      return false;
    }
  }

  function showMessage(message, isError = false) {
    const el = $("formMessage");
    el.textContent = message;
    el.classList.toggle("error", isError);
  }

  function monthExpenses() {
    const currentMonth = todayString().slice(0, 7);
    return expenses.filter((e) => e.date.slice(0, 7) === currentMonth);
  }

  // The top Add Expense button calls this function directly.
  window.openExpenseForm = function () {
    const form = $("expenseForm");

    if (!form) {
      alert("Expense form was not found. Check index.html.");
      return;
    }

    form.scrollIntoView({ behavior: "smooth", block: "center" });
    $("amount").focus({ preventScroll: true });
  };

  function updateDashboard() {
    const monthly = monthExpenses().reduce((sum, e) => sum + e.amount, 0);
    const today = expenses
      .filter((e) => e.date === todayString())
      .reduce((sum, e) => sum + e.amount, 0);

    $("monthlyTotal").textContent = money(monthly);
    $("todayTotal").textContent = money(today);
    $("budgetTotal").textContent = money(budget);

    const percentage = monthly / budget * 100;
    const remaining = budget - monthly;

    $("budgetProgress").style.width =
      `${Math.min(100, Math.max(0, percentage))}%`;

    $("budgetProgress").style.background =
      percentage >= 100 ? "#fb7185" :
      percentage >= 80 ? "#fbbf24" : "#34d399";

    $("budgetSummary").textContent = remaining >= 0
      ? `${money(remaining)} remaining · ${percentage.toFixed(1)}% used`
      : `Over budget by ${money(-remaining)}`;

    $("budgetStatus").textContent =
      monthly === 0 ? "No spending recorded this month" :
      percentage >= 100 ? "Monthly budget exceeded!" :
      percentage >= 80 ? "Approaching your budget" :
      "Within your budget";

    $("smartTip").textContent =
      monthly === 0
        ? "Start recording expenses to understand your spending."
        : percentage >= 100
        ? "Your spending has exceeded your budget. Review your expenses."
        : percentage >= 80
        ? "You're nearing your budget. Keep an eye on your spending."
        : "Keep tracking your expenses to stay in control.";
  }

  function updateCharts() {
    const categoryCanvas = $("categoryChart");
    const trendCanvas = $("trendChart");

    if (typeof Chart === "undefined") {
      categoryCanvas.hidden = true;
      trendCanvas.hidden = true;
      $("categoryEmpty").hidden = false;
      $("trendEmpty").hidden = false;
      $("categoryEmpty").textContent =
        "Chart library unavailable. Check your internet connection.";
      $("trendEmpty").textContent =
        "Chart library unavailable. Check your internet connection.";
      return;
    }

    // Category doughnut: current month's expenses.
    const totals = {};

    monthExpenses().forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });

    const labels = Object.keys(totals);
    const values = labels.map((label) => totals[label]);

    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }

    categoryCanvas.hidden = labels.length === 0;
    $("categoryEmpty").hidden = labels.length > 0;

    if (labels.length > 0) {
      categoryChart = new Chart(categoryCanvas, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: labels.map((label) => {
              const index = CATEGORIES.indexOf(label);
              return COLORS[index < 0 ? COLORS.length - 1 : index];
            }),
            borderColor: "#151d30",
            borderWidth: 4,
            hoverOffset: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#c6d4eb",
                padding: 16,
                usePointStyle: true
              }
            },
            tooltip: {
              callbacks: {
                label: (context) =>
                  `${context.label}: ${money(context.raw)}`
              }
            }
          }
        }
      });
    }

    // Last six months, including the current month.
    const now = new Date();
    const keys = [];
    const monthLabels = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = todayString(date).slice(0, 7);
      keys.push(key);
      monthLabels.push(date.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit"
      }));
    }

    const valuesByMonth = keys.map((key) =>
      expenses.filter((e) => e.date.slice(0, 7) === key)
        .reduce((sum, e) => sum + e.amount, 0)
    );

    const hasData = valuesByMonth.some((amount) => amount > 0);

    if (trendChart) {
      trendChart.destroy();
      trendChart = null;
    }

    trendCanvas.hidden = !hasData;
    $("trendEmpty").hidden = hasData;

    if (hasData) {
      trendChart = new Chart(trendCanvas, {
        type: "line",
        data: {
          labels: monthLabels,
          datasets: [{
            label: "Monthly spending",
            data: valuesByMonth,
            borderColor: "#a78bfa",
            backgroundColor: "rgba(167, 139, 250, 0.16)",
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: "#a78bfa"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: "#c6d4eb" }
            },
            tooltip: {
              callbacks: {
                label: (context) => `Spending: ${money(context.raw)}`
              }
            }
          },
          scales: {
            x: {
              ticks: { color: "#91acd0" },
              grid: { color: "rgba(145,172,208,0.08)" }
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: "#91acd0",
                callback: (value) =>
                  "₹" + Number(value).toLocaleString("en-IN")
              },
              grid: { color: "rgba(145,172,208,0.12)" }
            }
          }
        }
      });
    }
  }

  function renderTransactions() {
    const list = $("transactionList");
    const query = $("searchInput").value.trim().toLowerCase();

    const filtered = expenses
      .filter((e) => [
        e.description, e.category, e.payment, e.date, e.amount
      ].join(" ").toLowerCase().includes(query))
      .sort((a, b) => b.date.localeCompare(a.date));

    list.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = expenses.length
        ? "No expenses match your search."
        : "No expenses yet. Add your first expense!";
      list.appendChild(empty);
    }

    filtered.forEach((e) => {
      const item = document.createElement("article");
      item.className = "transaction-item";

      const details = document.createElement("div");
      details.className = "transaction-details";

      const title = document.createElement("strong");
      title.textContent = e.description;

      const meta = document.createElement("p");
      meta.className = "transaction-meta";
      meta.textContent = `${e.category} · ${e.date} · ${e.payment}`;

      details.append(title, meta);

      const right = document.createElement("div");
      right.className = "transaction-right";

      const amount = document.createElement("span");
      amount.className = "transaction-amount";
      amount.textContent = money(e.amount);

      const actions = document.createElement("div");
      actions.className = "transaction-buttons";

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "small-btn";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => startEdit(e.id));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small-btn delete-btn";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => removeExpense(e.id));

      actions.append(edit, remove);
      right.append(amount, actions);
      item.append(details, right);
      list.appendChild(item);
    });

    $("transactionSummary").textContent =
      `${filtered.length} transaction${filtered.length === 1 ? "" : "s"} shown`;
  }

  function render() {
    updateDashboard();
    updateCharts();
    renderTransactions();
  }

  function resetForm() {
    editingId = null;
    $("expenseForm").reset();
    $("date").value = todayString();
    $("formTitle").textContent = "Add a New Expense";
    $("submitExpenseBtn").textContent = "Add Expense";
    $("cancelBtn").hidden = true;
    showMessage("");
  }

  function startEdit(id) {
    const e = expenses.find((item) => item.id === id);
    if (!e) return;

    editingId = id;
    $("amount").value = e.amount;
    $("category").value = CATEGORIES.includes(e.category) ? e.category : "Other";
    $("description").value = e.description;
    $("date").value = e.date;
    $("payment").value = e.payment;

    $("formTitle").textContent = "Edit Expense";
    $("submitExpenseBtn").textContent = "Save Changes";
    $("cancelBtn").hidden = false;

    window.openExpenseForm();
  }

  function removeExpense(id) {
    const e = expenses.find((item) => item.id === id);
    if (!e || !confirm(`Delete "${e.description}"?`)) return;

    const previous = expenses;
    expenses = expenses.filter((item) => item.id !== id);

    if (!persistExpenses()) {
      expenses = previous;
      return;
    }

    if (editingId === id) resetForm();
    render();
  }

  function makeId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function exportCSV() {
    if (!expenses.length) {
      alert("There are no expenses to export yet.");
      return;
    }

    const rows = [
      ["Date", "Description", "Category", "Payment Method", "Amount (INR)"],
      ...expenses.map((e) => [
        e.date, e.description, e.category, e.payment, e.amount.toFixed(2)
      ])
    ];

    const csv = rows
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `paisa-plan-${todayString()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function init() {
    // If any required HTML IDs are missing, report them clearly.
    const requiredIds = [
      "expenseForm", "addExpenseBtn", "amount", "category",
      "description", "date", "payment", "transactionList",
      "categoryChart", "trendChart", "budgetForm"
    ];

    const missing = requiredIds.filter((id) => !$(id));
    console.log("Missing HTML IDs:", missing);
    if (missing.length) {
      console.error("Paisa Plan is missing HTML elements:", missing);
      alert("Some HTML elements are missing. Replace index.html with the complete version.");
      return;
    }

    expenses = readExpenses();
    budget = readBudget();

    $("date").value = todayString();

    $("expenseForm").addEventListener("submit", (event) => {
      event.preventDefault();

      const amount = Number($("amount").value);
      const category = $("category").value;
      const description = $("description").value.trim();
      const date = $("date").value;
      const payment = $("payment").value;

      if (!Number.isFinite(amount) || amount <= 0) {
        showMessage("Enter an amount greater than zero.", true);
        $("amount").focus();
        return;
      }

      if (!description || !date || !payment) {
        showMessage("Please complete all fields.", true);
        return;
      }

      const previous = expenses.slice();

      const expense = {
        id: editingId || makeId(),
        amount,
        category,
        description,
        date,
        payment
      };

      if (editingId) {
        expenses = expenses.map((e) => e.id === editingId ? expense : e);
      } else {
        expenses.push(expense);
      }

      if (!persistExpenses()) {
        expenses = previous;
        return;
      }

      resetForm();
      render();
      showMessage("Expense saved successfully!");
    });

    $("cancelBtn").addEventListener("click", resetForm);

    $("budgetForm").addEventListener("submit", (event) => {
      event.preventDefault();

      const nextBudget = Number($("budgetInput").value);

      if (!Number.isFinite(nextBudget) || nextBudget <= 0) {
        alert("Enter a valid budget greater than zero.");
        return;
      }

      const previous = budget;
      budget = nextBudget;

      if (!persistBudget()) {
        budget = previous;
        return;
      }

      $("budgetInput").value = "";
      render();
    });

    $("searchInput").addEventListener("input", renderTransactions);
    $("exportBtn").addEventListener("click", exportCSV);

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach((item) =>
          item.classList.remove("active")
        );
        link.classList.add("active");
      });
    });

    render();
    console.log("Paisa Plan loaded successfully.");
  }

  // Wait until the HTML is ready before connecting event handlers.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

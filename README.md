# Paisa Plan — Smart Personal Expense Tracker (Classy & Animated Edition)

## 📌 Project Overview
**Paisa Plan** empowers users to record daily personal expenditures, understand their spending patterns, manage monthly budgets, track savings goals, audit recurring subscriptions, and make smarter financial decisions.

The **Classy & Animated Edition (v2.0)** brings an executive fintech visual experience — featuring fluid number counter animations, an ambient aurora backdrop, an interactive 3D virtual platinum card, a live financial health score algorithm, and zero-dependency synthesized audio feedback.

---


## 📊 Comprehensive Feature Suite

### 1. 📊 Executive Financial Dashboard
- **4 Key Metric Cards**:
  - Total spending this month with roll-up counter.
  - Spending today with active daily transaction audit.
  - Monthly budget limit with 1-click edit shortcut.
  - Remaining budget with color-coded safe, warning, and danger indicators.
- **Dynamic Budget Alert Banner**:
  - Automatically triggers caution at **80%** and crimson alert when spending **exceeds 100%**.
- **Interactive Visualizations**:
  - Category-wise Spending Doughnut Chart (Chart.js with pure-CSS/SVG offline fallback).
  - 6-Month Historical Spending Trend Bar Chart (Chart.js with pure-CSS/SVG offline fallback).
- **Recent Transactions & Smart Advice**:
  - 5 latest entries with category icons and rule-based pacing suggestions.

### 2. 💸 Complete Expense Management (CRUD)
- Quick amount chips (`+₹50`, `+₹100`, `+₹500`, `+₹1000`).
- Categories: *Food, Transport, Education, Shopping, Subscriptions, Other*.
- Payment Methods: *UPI, Card, Cash, Net Banking*.
- Full editing and safe deletion protected by modal dialogs.

### 3. 🔍 Instant Search & Quick Period Filters
- Real-time text search across descriptions, categories, payment modes, and amounts.
- Quick period filter pills: **All Time**, **Today**, **This Week**, **This Month**, **Last Month**.
- Sorting by Date (newest/oldest) or Amount (highest/lowest).

### 4. 🎯 Savings Goals Milestone Tracker
- Create dedicated savings targets (*Emergency Fund, Laptop Upgrade, Vacation*).
- Deposit funds with quick chips (`+500`, `+1000`, `+2000`, `+5000`).
- Interactive progress bar with milestone confetti celebrations when goals hit 100%!

### 5. 🔄 Recurring Bills & Subscriptions
- Track fixed monthly commitments (Netflix, WiFi, Rent, Gym).
- 1-click **Paid / Due** toggle and **+ Log Today** shortcut that logs the bill as an expense automatically.

### 6. 🧠 Rule-Based Financial Insights
- Top spend area, largest single purchase, payment preference, and month-over-month comparisons.

### 7. 💾 Full Data Portability & Privacy
- **100% Client-Side Privacy**: Stored in `window.localStorage`.
- **CSV Export** for Microsoft Excel & Google Sheets.
- **Full JSON Backup & Restore** across machines.
- **Printable / PDF Monthly Statement** with an executive summary.

### 8. 🎨 Themes & Hotkeys
- **Dual Visual Themes**: 🌙 Dark Navy & Mint / ☀️ Executive Light.
- **Multi-Currency**: `₹ INR`, `$ USD`, `€ EUR`, `£ GBP`, `د.إ AED`, `C$ CAD`.
- **Hotkeys**: `N` (new), `/` (search), `1`-`4` (views), `M` (theme), `P` (print), `?` (help).

---

## 🛠️ Technology Stack
| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Markup** | HTML5 | Semantic structure (`<header>`, `<aside>`, `<main>`, `<dialog>`, `<canvas>`, `<svg>`) |
| **Styling** | CSS3 | Custom fintech design system, 3D transforms, glassmorphism, Aurora animations |
| **Typography**| Google Fonts | *Outfit*, *Plus Jakarta Sans*, *Space Grotesk* |
| **Logic** | Vanilla JavaScript (ES6+) | Reactive state machine, number counter tweening, Web Audio synthesizer |
| **Charts** | Chart.js 4.x + Fallback | Animated doughnut & bar charts with pure-CSS/SVG offline support |
| **Storage** | Web Storage API | `window.localStorage` |

---


## 🎓 College Viva / Project Presentation Highlights
1. **Executive Aesthetics & Motion Design**: 3D virtual platinum card, aurora background, and number roll-up animations demonstrate cutting-edge frontend capabilities.
2. **Algorithmic Financial Scoring**: The Paisa Score dynamically calculates financial health based on runway, utilization, and discipline.
3. **Synthesized Audio Architecture**: Uses browser native `AudioContext` without external MP3 files for zero-latency haptic feedback.
4. **Resilient Visualizations**: Offline SVG/CSS fallback ensures the app never shows blank charts if internet access is restricted.
5. **Zero Server / Zero Cost**: 100% privacy, infinite scalability, and zero monthly server bills.





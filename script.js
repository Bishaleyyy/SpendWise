// ===== 1. Setup: data and DOM elements =====
const STORAGE_KEY = "spendwise.transactions";

// Categories allowed for each transaction type
const CATEGORIES = {
  expense: ["Food", "Transportation", "Shopping", "Bills", "Entertainment", "Education", "Health", "Other"],
  income: ["Salary", "Freelance", "Other"]
};

// Grab elements once, reuse them everywhere
const form = document.getElementById("transaction-form");
const titleInput = document.getElementById("title");
const amountInput = document.getElementById("amount");
const typeSelect = document.getElementById("type");
const categorySelect = document.getElementById("category");
const dateInput = document.getElementById("date");
const formMessage = document.getElementById("form-message");

const listEl = document.getElementById("transaction-list");
const emptyState = document.getElementById("empty-state");

// The single source of truth: an array of transaction objects, e.g.
// { id: 1700000000000, title: "Salary", amount: 50000, type: "income", category: "Salary", date: "2026-10-25" }
let transactions = loadTransactions();

// ===== 2. Storage (localStorage only stores text, so we convert) =====
function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);          // text -> array
    if (!Array.isArray(parsed)) return [];
    // Keep only items that look valid
    return parsed.filter(function (t) {
      return t && typeof t.title === "string" && typeof t.amount === "number" &&
             (t.type === "income" || t.type === "expense");
    });
  } catch (error) {
    return [];                                  // corrupted data -> start fresh
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); // array -> text
}

// ===== 3. Formatting helpers =====
function formatCurrency(number) {
  return "Rs. " + number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateString) {
  // "2026-10-25" -> 25 Oct 2026 (built manually to avoid timezone shifts)
  const parts = dateString.split("-");
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getTodayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

// ===== 4. Summary (uses reduce to add things up) =====
function calculateSummary() {
  const income = transactions
    .filter(function (t) { return t.type === "income"; })
    .reduce(function (sum, t) { return sum + t.amount; }, 0);

  const expenses = transactions
    .filter(function (t) { return t.type === "expense"; })
    .reduce(function (sum, t) { return sum + t.amount; }, 0);

  return { income: income, expenses: expenses, balance: income - expenses, count: transactions.length };
}

function renderSummary() {
  const summary = calculateSummary();
  document.getElementById("summary-balance").textContent = formatCurrency(summary.balance);
  document.getElementById("summary-income").textContent = formatCurrency(summary.income);
  document.getElementById("summary-expenses").textContent = formatCurrency(summary.expenses);
  document.getElementById("summary-count").textContent = summary.count;
}

// ===== 5. Sorting (newest first) =====
function getSortedTransactions() {
  // slice() makes a copy so sorting never changes the stored array
  return transactions.slice().sort(function (a, b) {
    // Newest date first; if same date, newest added first
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.id - a.id;
  });
}

// ===== 6. Rendering (safe: textContent, never innerHTML) =====
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createTransactionItem(t) {
  const isIncome = t.type === "income";

  const item = createElement("li", "transaction");
  const badge = createElement("span", "badge " + (isIncome ? "badge-income" : "badge-expense"), isIncome ? "+" : "−");
  badge.setAttribute("aria-hidden", "true");

  const info = createElement("div", "transaction-info");
  info.appendChild(createElement("p", "transaction-title", t.title));
  info.appendChild(createElement("p", "transaction-meta", t.category + " · " + formatDate(t.date)));

  const sign = isIncome ? "+ " : "− ";
  const amount = createElement(
    "span",
    "transaction-amount " + (isIncome ? "text-income" : "text-expense"),
    sign + formatCurrency(t.amount)
  );

  const deleteButton = createElement("button", "btn btn-delete", "Delete");
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", "Delete " + t.title);
  deleteButton.addEventListener("click", function () { deleteTransaction(t.id); });

  item.append(badge, info, amount, deleteButton);
  return item;
}

function renderTransactions() {
  const sorted = getSortedTransactions();
  listEl.innerHTML = "";   // clearing with a fixed empty string is safe

  sorted.forEach(function (t) { listEl.appendChild(createTransactionItem(t)); });

  // Show the empty state only when there is nothing to display
  emptyState.hidden = sorted.length > 0;
}

function render() {
  renderSummary();
  renderTransactions();
}

// ===== 7. Category dropdown =====
function fillCategoryOptions() {
  categorySelect.innerHTML = "";
  CATEGORIES[typeSelect.value].forEach(function (name) {
    categorySelect.appendChild(new Option(name, name));
  });
}

// ===== 8. Validation =====
function showError(input, message) {
  document.getElementById(input.id + "-error").textContent = message;
  input.classList.toggle("invalid", message !== "");
}

function clearErrors() {
  [titleInput, amountInput, categorySelect, dateInput].forEach(function (input) {
    showError(input, "");
  });
}

function validateForm() {
  clearErrors();
  let valid = true;

  // Description: required, max 60 characters
  const title = titleInput.value.trim();
  if (title === "") {
    showError(titleInput, "Please enter a description.");
    valid = false;
  } else if (title.length > 60) {
    showError(titleInput, "Description must be 60 characters or fewer.");
    valid = false;
  }

  // Amount: required, must be a real number greater than zero
  const amount = parseFloat(amountInput.value);
  if (amountInput.value === "" || isNaN(amount) || !isFinite(amount)) {
    showError(amountInput, "Please enter a valid amount, like 1500 or 99.50.");
    valid = false;
  } else if (amount <= 0) {
    showError(amountInput, "Amount must be greater than zero.");
    valid = false;
  }

  // Category: must be one of the categories allowed for the chosen type
  if (!CATEGORIES[typeSelect.value].includes(categorySelect.value)) {
    showError(categorySelect, "Please choose a category.");
    valid = false;
  }

  // Date: required and must be a real date
  if (dateInput.value === "" || isNaN(new Date(dateInput.value).getTime())) {
    showError(dateInput, "Please choose a valid date.");
    valid = false;
  }

  return valid;
}

// ===== 9. Add and delete =====
function addTransaction(event) {
  event.preventDefault();                 // stop the page from reloading
  if (!validateForm()) return;            // stop if invalid

  const newTransaction = {
    id: Date.now(),                       // unique enough for this project
    title: titleInput.value.trim(),
    amount: Math.round(parseFloat(amountInput.value) * 100) / 100,
    type: typeSelect.value,
    category: categorySelect.value,
    date: dateInput.value
  };

  transactions.push(newTransaction);
  saveTransactions();
  render();

  // Reset the form but keep sensible defaults
  titleInput.value = "";
  amountInput.value = "";
  dateInput.value = getTodayString();
  titleInput.focus();
  showSuccess("Transaction added.");
}

function deleteTransaction(id) {
  if (!confirm("Delete this transaction? This cannot be undone.")) return;

  transactions = transactions.filter(function (t) { return t.id !== id; }); // keep everything except this one
  saveTransactions();
  render();
}

let messageTimer;
function showSuccess(message) {
  formMessage.textContent = message;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(function () { formMessage.textContent = ""; }, 3000);
}

// ===== 10. Event listeners =====
form.addEventListener("submit", addTransaction);
typeSelect.addEventListener("change", fillCategoryOptions);

// Clear an error as soon as the user starts fixing that field
[titleInput, amountInput, categorySelect, dateInput].forEach(function (input) {
  input.addEventListener("input", function () { showError(input, ""); });
});

document.getElementById("add-shortcut").addEventListener("click", function () {
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  titleInput.focus();
});

// ===== 11. Start the app =====
fillCategoryOptions();
dateInput.value = getTodayString();
render();
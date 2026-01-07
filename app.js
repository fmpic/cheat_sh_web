/**
 * Cheat.sh Web Interface
 * Material Design 3 Implementation
 */

// Config
const CONFIG = {
  API_ENDPOINT: "/api/cheat",
  MAX_HISTORY: 10,
  STORAGE_KEY_HISTORY: "cheatsh_history_md3",
  STORAGE_KEY_THEME: "cheatsh_theme_md3",
  STORAGE_KEY_COMMANDS: "cheatsh_commands",
  STORAGE_KEY_COMMANDS_TS: "cheatsh_commands_ts",
  CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// DOM Elements
const $ = (id) => document.getElementById(id);
const elements = {
  searchInput: $("searchInput"),
  clearBtn: $("clearBtn"),
  themeToggle: $("themeToggle"),
  resultsTitle: $("resultsTitle"),
  resultsContent: $("resultsContent"),
  resultsSection: $("resultsSection"),
  loading: $("loading"),
  errorMessage: $("errorMessage"),
  errorText: $("errorText"),
  copyBtn: $("copyBtn"),
  historySection: $("historySection"),
  historyList: $("historyList"),
  clearHistoryBtn: $("clearHistoryBtn"),
  commandList: $("commandList"),
};

// State
let searchHistory = [];
let currentResult = "";

// Theme Management
function initTheme() {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEY_THEME);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(saved || (prefersDark ? "dark" : "light"));
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(CONFIG.STORAGE_KEY_THEME, theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
}

function updateThemeIcon(theme) {
  const icon = elements.themeToggle.querySelector(".material-symbols-rounded");
  icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
}

// History Management
function loadHistory() {
  try {
    searchHistory =
      JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY_HISTORY)) || [];
  } catch {
    searchHistory = [];
  }
  renderHistory();
}

function saveHistory() {
  localStorage.setItem(
    CONFIG.STORAGE_KEY_HISTORY,
    JSON.stringify(searchHistory)
  );
}

function addToHistory(query) {
  searchHistory = searchHistory.filter((x) => x !== query);
  searchHistory.unshift(query);
  if (searchHistory.length > CONFIG.MAX_HISTORY) {
    searchHistory = searchHistory.slice(0, CONFIG.MAX_HISTORY);
  }
  saveHistory();
  renderHistory();
}

function clearHistory() {
  searchHistory = [];
  saveHistory();
  renderHistory();
}

function renderHistory() {
  if (!searchHistory.length) {
    elements.historySection.hidden = true;
    return;
  }
  elements.historySection.hidden = false;
  elements.historyList.innerHTML = searchHistory
    .map(
      (q) =>
        `<button class="chip" data-query="${escapeHtml(q)}">${escapeHtml(
          q
        )}</button>`
    )
    .join("");

  // Re-attach events
  elements.historyList.querySelectorAll(".chip").forEach((el) => {
    el.addEventListener("click", () => {
      setSearch(el.dataset.query);
      performSearch(el.dataset.query);
    });
  });
}

// Search Functionality
async function performSearch(query) {
  query = query?.trim();
  if (!query) return;

  setSearch(query);

  // UI State: Loading
  elements.resultsSection.hidden = false;
  elements.loading.hidden = false;
  elements.errorMessage.hidden = true;
  elements.resultsContent.hidden = true; // Use hidden attribute, make sure to add [hidden] {display:none} in css if not there default
  elements.resultsContent.style.display = "none"; // Explicitly hide to be safe or rely on hidden

  // Scroll to results
  elements.resultsSection.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  try {
    const url = `${CONFIG.API_ENDPOINT}?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (!text.trim()) throw new Error("No results found");

    currentResult = text;
    showResults(query, text);
    addToHistory(query);
  } catch (err) {
    showError(err.message || "Search failed");
  }
}

function showResults(query, content) {
  elements.loading.hidden = true;
  elements.errorMessage.hidden = true;
  elements.resultsContent.hidden = false;
  elements.resultsContent.style.display = "block";
  elements.resultsTitle.textContent = query;

  const ansi = new AnsiUp();
  ansi.use_classes = true;
  elements.resultsContent.innerHTML = ansi.ansi_to_html(content);
}

function showError(msg) {
  elements.loading.hidden = true;
  elements.errorMessage.hidden = false;
  elements.resultsContent.hidden = true;
  elements.errorText.textContent = msg;
}

function setSearch(query) {
  elements.searchInput.value = query;
  elements.clearBtn.hidden = !query;
}

// Copy
async function copyResults() {
  if (!currentResult) return;

  try {
    // Strip ANSI codes for clean copy
    // Regex from: https://stackoverflow.com/a/29497680
    const cleanText = currentResult.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ""
    );
    await navigator.clipboard.writeText(cleanText);

    // Feedback
    const btn = elements.copyBtn;
    const originalContent = btn.innerHTML;

    btn.classList.add("copied");
    btn.innerHTML =
      '<span class="material-symbols-rounded">check</span><span>Copied</span>';

    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = originalContent;
    }, 2000);
  } catch (e) {
    console.error(e);
  }
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

// Autocomplete
let allCommands = []; // Store commands in memory
const MAX_SUGGESTIONS = 50; // Cap specific suggestions

async function loadCommands() {
  const ts = localStorage.getItem(CONFIG.STORAGE_KEY_COMMANDS_TS);
  const cached = localStorage.getItem(CONFIG.STORAGE_KEY_COMMANDS);
  const now = Date.now();

  if (cached && ts && now - parseInt(ts) < CONFIG.CACHE_DURATION) {
    allCommands = JSON.parse(cached);
    return;
  }

  try {
    const url = `${CONFIG.API_ENDPOINT}?q=:list`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch commands");

    const text = await res.text();
    allCommands = text.split("\n").filter((c) => c.trim().length > 0);

    localStorage.setItem(
      CONFIG.STORAGE_KEY_COMMANDS,
      JSON.stringify(allCommands)
    );
    localStorage.setItem(CONFIG.STORAGE_KEY_COMMANDS_TS, now.toString());
  } catch (e) {
    console.warn("Autocomplete load failed:", e);
  }
}

function updateAutocomplete(query) {
  const dropdown = $("autocompleteDropdown");
  if (!query || !allCommands.length) {
    dropdown.hidden = true;
    return;
  }

  const normalizedQuery = query.toLowerCase();

  // Advanced filtering and sorting
  const matches = allCommands
    .filter((cmd) => cmd.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      const lowerA = a.toLowerCase();
      const lowerB = b.toLowerCase();

      // 1. Exact match
      if (lowerA === normalizedQuery && lowerB !== normalizedQuery) return -1;
      if (lowerB === normalizedQuery && lowerA !== normalizedQuery) return 1;

      // 2. Starts with query
      const startA = lowerA.startsWith(normalizedQuery);
      const startB = lowerB.startsWith(normalizedQuery);
      if (startA && !startB) return -1;
      if (startB && !startA) return 1;

      // 3. Shortest length (closer match)
      if (a.length !== b.length) return a.length - b.length;

      // 4. Alphabetical
      return a.localeCompare(b);
    })
    .slice(0, MAX_SUGGESTIONS);

  if (!matches.length) {
    dropdown.hidden = true;
    return;
  }

  dropdown.innerHTML = matches
    .map((cmd) => {
      // Simple highlighting
      const index = cmd.toLowerCase().indexOf(normalizedQuery);
      if (index === -1)
        return `<button class="autocomplete-item" data-val="${cmd}">${escapeHtml(
          cmd
        )}</button>`;

      const before = escapeHtml(cmd.substring(0, index));
      const match = escapeHtml(
        cmd.substring(index, index + normalizedQuery.length)
      );
      const after = escapeHtml(cmd.substring(index + normalizedQuery.length));

      return `<button class="autocomplete-item" data-val="${cmd}">${before}<strong>${match}</strong>${after}</button>`;
    })
    .join("");

  dropdown.hidden = false;

  // Click events
  const items = dropdown.querySelectorAll(".autocomplete-item");
  items.forEach((item) => {
    item.addEventListener("click", () => {
      selectSuggestion(item.dataset.val);
    });
  });

  // Auto-select first item
  selectedIndex = 0;
  updateSelection(items);
}

function selectSuggestion(val) {
  setSearch(val);
  $("autocompleteDropdown").hidden = true;
  performSearch(val);
}

// Navigation state
let selectedIndex = -1;

function handleAutocompleteKey(e) {
  const dropdown = $("autocompleteDropdown");
  if (dropdown.hidden) return;

  const items = dropdown.querySelectorAll(".autocomplete-item");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedIndex++;
    if (selectedIndex >= items.length) selectedIndex = 0;
    updateSelection(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedIndex--;
    if (selectedIndex < 0) selectedIndex = items.length - 1;
    updateSelection(items);
  } else if (e.key === "Enter" && selectedIndex > -1) {
    e.preventDefault();
    items[selectedIndex].click();
  } else if (e.key === "Escape") {
    dropdown.hidden = true;
    selectedIndex = -1;
  }
}

function updateSelection(items) {
  items.forEach((item, idx) => {
    if (idx === selectedIndex) {
      item.classList.add("selected");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("selected");
    }
  });
}

// Initialization and Events
function init() {
  initTheme();
  loadHistory();
  loadCommands(); // Start background load of commands

  // Search Input Events
  elements.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && selectedIndex === -1) {
      performSearch(elements.searchInput.value);
      $("autocompleteDropdown").hidden = true;
    } else {
      handleAutocompleteKey(e);
    }
  });

  elements.searchInput.addEventListener("input", (e) => {
    const val = e.target.value;
    elements.clearBtn.hidden = !val;
    updateAutocomplete(val);
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-field")) {
      $("autocompleteDropdown").hidden = true;
    }
  });

  elements.clearBtn.addEventListener("click", () => {
    setSearch("");
    elements.searchInput.focus();
    $("autocompleteDropdown").hidden = true;
  });

  // Other events
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.copyBtn.addEventListener("click", copyResults);
  elements.clearHistoryBtn.addEventListener("click", clearHistory);

  // Quick Chips
  document
    .querySelectorAll(".search-card > .chips-row .chip")
    .forEach((chip) => {
      chip.addEventListener("click", () => {
        setSearch(chip.dataset.query);
        performSearch(chip.dataset.query);
      });
    });

  // Back to Top Logic
  const backToTopBtn = $("backToTopBtn");

  if (backToTopBtn) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 300) {
        backToTopBtn.hidden = false;
        backToTopBtn.style.display = "flex"; // Explicit override since [hidden] is strict
      } else {
        backToTopBtn.hidden = true;
      }
    });

    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Focus shortcut
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== elements.searchInput) {
      e.preventDefault();
      elements.searchInput.focus();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

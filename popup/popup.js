const mainView = document.getElementById("mainView");
const settingsView = document.getElementById("settingsView");
const helpView = document.getElementById("helpView");
const queryInput = document.getElementById("queryInput");
const tabsList = document.getElementById("tabsList");
const statusText = document.getElementById("statusText");
const openSettingsButton = document.getElementById("openSettingsButton");
const backButton = document.getElementById("backButton");
const shortcutInput = document.getElementById("shortcutInput");
const saveShortcutButton = document.getElementById("saveShortcutButton");
const openFirefoxShortcutsButton = document.getElementById("openFirefoxShortcutsButton");
const settingsStatusText = document.getElementById("settingsStatusText");
const themeList = document.getElementById("themeList");
const themeNameInput = document.getElementById("themeNameInput");
const themeJsonInput = document.getElementById("themeJsonInput");
const addThemeButton = document.getElementById("addThemeButton");

const browserApi = globalThis.browser ?? globalThis.chrome;
const COMMAND_NAME = "_execute_browser_action";

const hasPromiseTabsQuery = Boolean(globalThis.browser?.tabs?.query);
const hasPromiseTabsUpdate = Boolean(globalThis.browser?.tabs?.update);
const hasPromiseWindowsUpdate = Boolean(globalThis.browser?.windows?.update);
const hasPromiseCommandsGetAll = Boolean(globalThis.browser?.commands?.getAll);
const hasPromiseCommandsUpdate = Boolean(globalThis.browser?.commands?.update);
const hasPromiseTabsCreate = Boolean(globalThis.browser?.tabs?.create);

const STORAGE_CUSTOM_THEMES = "tabfzf.customThemes.v1";
const STORAGE_SELECTED_THEME = "tabfzf.selectedThemeId.v1";

const DEFAULT_THEME_COLORS = {
  bg: "#0a0f14",
  panel: "#111921",
  text: "#d7e3ee",
  muted: "#8b9aaa",
  border: "#283847",
  focus: "#8eb7ff",
  active: "#1d2a36",
  rowBorder: "rgba(40, 56, 71, 0.65)",
  title: "#aeb9c5",
  fontBody: '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
};

const DEFAULT_THEMES = [
  {
    id: "midnight-fzf",
    name: "Midnight FZF",
    source: "default",
    colors: { ...DEFAULT_THEME_COLORS },
  },
  {
    id: "win98-foot-light",
    name: "Windows 98 Foot Light",
    source: "default",
    colors: {
      bg: "#f3f1ee",
      panel: "#ffffff",
      text: "#202124",
      muted: "#6f6963",
      border: "#8c867f",
      focus: "#6e8eb3",
      active: "#e2e6ed",
      rowBorder: "#b3a56e",
      title: "#3a3a3a",
      fontBody: 'Tahoma, "MS Sans Serif", Arial, sans-serif',
    },
  },
];

let customThemes = [];
let selectedThemeId = DEFAULT_THEMES[0].id;

let allTabs = [];
let filteredTabs = [];
let selectedIndex = 0;
let focusRetryTimer = null;
let currentActiveTabId = null;

function getStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function setStorageValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_error) {
    // Ignore storage failures in restricted contexts.
  }
}

function normalizeHexColor(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.toLowerCase()}`;
  }

  return null;
}

function normalizeThemeColors(rawColors, fallbackColors) {
  const fallback = fallbackColors || DEFAULT_THEME_COLORS;
  const next = { ...fallback };

  const colorKeys = ["bg", "panel", "text", "muted", "border", "focus", "active", "title"];
  for (const key of colorKeys) {
    const normalized = normalizeHexColor(rawColors?.[key]);
    if (normalized) {
      next[key] = normalized;
    }
  }

  const rowBorderCandidate = rawColors?.rowBorder;
  if (typeof rowBorderCandidate === "string" && rowBorderCandidate.trim()) {
    next.rowBorder = rowBorderCandidate.trim();
  }

  const fontBodyCandidate = rawColors?.fontBody;
  if (typeof fontBodyCandidate === "string" && fontBodyCandidate.trim()) {
    next.fontBody = fontBodyCandidate.trim();
  }

  return next;
}

function getAllThemes() {
  return [...DEFAULT_THEMES, ...customThemes];
}

function findThemeById(themeId) {
  return getAllThemes().find((theme) => theme.id === themeId) || null;
}

function isLightColor(hexColor) {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) {
    return false;
  }

  const value = normalized.slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58;
}

function applyTheme(theme) {
  const root = document.documentElement;
  const colors = normalizeThemeColors(theme?.colors, DEFAULT_THEME_COLORS);
  root.dataset.themeId = theme?.id || "";

  root.style.setProperty("--bg", colors.bg);
  root.style.setProperty("--panel", colors.panel);
  root.style.setProperty("--text", colors.text);
  root.style.setProperty("--muted", colors.muted);
  root.style.setProperty("--border", colors.border);
  root.style.setProperty("--focus", colors.focus);
  root.style.setProperty("--active", colors.active);
  root.style.setProperty("--row-border", colors.rowBorder);
  root.style.setProperty("--title", colors.title);
  root.style.setProperty("--font-body", colors.fontBody);

  const colorScheme = isLightColor(colors.bg) ? "light" : "dark";
  root.style.setProperty("color-scheme", colorScheme);
}

function saveCustomThemes() {
  setStorageValue(STORAGE_CUSTOM_THEMES, JSON.stringify(customThemes));
}

function loadCustomThemes() {
  const raw = getStorageValue(STORAGE_CUSTOM_THEMES);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const loaded = [];
    for (let i = 0; i < parsed.length; i += 1) {
      const item = parsed[i];
      if (!item || typeof item !== "object") {
        continue;
      }

      const idValue = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `custom-${Date.now()}-${i}`;
      const nameValue = typeof item.name === "string" && item.name.trim() ? item.name.trim() : `Custom Theme ${i + 1}`;
      const colors = normalizeThemeColors(item.colors, DEFAULT_THEME_COLORS);

      loaded.push({
        id: idValue,
        name: nameValue,
        source: "custom",
        colors,
      });
    }

    return loaded;
  } catch (_error) {
    return [];
  }
}

function loadSelectedThemeId() {
  const raw = getStorageValue(STORAGE_SELECTED_THEME);
  if (!raw || typeof raw !== "string") {
    return DEFAULT_THEMES[0].id;
  }

  const trimmed = raw.trim();
  return trimmed || DEFAULT_THEMES[0].id;
}

function setActiveTheme(themeId, options = {}) {
  const persist = options.persist !== false;
  const theme = findThemeById(themeId) || DEFAULT_THEMES[0];
  selectedThemeId = theme.id;
  applyTheme(theme);

  if (persist) {
    setStorageValue(STORAGE_SELECTED_THEME, selectedThemeId);
  }

  renderThemeList();
}

function renderThemeList() {
  if (!themeList) {
    return;
  }

  const themes = getAllThemes();
  themeList.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < themes.length; i += 1) {
    const theme = themes[i];

    const item = document.createElement("li");
    item.className = `theme-item${theme.id === selectedThemeId ? " active" : ""}`;

    const meta = document.createElement("div");
    meta.className = "theme-meta";

    const name = document.createElement("span");
    name.className = "theme-name";
    name.textContent = theme.name;

    const type = document.createElement("span");
    type.className = "theme-type";
    type.textContent = theme.source;

    meta.appendChild(name);
    meta.appendChild(type);

    const actions = document.createElement("div");
    actions.className = "theme-actions";

    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "small-button";
    applyButton.textContent = theme.id === selectedThemeId ? "Active" : "Apply";
    applyButton.dataset.action = "apply-theme";
    applyButton.dataset.themeId = theme.id;

    actions.appendChild(applyButton);

    if (theme.source === "custom") {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "small-button danger";
      deleteButton.textContent = "Delete";
      deleteButton.dataset.action = "delete-theme";
      deleteButton.dataset.themeId = theme.id;
      actions.appendChild(deleteButton);
    }

    item.appendChild(meta);
    item.appendChild(actions);
    fragment.appendChild(item);
  }

  themeList.appendChild(fragment);
}

function deleteCustomTheme(themeId) {
  const target = customThemes.find((theme) => theme.id === themeId);
  if (!target) {
    settingsStatusText.textContent = "Custom theme not found.";
    return;
  }

  customThemes = customThemes.filter((theme) => theme.id !== themeId);
  saveCustomThemes();

  if (selectedThemeId === themeId) {
    setActiveTheme(DEFAULT_THEMES[0].id);
  } else {
    renderThemeList();
  }

  settingsStatusText.textContent = `Deleted theme: ${target.name}`;
}

function addCustomTheme() {
  const name = (themeNameInput.value || "").trim() || `Custom Theme ${customThemes.length + 1}`;
  const sourceText = (themeJsonInput.value || "").trim();

  if (!sourceText) {
    settingsStatusText.textContent = "Enter a JSON object with theme keys.";
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(sourceText);
  } catch (_error) {
    settingsStatusText.textContent = "Theme JSON is invalid.";
    return;
  }

  const rawColors = parsed && typeof parsed === "object" && parsed.colors && typeof parsed.colors === "object"
    ? parsed.colors
    : parsed;

  if (!rawColors || typeof rawColors !== "object" || Array.isArray(rawColors)) {
    settingsStatusText.textContent = "Theme JSON must be an object.";
    return;
  }

  const keys = ["bg", "panel", "text", "muted", "border", "focus", "active", "rowBorder", "title", "fontBody"];
  const hasSupportedKey = keys.some((key) => rawColors[key] !== undefined);
  if (!hasSupportedKey) {
    settingsStatusText.textContent = "No supported theme keys found in JSON.";
    return;
  }

  const id = `custom-${Date.now()}`;
  const colors = normalizeThemeColors(rawColors, DEFAULT_THEME_COLORS);

  customThemes.push({
    id,
    name,
    source: "custom",
    colors,
  });

  saveCustomThemes();
  themeNameInput.value = "";
  themeJsonInput.value = "";
  setActiveTheme(id);
  settingsStatusText.textContent = `Added and applied theme: ${name}`;
}

function initializeThemes() {
  customThemes = loadCustomThemes();
  const loadedThemeId = loadSelectedThemeId();
  const selectedTheme = findThemeById(loadedThemeId) || DEFAULT_THEMES[0];
  selectedThemeId = selectedTheme.id;
  applyTheme(selectedTheme);
}

function focusSearchInput() {
  if (!mainView || mainView.classList.contains("hidden")) {
    return;
  }

  queryInput.focus();
  queryInput.select();

  // Some Firefox/WM combinations steal focus right after popup mount.
  requestAnimationFrame(() => {
    queryInput.focus();
    queryInput.select();
  });

  setTimeout(() => {
    queryInput.focus();
    queryInput.select();
  }, 0);
}

function scheduleFocusRetries() {
  if (focusRetryTimer) {
    clearInterval(focusRetryTimer);
  }

  let attempts = 0;
  focusRetryTimer = setInterval(() => {
    attempts += 1;

    if (document.activeElement !== queryInput) {
      focusSearchInput();
    }

    if (attempts >= 15 || document.activeElement === queryInput) {
      clearInterval(focusRetryTimer);
      focusRetryTimer = null;
    }
  }, 30);
}

function getDisplayTitle(tab) {
  const title = tab.title && tab.title.trim();
  return title || "(untitled)";
}

function getTabDomain(tab) {
  const url = tab.url || "";
  if (!url) {
    return "";
  }

  try {
    return new URL(url).hostname || "";
  } catch (_error) {
    return "";
  }
}

function normalizeText(value) {
  return (value || "").toLowerCase();
}

function showMainView() {
  settingsView.classList.add("hidden");
  helpView.classList.add("hidden");
  mainView.classList.remove("hidden");
  focusSearchInput();
  scheduleFocusRetries();
}

async function showSettingsView() {
  mainView.classList.add("hidden");
  helpView.classList.add("hidden");
  settingsView.classList.remove("hidden");
  settingsStatusText.textContent = "";
  renderThemeList();
  await loadCurrentShortcut();
  shortcutInput.focus();
}

function showHelpView() {
  mainView.classList.add("hidden");
  settingsView.classList.add("hidden");
  helpView.classList.remove("hidden");
}

function toggleHelpView() {
  if (!helpView.classList.contains("hidden")) {
    showMainView();
    return;
  }
  showHelpView();
}

function getFilteredTabs(query) {
  const visibleTabs = allTabs.filter((tab) => tab.id !== currentActiveTabId);
  const q = normalizeText(query).trim();
  if (!q) {
    return visibleTabs;
  }
  return visibleTabs.filter((tab) => {
    const domain = normalizeText(getTabDomain(tab));
    const title = normalizeText(getDisplayTitle(tab));
    return domain.includes(q) || title.includes(q);
  });
}

function renderTabs() {
  tabsList.innerHTML = "";

  if (!filteredTabs.length) {
    statusText.textContent = "No tabs found.";
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < filteredTabs.length; i += 1) {
    const tab = filteredTabs[i];
    const item = document.createElement("li");
    item.className = "tab-item";
    item.dataset.index = String(i);
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", i === selectedIndex ? "true" : "false");
    if (i === selectedIndex) {
      item.classList.add("active");
    }

    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    favicon.alt = "";
    if (tab.favIconUrl) {
      favicon.src = tab.favIconUrl;
      favicon.referrerPolicy = "no-referrer";
      favicon.addEventListener("error", () => {
        favicon.classList.add("hidden");
      });
    } else {
      favicon.classList.add("hidden");
    }

    const label = document.createElement("span");
    label.className = "tab-label";

    const domain = document.createElement("span");
    domain.className = "tab-domain";
    domain.textContent = getTabDomain(tab) || "(local)";

    const separator = document.createElement("span");
    separator.className = "tab-separator";
    separator.textContent = " · ";

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = getDisplayTitle(tab);

    label.appendChild(domain);
    label.appendChild(separator);
    label.appendChild(title);
    item.appendChild(favicon);
    item.appendChild(label);
    fragment.appendChild(item);
  }

  tabsList.appendChild(fragment);
  statusText.textContent = `${filteredTabs.length} tab${filteredTabs.length === 1 ? "" : "s"}.`;
  const activeItem = tabsList.querySelector(".tab-item.active");
  if (activeItem) {
    activeItem.scrollIntoView({ block: "nearest" });
  }
}

function refreshFilteredTabs() {
  filteredTabs = getFilteredTabs(queryInput.value);
  selectedIndex = Math.max(0, Math.min(selectedIndex, filteredTabs.length - 1));
  renderTabs();
}

function moveSelection(delta) {
  if (!filteredTabs.length) {
    return;
  }
  selectedIndex = (selectedIndex + delta + filteredTabs.length) % filteredTabs.length;
  renderTabs();
}

async function queryTabs(queryInfo = {}) {
  if (!browserApi?.tabs?.query) {
    throw new Error("Tabs API is unavailable in this extension context.");
  }

  if (hasPromiseTabsQuery) {
    return browserApi.tabs.query(queryInfo);
  }

  return new Promise((resolve, reject) => {
    browserApi.tabs.query(queryInfo, (result) => {
      const runtimeError = browserApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(result || []);
    });
  });
}

async function updateTab(tabId, updateInfo) {
  if (hasPromiseTabsUpdate) {
    return browserApi.tabs.update(tabId, updateInfo);
  }
  return new Promise((resolve, reject) => {
    browserApi.tabs.update(tabId, updateInfo, (tab) => {
      const runtimeError = browserApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(tab);
    });
  });
}

async function updateWindow(windowId, updateInfo) {
  if (hasPromiseWindowsUpdate) {
    return browserApi.windows.update(windowId, updateInfo);
  }
  return new Promise((resolve, reject) => {
    browserApi.windows.update(windowId, updateInfo, (windowValue) => {
      const runtimeError = browserApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(windowValue);
    });
  });
}

async function switchToSelectedTab() {
  const selectedTab = filteredTabs[selectedIndex];
  if (!selectedTab) {
    return;
  }

  await updateTab(selectedTab.id, { active: true });
  await updateWindow(selectedTab.windowId, { focused: true });
  window.close();
}

async function getAllCommands() {
  if (!browserApi?.commands?.getAll) {
    return [];
  }

  if (hasPromiseCommandsGetAll) {
    return browserApi.commands.getAll();
  }

  return new Promise((resolve, reject) => {
    browserApi.commands.getAll((commands) => {
      const runtimeError = browserApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(commands || []);
    });
  });
}

async function updateCommandShortcut(shortcut) {
  if (!browserApi?.commands?.update) {
    throw new Error("Direct shortcut updates are not supported in this browser.");
  }

  if (hasPromiseCommandsUpdate) {
    return browserApi.commands.update({ name: COMMAND_NAME, shortcut });
  }

  return new Promise((resolve, reject) => {
    browserApi.commands.update({ name: COMMAND_NAME, shortcut }, () => {
      const runtimeError = browserApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve();
    });
  });
}

async function createTab(url) {
  if (hasPromiseTabsCreate) {
    return browserApi.tabs.create({ url });
  }
  return new Promise((resolve, reject) => {
    browserApi.tabs.create({ url }, (tab) => {
      const runtimeError = browserApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(tab);
    });
  });
}

async function loadCurrentShortcut() {
  try {
    const commands = await getAllCommands();
    const openCommand = commands.find((cmd) => cmd.name === COMMAND_NAME);
    shortcutInput.value = openCommand?.shortcut || "";
    settingsStatusText.textContent = openCommand?.shortcut
      ? "Current shortcut loaded."
      : "No shortcut set. Save one or open Firefox shortcuts.";
  } catch (error) {
    settingsStatusText.textContent = `Failed to load shortcut: ${error.message || String(error)}`;
  }
}

async function saveShortcut() {
  const shortcut = shortcutInput.value.trim();
  if (!shortcut) {
    settingsStatusText.textContent = "Enter a shortcut like Ctrl+Shift+Y.";
    return;
  }

  try {
    await updateCommandShortcut(shortcut);
    settingsStatusText.textContent = "Shortcut saved.";
  } catch (error) {
    settingsStatusText.textContent = `Cannot set shortcut here: ${error.message || String(error)}. Use Firefox shortcuts.`;
  }
}

function setSelection(start, end = start) {
  queryInput.setSelectionRange(start, end);
}

function findWordForwardIndex(value, start) {
  let index = start;
  while (index < value.length && /\s/.test(value[index])) {
    index += 1;
  }
  while (index < value.length && !/\s/.test(value[index])) {
    index += 1;
  }
  return index;
}

function findWordBackwardIndex(value, start) {
  let index = start;
  while (index > 0 && /\s/.test(value[index - 1])) {
    index -= 1;
  }
  while (index > 0 && !/\s/.test(value[index - 1])) {
    index -= 1;
  }
  return index;
}

function applyQueryValue(nextValue, nextCursor) {
  queryInput.value = nextValue;
  setSelection(nextCursor);
  selectedIndex = 0;
  refreshFilteredTabs();
}

function handleBashShortcut(event) {
  const hasCtrl = event.ctrlKey && !event.metaKey;
  const hasAlt = event.altKey && !event.ctrlKey && !event.metaKey;
  const value = queryInput.value;
  const selectionStart = queryInput.selectionStart ?? 0;
  const selectionEnd = queryInput.selectionEnd ?? selectionStart;

  if (hasCtrl && event.key.toLowerCase() === "a") {
    event.preventDefault();
    setSelection(0);
    return true;
  }

  if (hasCtrl && event.key.toLowerCase() === "e") {
    event.preventDefault();
    setSelection(value.length);
    return true;
  }

  if (hasAlt && event.key.toLowerCase() === "f") {
    event.preventDefault();
    setSelection(findWordForwardIndex(value, selectionEnd));
    return true;
  }

  if (hasAlt && event.key.toLowerCase() === "b") {
    event.preventDefault();
    setSelection(findWordBackwardIndex(value, selectionStart));
    return true;
  }

  if (hasAlt && event.key.toLowerCase() === "d") {
    event.preventDefault();
    if (selectionStart !== selectionEnd) {
      applyQueryValue(value.slice(0, selectionStart) + value.slice(selectionEnd), selectionStart);
      return true;
    }

    const deleteEnd = findWordForwardIndex(value, selectionStart);
    applyQueryValue(value.slice(0, selectionStart) + value.slice(deleteEnd), selectionStart);
    return true;
  }

  if (hasCtrl && event.key.toLowerCase() === "d") {
    event.preventDefault();
    if (selectionStart !== selectionEnd) {
      applyQueryValue(value.slice(0, selectionStart) + value.slice(selectionEnd), selectionStart);
      return true;
    }
    if (selectionStart >= value.length) {
      return true;
    }
    applyQueryValue(value.slice(0, selectionStart) + value.slice(selectionStart + 1), selectionStart);
    return true;
  }

  if (hasCtrl && event.key.toLowerCase() === "k") {
    event.preventDefault();
    applyQueryValue(value.slice(0, selectionStart), selectionStart);
    return true;
  }

  if (hasCtrl && event.key.toLowerCase() === "h") {
    event.preventDefault();
    toggleHelpView();
    return true;
  }

  return false;
}

function bindEvents() {
  queryInput.addEventListener("input", () => {
    selectedIndex = 0;
    refreshFilteredTabs();
  });

  queryInput.addEventListener("keydown", async (event) => {
    const hasCtrl = event.ctrlKey && !event.metaKey;
    const hasAlt = event.altKey && !event.ctrlKey && !event.metaKey;

    if (handleBashShortcut(event)) {
      return;
    }

    if (event.key === "ArrowDown" || (hasAlt && event.key.toLowerCase() === "n")) {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp" || (hasAlt && event.key.toLowerCase() === "p")) {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      try {
        await switchToSelectedTab();
      } catch (error) {
        statusText.textContent = `Failed to switch tab: ${error.message || String(error)}`;
      }
      return;
    }

    if (event.key === "Escape") {
      window.close();
    }
  });

  tabsList.addEventListener("click", async (event) => {
    const node = event.target instanceof Element ? event.target : null;
    const row = node ? node.closest(".tab-item") : null;
    if (!row) {
      return;
    }

    const index = Number(row.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }

    selectedIndex = index;
    renderTabs();

    try {
      await switchToSelectedTab();
    } catch (error) {
      statusText.textContent = `Failed to switch tab: ${error.message || String(error)}`;
    }
  });

  themeList.addEventListener("click", (event) => {
    const node = event.target instanceof HTMLElement ? event.target : null;
    if (!node) {
      return;
    }

    const action = node.dataset.action;
    const themeId = node.dataset.themeId;
    if (!action || !themeId) {
      return;
    }

    if (action === "apply-theme") {
      setActiveTheme(themeId);
      settingsStatusText.textContent = "Theme applied.";
      return;
    }

    if (action === "delete-theme") {
      deleteCustomTheme(themeId);
    }
  });

  addThemeButton.addEventListener("click", () => {
    addCustomTheme();
  });

  openSettingsButton.addEventListener("click", () => {
    showSettingsView().catch((error) => {
      settingsStatusText.textContent = `Failed to open settings: ${error.message || String(error)}`;
    });
  });

  backButton.addEventListener("click", showMainView);

  saveShortcutButton.addEventListener("click", () => {
    saveShortcut().catch((error) => {
      settingsStatusText.textContent = `Failed to save shortcut: ${error.message || String(error)}`;
    });
  });

  openFirefoxShortcutsButton.addEventListener("click", () => {
    createTab("about:addons").catch((error) => {
      settingsStatusText.textContent = `Failed to open Firefox shortcuts: ${error.message || String(error)}`;
    });
  });

  window.addEventListener("focus", () => {
    focusSearchInput();
    scheduleFocusRetries();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      focusSearchInput();
      scheduleFocusRetries();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) {
      return;
    }
    const hasCtrl = event.ctrlKey && !event.metaKey;
    if (hasCtrl && event.key.toLowerCase() === "h") {
      event.preventDefault();
      toggleHelpView();
    }
  });
}

async function init() {
  try {
    initializeThemes();
    allTabs = await queryTabs();
    const activeTabs = await queryTabs({ active: true, currentWindow: true });
    currentActiveTabId = activeTabs[0]?.id ?? null;
    refreshFilteredTabs();
    bindEvents();
    focusSearchInput();
    scheduleFocusRetries();
  } catch (error) {
    statusText.textContent = `Failed to read tabs: ${error.message || String(error)}`;
  }
}

init();

const mainView = document.getElementById("mainView");
const settingsView = document.getElementById("settingsView");
const queryInput = document.getElementById("queryInput");
const tabsList = document.getElementById("tabsList");
const statusText = document.getElementById("statusText");
const openSettingsButton = document.getElementById("openSettingsButton");
const backButton = document.getElementById("backButton");
const shortcutInput = document.getElementById("shortcutInput");
const saveShortcutButton = document.getElementById("saveShortcutButton");
const openFirefoxShortcutsButton = document.getElementById("openFirefoxShortcutsButton");
const settingsStatusText = document.getElementById("settingsStatusText");

const browserApi = globalThis.browser ?? globalThis.chrome;
const COMMAND_NAME = "_execute_browser_action";

const hasPromiseTabsQuery = Boolean(globalThis.browser?.tabs?.query);
const hasPromiseTabsUpdate = Boolean(globalThis.browser?.tabs?.update);
const hasPromiseWindowsUpdate = Boolean(globalThis.browser?.windows?.update);
const hasPromiseCommandsGetAll = Boolean(globalThis.browser?.commands?.getAll);
const hasPromiseCommandsUpdate = Boolean(globalThis.browser?.commands?.update);
const hasPromiseTabsCreate = Boolean(globalThis.browser?.tabs?.create);

let allTabs = [];
let filteredTabs = [];
let selectedIndex = 0;
let focusRetryTimer = null;
let currentActiveTabId = null;

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

function normalizeText(value) {
  return (value || "").toLowerCase();
}

function showMainView() {
  settingsView.classList.add("hidden");
  mainView.classList.remove("hidden");
  focusSearchInput();
  scheduleFocusRetries();
}

async function showSettingsView() {
  mainView.classList.add("hidden");
  settingsView.classList.remove("hidden");
  settingsStatusText.textContent = "";
  await loadCurrentShortcut();
  shortcutInput.focus();
}

function getFilteredTabs(query) {
  const visibleTabs = allTabs.filter((tab) => tab.id !== currentActiveTabId);
  const q = normalizeText(query).trim();
  if (!q) {
    return visibleTabs;
  }
  return visibleTabs.filter((tab) => normalizeText(getDisplayTitle(tab)).includes(q));
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

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = getDisplayTitle(tab);
    item.appendChild(title);
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

function bindEvents() {
  queryInput.addEventListener("input", () => {
    selectedIndex = 0;
    refreshFilteredTabs();
  });

  queryInput.addEventListener("keydown", async (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
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
}

async function init() {
  try {
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

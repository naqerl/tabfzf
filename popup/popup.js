const queryInput = document.getElementById("queryInput");
const tabsList = document.getElementById("tabsList");
const statusText = document.getElementById("statusText");

const browserApi = globalThis.browser ?? globalThis.chrome;
const hasPromiseTabsQuery = Boolean(globalThis.browser?.tabs?.query);
const hasPromiseTabsUpdate = Boolean(globalThis.browser?.tabs?.update);
const hasPromiseWindowsUpdate = Boolean(globalThis.browser?.windows?.update);

let allTabs = [];
let filteredTabs = [];
let selectedIndex = 0;

function getDisplayTitle(tab) {
  const title = tab.title && tab.title.trim();
  return title || "(untitled)";
}

function normalizeText(value) {
  return (value || "").toLowerCase();
}

function getFilteredTabs(query) {
  const q = normalizeText(query).trim();
  if (!q) {
    return [...allTabs];
  }

  return allTabs.filter((tab) => normalizeText(getDisplayTitle(tab)).includes(q));
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

    if (i === selectedIndex) {
      item.classList.add("active");
      item.setAttribute("aria-selected", "true");
    } else {
      item.setAttribute("aria-selected", "false");
    }

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = getDisplayTitle(tab);
    item.appendChild(title);

    fragment.appendChild(item);
  }

  tabsList.appendChild(fragment);
  statusText.textContent = `${filteredTabs.length} tab${filteredTabs.length === 1 ? "" : "s"}.`;
  scrollActiveIntoView();
}

function scrollActiveIntoView() {
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

async function updateTab(tabId, updateProperties) {
  if (hasPromiseTabsUpdate) {
    return browserApi.tabs.update(tabId, updateProperties);
  }
  return new Promise((resolve, reject) => {
    browserApi.tabs.update(tabId, updateProperties, (tab) => {
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
}

async function queryTabs() {
  if (!browserApi?.tabs?.query) {
    throw new Error("Tabs API is unavailable in this extension context.");
  }

  if (hasPromiseTabsQuery) {
    return browserApi.tabs.query({});
  }

  return new Promise((resolve, reject) => {
    browserApi.tabs.query({}, (result) => {
      const runtimeError = browserApi.runtime?.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(result || []);
    });
  });
}

async function init() {
  try {
    allTabs = await queryTabs();
    refreshFilteredTabs();
    bindEvents();
    queryInput.focus();
  } catch (error) {
    statusText.textContent = `Failed to read tabs: ${error.message || String(error)}`;
  }
}

init();

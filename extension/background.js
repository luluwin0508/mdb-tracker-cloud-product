// 点击工具栏图标 → 抓当前页 HTML → POST 到云端 /api/sync。
// 不再自动注入/自动抓取，完全由你点击触发。

// 默认云端地址；可在扩展「选项」页覆盖（选项优先）。
// xyz 域名好了之后可改回 https://mdb-fdcompliance.xyz
const DEFAULT_API_BASE = "https://roaring-gnome-273245.netlify.app";

async function getApiBase() {
  const { apiBase } = await chrome.storage.sync.get("apiBase");
  return (apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https?:/.test(tab.url || "")) {
    flashBadge("!", "#991b1b");
    return;
  }

  try {
    // 1. 在当前页抓取完整 HTML（activeTab 授权，点击时才允许）
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ url: location.href, html: document.documentElement.outerHTML }),
    });

    // 2. POST 到云端 /api/sync
    const base = await getApiBase();
    let response = null;
    let lastError = "";
    try {
      const res = await fetch(`${base}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url, html: result.html }),
      });
      response = await res.json();
      if (!response || (!response.ok && !response.key)) {
        lastError = (response && response.error) || `HTTP ${res.status}`;
      }
    } catch (error) {
      lastError = error.message;
    }

    // 3. 在页面上弹提示
    const ok = Boolean(response && response.ok);
    const message = ok
      ? `✓ 已同步 ${response.key}（${response.count} 条）`
      : `同步失败：${(response && response.error) || lastError || "未知错误"}`;
    flashBadge(ok ? "✓" : "!", ok ? "#15803d" : "#991b1b");

    // 页面提示条是锦上添花，注入失败也不影响同步本身
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: showToast,
        args: [message, !ok],
      });
    } catch (toastError) {
      console.warn("[MDB Tracker] 提示注入失败:", toastError);
    }
  } catch (error) {
    flashBadge("!", "#991b1b");
    console.warn("[MDB Tracker] 同步出错:", error);
  }
});

// 在工具栏图标上闪一个角标，给出反馈（即便页面没法注入提示条）
function flashBadge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 4000);
}

// 注入到页面里执行的提示函数（不能引用外部变量）
function showToast(message, isError) {
  const el = document.createElement("div");
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    background: isError ? "#991b1b" : "#1a1a2e",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontFamily: "sans-serif",
    boxShadow: "0 4px 12px rgba(0,0,0,.35)",
    transition: "opacity .6s",
  });
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; }, 2800);
  setTimeout(() => { el.remove(); }, 3500);
}

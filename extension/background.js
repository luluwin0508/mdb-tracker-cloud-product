// 点击工具栏图标 → 抓当前页 HTML → POST 到云端 /api/sync。
// 不再自动注入/自动抓取，完全由你点击触发。

// 部署后把下面改成你的 Netlify 域名，或在扩展「选项」页里填（选项优先）。
const DEFAULT_API_BASE = "https://YOUR-SITE.netlify.app";
const LOCAL_FALLBACK = "http://localhost:5051";

async function getApiBases() {
  const { apiBase } = await chrome.storage.sync.get("apiBase");
  const primary = (apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
  const bases = [primary];
  if (!bases.includes(LOCAL_FALLBACK)) bases.push(LOCAL_FALLBACK);
  return bases;
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

    // 2. POST 到云端 /api/sync，主地址失败再回退本地
    const bases = await getApiBases();
    let response = null;
    let lastError = "";
    for (const base of bases) {
      try {
        const res = await fetch(`${base}/api/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.url, html: result.html }),
        });
        const data = await res.json();
        if (data && (data.ok || data.key)) {
          response = data;
          break;
        }
        lastError = (data && data.error) || `HTTP ${res.status}`;
      } catch (error) {
        lastError = error.message;
      }
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

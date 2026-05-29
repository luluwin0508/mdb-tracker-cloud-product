const input = document.getElementById("apiBase");
const status = document.getElementById("status");

chrome.storage.sync.get("apiBase", ({ apiBase }) => {
  if (apiBase) input.value = apiBase;
});

document.getElementById("save").addEventListener("click", () => {
  const value = input.value.trim().replace(/\/$/, "");
  chrome.storage.sync.set({ apiBase: value }, () => {
    status.textContent = value ? `已保存：${value}` : "已清空，将使用默认/本地地址";
    setTimeout(() => { status.textContent = ""; }, 2500);
  });
});

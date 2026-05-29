const app = document.getElementById("app");
const metaLine = document.getElementById("metaLine");
const refreshBtn = document.getElementById("refreshBtn");
const progress = document.getElementById("progress");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(payload) {
  const sections = payload.sections || [];
  const snapshot = payload.snapshot || {};
  metaLine.textContent = snapshot.last_run ? `上次刷新：${snapshot.last_run}` : "尚未刷新";
  app.innerHTML = sections.map((section) => `
    <section class="section">
      <div class="sec-title">${escapeHtml(section.title)}</div>
      <table>
        <colgroup>
          <col style="width:70px">
          <col style="width:56px">
          <col style="width:210px">
          <col style="width:118px">
          <col>
        </colgroup>
        <thead>
          <tr>
            <th>标识</th>
            <th>机构</th>
            <th>来源</th>
            <th>最近更新</th>
            <th>最新内容</th>
          </tr>
        </thead>
        <tbody>
          ${section.rows.map(renderRow).join("")}
        </tbody>
      </table>
    </section>
  `).join("");
}

function renderRow(row) {
  const item = row.latest_item;
  let entry = `<a class="src-link" href="${escapeHtml(row.url)}" target="_blank" rel="noopener">→ 来源页面</a>`;
  if (item) {
    const href = item.link || row.url;
    const title = item.title || "来源页面";
    const source = href !== row.url
      ? `<a class="src-link" href="${escapeHtml(row.url)}" target="_blank" rel="noopener">→ 来源页面</a>`
      : "";
    const status = row.failed ? `<span class="fail">本次刷新失败，显示上次保存结果</span>` : "";
    entry = `${status}<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>${source}`;
  } else if (row.failed) {
    entry = `<span class="fail">抓取失败</span> ${entry}`;
  }

  return `
    <tr>
      <td class="logo-cell">${row.logo ? `<img class="bank-logo" src="${escapeHtml(row.logo)}" alt="${escapeHtml(row.bank)} logo">` : ""}</td>
      <td><span class="bank ${escapeHtml(row.bank)}">${escapeHtml(row.bank)}</span></td>
      <td class="src"><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener">${escapeHtml(row.name)}</a></td>
      <td class="date">${escapeHtml(row.latest_date || "—")}</td>
      <td class="entry">${entry}</td>
    </tr>
  `;
}

async function loadLatest() {
  progress.style.width = "25%";
  const response = await fetch("/api/latest", { headers: { Accept: "application/json" } });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || "读取失败");
  render(payload);
  progress.style.width = "100%";
  setTimeout(() => progress.style.width = "0", 300);
}

async function refreshData() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "刷新中...";
  metaLine.textContent = "正在刷新数据...";
  progress.style.width = "35%";
  try {
    const response = await fetch("/api/refresh", { method: "POST", headers: { Accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "刷新失败");
    render(payload);
    progress.style.width = "100%";
  } catch (error) {
    metaLine.textContent = error.message;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "刷新数据";
    setTimeout(() => progress.style.width = "0", 300);
  }
}

refreshBtn.addEventListener("click", refreshData);
loadLatest().catch((error) => {
  metaLine.textContent = error.message;
  app.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});

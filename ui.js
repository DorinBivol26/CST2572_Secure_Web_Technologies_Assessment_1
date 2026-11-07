// Shared display helpers keep dates and user-entered text safe and consistent.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

export function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value ?? "Date unavailable")
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

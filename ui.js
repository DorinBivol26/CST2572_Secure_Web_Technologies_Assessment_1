// Shared display helpers keep dates and user-entered text safe and consistent.
export function escapeHtml(value) {
  // Escape dynamic text before it is inserted into an HTML string.
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

export function formatDateTime(value) {
  // Use the browser locale while keeping invalid values visible to the user.
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value ?? "Date unavailable")
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

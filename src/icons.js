const icons = {
  hand: '<path d="M11 15V7a2 2 0 0 1 4 0v8-11a2 2 0 0 1 4 0v11-9a2 2 0 0 1 4 0v9-5a2 2 0 0 1 4 0v9c0 7-3 10-9 10-4 0-6-2-8-5l-4-6c-2-3 1-5 3-3l2 2" fill="#e7c58e" stroke="#856b49"/>',
  flowers:
    '<path d="M17 28V13m0 10c-6 1-8-3-8-3 5-2 8 3 8 3m0-5c6 0 8-4 8-4-5-1-8 4-8 4" fill="#7a975c" stroke="#627d47"/><g fill="#ead994" stroke="#bc9d57"><ellipse cx="17" cy="8" rx="3" ry="5"/><ellipse cx="17" cy="16" rx="3" ry="5"/><ellipse cx="13" cy="12" rx="5" ry="3"/><ellipse cx="21" cy="12" rx="5" ry="3"/></g><circle cx="17" cy="12" r="3.1" fill="#c59446"/>',
  seeds:
    '<path d="M16 28V12m0 9C4 21 5 9 5 9s12 0 11 12m0-5C16 4 28 4 28 4s0 13-12 12" fill="#85a269" stroke="#5e7c4e"/><path d="M7 29h19" stroke="#aa8960"/>',
  water:
    '<path d="M17 3S7 14 7 20a10 10 0 0 0 20 0C27 14 17 3 17 3Z" fill="#8fb9be" stroke="#577f89"/><path d="M12 18q-3 7 4 8" fill="none" stroke="#d7e8d7"/>',
};
export function applyIcons() {
  for (const [id, path] of Object.entries(icons)) {
    document.querySelector(`[data-tool="${id}"] .tool-art`).innerHTML =
      `<svg viewBox="0 0 34 34" aria-hidden="true" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  }
}

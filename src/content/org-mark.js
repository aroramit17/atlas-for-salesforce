(() => {
  const host = location.hostname.toLowerCase();
  if (!host.endsWith('.lightning.force.com') && !host.endsWith('.my.salesforce.com') && !/^(?:na|cs|eu|ap)\d+\.salesforce\.com$/.test(host)) return;
  const apiHost = host.endsWith('.lightning.force.com') ? host.replace(/\.lightning\.force\.com$/, '.my.salesforce.com') : host;
  const palette = ['#1b7a72', '#2563a5', '#8b5cba', '#b15c4a', '#94712e', '#357a4c'];
  let hash = 2166136261;
  for (const char of apiHost) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  let color = palette[(hash >>> 0) % palette.length];
  function iconHref() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${color}"/><path d="M18 43 32 17l14 26M23 34h18" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  let active = true;
  function mark() {
    if (!active || !document.head) return;
    let icon = document.querySelector('link[data-atlas-icon]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      icon.dataset.atlasIcon = 'true';
      document.head.append(icon);
    }
    const href = iconHref();
    if (icon.href !== href) icon.href = href;
  }
  mark();
  chrome.storage.local.get({ orgColors: {} }).then(({ orgColors }) => {
    const override = orgColors?.[apiHost];
    if (/^#[0-9a-fA-F]{6}$/.test(override || '')) { color = override; mark(); }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.orgColors) return;
    const override = changes.orgColors.newValue?.[apiHost];
    color = /^#[0-9a-fA-F]{6}$/.test(override || '') ? override : palette[(hash >>> 0) % palette.length];
    mark();
  });
  const observer = new MutationObserver(mark);
  if (document.head) observer.observe(document.head, { childList: true });
  addEventListener('pagehide', () => { active = false; observer.disconnect(); }, { once: true });
})();

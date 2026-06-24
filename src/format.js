export function parseLinks(rawLinks) {
  const links = rawLinks
    .split(',')
    .map((link) => link.trim())
    .filter(Boolean);

  return links.slice(0, 20);
}

export function maskValue(value) {
  if (!value) return 'Not set';
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }

  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value ?? 0));
}

export function compactNumber(value) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number(value ?? 0));
}

export function calculatePayout(views) {
  const viewCount = Number(views ?? 0);

  if (viewCount >= 1_000_000) return Math.floor(viewCount / 1_000_000) * 100;
  return Math.floor(viewCount / 100_000) * 10;
}

export function formatPayout(views) {
  return `$${calculatePayout(views)}`;
}

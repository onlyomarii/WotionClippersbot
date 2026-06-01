export function parseLinks(rawLinks) {
  const links = rawLinks
    .split(',')
    .map((link) => link.trim())
    .filter(Boolean);

  return links.slice(0, 10);
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

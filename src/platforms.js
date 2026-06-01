export const platforms = [
  { name: 'youtube', label: 'YouTube' },
  { name: 'tiktok', label: 'TikTok' },
  { name: 'instagram', label: 'Instagram' },
  { name: 'x', label: 'X / Twitter' },
  { name: 'facebook', label: 'Facebook' }
];

export const paymentPlatforms = [
  { name: 'paypal', label: 'PayPal' }
];

export function platformChoices() {
  return platforms.map((platform) => ({
    name: platform.label,
    value: platform.name
  }));
}

export function paymentPlatformChoices() {
  return paymentPlatforms.map((platform) => ({
    name: platform.label,
    value: platform.name
  }));
}

export function detectPlatformFromUrl(link) {
  let hostname;

  try {
    hostname = new URL(link).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }

  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
  if (hostname.includes('tiktok.com')) return 'tiktok';
  if (hostname.includes('instagram.com')) return 'instagram';
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'x';
  if (hostname.includes('facebook.com') || hostname.includes('fb.watch')) return 'facebook';

  return 'unknown';
}

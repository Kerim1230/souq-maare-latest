// Centralized date formatting utilities for Arabic (Syria) locale

/** Format date as short: "١٥ يناير" */
export function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SY', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

/** Format date as full: "١٥ يناير ٢٠٢٥" */
export function formatDateFull(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
}

/** Format short date with time: "١٥ يناير، ٠٣:٣٠ م" */
export function formatShortDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SY', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

/** Format date with short month + year + time (used by admin): "١٥ يناير ٢٠٢٥ ٠٣:٣٠ م" */
export function formatDateAdmin(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ar-SY', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

/** Relative time: "منذ ٥ دقائق", "منذ ساعتين", "منذ ٣ أيام" */
export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `منذ ${days} يوم`;
    const weeks = Math.floor(days / 7);
    return `منذ ${weeks} أسبوع`;
  } catch { return ''; }
}

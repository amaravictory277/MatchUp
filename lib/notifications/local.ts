export type LocalNotification = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const STORAGE_KEY = "matchup.notifications.local.v1";
const CHANGE_EVENT = "matchup:notifications-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

export function readLocalNotifications(): LocalNotification[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LocalNotification[];
  } catch {
    return [];
  }
}

function writeLocalNotifications(items: LocalNotification[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 200)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Local storage may be unavailable; notification logging is best effort.
  }
}

export function recordLocalNotification(input: {
  kind: string;
  message: string;
  actorName?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  href?: string;
  thumbnail?: string;
  meta?: Record<string, unknown>;
}) {
  const payload: Record<string, unknown> = {
    message: input.message,
    ...(input.actorName ? { actor_name: input.actorName } : {}),
    ...(input.actorId ? { actor_id: input.actorId } : {}),
    ...(input.entityType ? { entity_type: input.entityType } : {}),
    ...(input.entityId ? { entity_id: input.entityId } : {}),
    ...(input.href ? { href: input.href } : {}),
    ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
    ...(input.meta || {}),
  };

  const next: LocalNotification = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    payload,
    read_at: null,
    created_at: new Date().toISOString(),
  };
  writeLocalNotifications([next, ...readLocalNotifications()]);
  return next;
}

export function markLocalNotificationRead(id: string) {
  const readAt = new Date().toISOString();
  writeLocalNotifications(readLocalNotifications().map((item) => item.id === id ? { ...item, read_at: readAt } : item));
}

export function markAllLocalNotificationsRead() {
  const readAt = new Date().toISOString();
  writeLocalNotifications(readLocalNotifications().map((item) => item.read_at ? item : { ...item, read_at: readAt }));
}

export function getLocalUnreadCount() {
  return readLocalNotifications().filter((item) => !item.read_at).length;
}

export function subscribeToLocalNotificationChanges(handler: () => void) {
  if (!isBrowser()) return () => undefined;
  const onChange = () => handler();
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

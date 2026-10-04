"use client";

import { useEffect, useRef, useState } from "react";

type NotificationStatus =
  | "unread"
  | "read"
  | "acknowledged"
  | "resolved";

type NotificationItem = {
  id: string;
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  status: NotificationStatus;
  createdAt: string;
  tableId?: string | null;
  orderId?: string | null;
  deviceId?: string | null;
};

const STATUS_EVENT = "tablors:notification-status";

export function useNotifications(playSound = false) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetch("/api/notifications", { cache: "no-store" })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`GET /api/notifications failed (${res.status})`);
          }
          return res.json();
        })
        .then((data) => {
          if (cancelled) return;
          if (!Array.isArray(data)) {
            console.error(
              "[notifications] /api/notifications must return an array, got:",
              data,
            );
            return;
          }
          setItems(data);
        })
        .catch((error) => {
          console.error("[notifications] load failed", error);
        });
    };

    load();

    const es = new EventSource("/api/notifications/stream");

    // The stream does not replay history, so re-sync whenever it (re)connects.
    es.onopen = load;

    es.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as NotificationItem;

        setItems((previous) => [
          notification,
          ...previous.filter((item) => item.id !== notification.id),
        ]);

        if (playSound && notification.priority !== "low") {
          (
            audio.current ??
            (audio.current = new Audio("/sounds/alert.mp3"))
          )
            .play()
            .catch(() => {});
        }
      } catch {
        // Ignore malformed SSE messages.
      }
    };

    es.onerror = () => {
      // EventSource automatically attempts to reconnect.
    };

    // Keep every mounted hook (bell, notifications page) in step on status changes.
    const onStatus = (event: Event) => {
      const { id, status } = (
        event as CustomEvent<{ id: string; status: NotificationStatus }>
      ).detail;
      setItems((previous) =>
        previous.map((n) => (n.id === id ? { ...n, status } : n)),
      );
    };
    window.addEventListener(STATUS_EVENT, onStatus);

    return () => {
      cancelled = true;
      es.close();
      window.removeEventListener(STATUS_EVENT, onStatus);
    };
  }, [playSound]);

  const setStatus = async (id: string, status: NotificationStatus) => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    if (!response.ok) {
      throw new Error("Failed to update notification");
    }

    setItems((previous) =>
      previous.map((notification) =>
        notification.id === id ? { ...notification, status } : notification,
      ),
    );

    window.dispatchEvent(
      new CustomEvent(STATUS_EVENT, { detail: { id, status } }),
    );
  };

  const unread = items.filter(
    (notification) => notification.status === "unread",
  ).length;

  return { items, unread, setStatus };
}
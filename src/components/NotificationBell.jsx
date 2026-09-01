import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { listMyNotifications, markNotificationRead, subscribeToMyNotifications } from "../services/notifications";

export default function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!userId) return undefined;
    listMyNotifications().then(setItems).catch(() => {});
    const unsubscribe = subscribeToMyNotifications(userId, (row) => setItems((prev) => [row, ...prev]));
    return unsubscribe;
  }, [userId]);

  if (!userId) return null;
  const unread = items.filter((item) => !item.read).length;

  const openDropdown = async () => {
    setOpen((prev) => !prev);
  };

  const handleRead = async (item) => {
    if (item.read) return;
    try {
      await markNotificationRead(item.id);
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
    } catch {
      /* non-critical */
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button className="notif-bell" onClick={openDropdown} aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="notif-dropdown">
          {items.length ? (
            items.map((item) => (
              <div key={item.id} className={`notif-item ${item.read ? "" : "unread"}`} onClick={() => handleRead(item)}>
                <b>{item.title}</b>
                <span>{item.message}</span>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
            ))
          ) : (
            <div className="notif-item">No notifications yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

import { Toast } from "@base-ui/react/toast";

export type NotificationKind = "success" | "error" | "info";
export const toast = Toast.createToastManager();

export function notify(message: string, kind: NotificationKind = "error") {
  if (!message) return;
  toast.add({
    title: message,
    type: kind,
    timeout: kind === "error" ? 8000 : 5000,
    priority: kind === "error" ? "high" : "low",
  });
}

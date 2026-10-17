import { Toast } from "@base-ui/react/toast";
import { toast } from "../services/notifications";

// Local renderer for the Base UI primitives used by shadcn's Base Toast.
export function Toaster() {
  return (
    <Toast.Provider toastManager={toast} limit={3}>
      <Toast.Portal>
        <Toast.Viewport className="app-toasts" aria-label="Notifications">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((item) => (
    <Toast.Root key={item.id} toast={item} className="app-toast" swipeDirection="right">
      <Toast.Content className="app-toast-content">
        <i aria-hidden="true" className={`app-toast-icon fas ${item.type === "success" ? "fa-circle-check" : item.type === "error" ? "fa-circle-exclamation" : "fa-circle-info"}`} />
        <Toast.Title className="app-toast-title" />
        <Toast.Close className="app-toast-close" aria-label="Dismiss notification">
          <i className="fas fa-xmark" aria-hidden="true" />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

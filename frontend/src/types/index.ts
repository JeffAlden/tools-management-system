export type Role = "Developer" | "Admin" | "User";
export type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
  active?: number;
};
export type Item = {
  id: string;
  name: string;
  requested_qty: number;
  returned_qty: number;
  note: string;
  condition_note: string;
  return_status: string;
};
export type Attachment = {
  id: string;
  kind: string;
  created_at: string;
  event_id: string | null;
};
export type BorrowRequest = {
  id: string;
  reference: string;
  borrower_name: string;
  position: string;
  plate: string;
  request_date: string;
  borrow_date: string | null;
  return_date: string | null;
  released_name: string | null;
  received_name: string | null;
  status: "Pending Approval" | "Issued" | "Completed";
  version: number;
  items: Item[];
  attachments?: Attachment[];
  events?: {
    id: string;
    kind: string;
    inspection: unknown;
    created_at: string;
    actor: string;
  }[];
};
export type Tool = {
  id: string;
  code: string;
  name: string;
  total_qty: number;
};
export type Log = {
  id: number;
  action: string;
  details: string;
  request_id: string | null;
  created_at: string;
  actor: string;
  username: string;
};

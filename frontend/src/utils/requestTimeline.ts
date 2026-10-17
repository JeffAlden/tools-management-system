import type { Attachment, BorrowRequest } from "../types";
import { date } from "./date";

export type RequestTimelineStep = {
  id: string;
  kind: "request" | "handover" | "return";
  title: string;
  when: string | null;
  actor: string | null;
  pending?: boolean;
  attachments: Attachment[];
};

export function requestTimeline(request: BorrowRequest): RequestTimelineStep[] {
  const files = request.attachments || [];
  const events = (request.events || [])
    .filter((e) => ["handover", "return"].includes(e.kind))
    .slice()
    .sort(
      (a, b) =>
        date(a.created_at).getTime() - date(b.created_at).getTime() ||
        a.id.localeCompare(b.id),
    );
  const used = new Set<string>();
  const take = (match: (file: Attachment) => boolean) =>
    files.filter((file) => {
      if (used.has(file.id) || !match(file)) return false;
      used.add(file.id);
      return true;
    });
  const steps: RequestTimelineStep[] = [
    {
      id: "request",
      kind: "request",
      title: "Request submitted",
      when: request.request_date,
      actor: request.borrower_name,
      attachments: take((f) => f.kind.startsWith("borrower")),
    },
  ];
  const lastReturn = events.filter((e) => e.kind === "return").at(-1);
  for (const event of events) {
    const kind = event.kind as "handover" | "return";
    const onlyEvent = events.filter((e) => e.kind === kind).length === 1;
    steps.push({
      id: event.id,
      kind,
      title:
        kind === "handover"
          ? "Equipment issued"
          : request.status === "Completed" && event.id === lastReturn?.id
            ? "Return completed"
            : "Partial return recorded",
      when: event.created_at,
      actor: event.actor,
      attachments: take(
        (f) =>
          f.event_id === event.id ||
          (!f.event_id && onlyEvent && f.kind.startsWith(kind)),
      ),
    });
  }
  for (const kind of ["handover", "return"] as const) {
    const hasEvent = events.some((e) => e.kind === kind);
    const remaining = take((f) => f.kind.startsWith(kind));
    const when =
      kind === "handover" ? request.borrow_date : request.return_date;
    if (remaining.length || (!hasEvent && when))
      steps.push({
        id: `${kind}-legacy`,
        kind,
        title: hasEvent
          ? kind === "handover"
            ? "Additional handover photos"
            : "Additional return photos"
          : kind === "handover"
            ? "Equipment issued"
            : request.status === "Completed"
              ? "Return completed"
              : "Return recorded",
        when: hasEvent ? remaining[0]?.created_at || null : when,
        actor:
          kind === "handover" ? request.released_name : request.received_name,
        attachments: remaining,
      });
    if (!hasEvent && !when && !remaining.length)
      steps.push({
        id: `${kind}-pending`,
        kind,
        title: kind === "handover" ? "Awaiting issuance" : "Awaiting return",
        when: null,
        actor: null,
        pending: true,
        attachments: [],
      });
  }
  // Preserve visibility of any unfamiliar legacy attachment kind.
  const other = take(() => true);
  if (other.length)
    steps.push({
      id: "other",
      kind: "request",
      title: "Other attachments",
      when: null,
      actor: null,
      attachments: other,
    });
  const rest = steps.slice(1).sort((a, b) => {
    if (a.pending && b.pending)
      return a.kind === b.kind ? 0 : a.kind === "handover" ? -1 : 1;
    if (a.pending) return 1;
    if (b.pending) return -1;
    return a.when && b.when
      ? date(a.when).getTime() - date(b.when).getTime()
      : 0;
  });
  return [steps[0], ...rest];
}

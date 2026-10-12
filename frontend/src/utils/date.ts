// MySQL DATETIME strings represent UTC throughout this project.
export const date = (value: string) =>
  new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
export const formatDate = (value: string | null) =>
  value ? date(value).toLocaleString() : "-";
export function localDate(value: string) {
  const d = date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
export function possession(
  start: string | null,
  end: string | null,
  now = Date.now(),
) {
  if (!start) return "0 hrs (Not Issued)";
  const hours = Math.max(
    0,
    Math.floor(
      ((end ? date(end).getTime() : now) - date(start).getTime()) / 3600000,
    ),
  );
  return hours >= 24
    ? `${Math.floor(hours / 24)} day(s) ${hours % 24} hrs`
    : `${hours} hrs`;
}

import { redirect } from "next/navigation";

export default function LegacyNotificationsPage() {
  redirect("/profile?notifications=1");
}

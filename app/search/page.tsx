import { redirect } from "next/navigation";

/** Legacy route — inbox scan lives at /scan. */
export default function SearchPage() {
  redirect("/scan");
}

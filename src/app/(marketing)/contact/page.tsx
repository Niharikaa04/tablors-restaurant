import { redirect } from "next/navigation";

// Contact details live in the site footer (id="contact"). Keep the old
// /contact URL working by sending visitors there.
export default function ContactPage() {
  redirect("/#contact");
}

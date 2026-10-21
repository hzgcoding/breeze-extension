import { getProfileSharePayload } from "@/lib/profileShareLink";
import { sendMessage } from "./background/message";

export default defineContentScript({
  matches: ["https://hzgcoding.github.io/breeze-extension/share.html", "https://hzgcoding.github.io/breeze-extension/share"],
  main(ctx) {
    function openImport() {
      const payload = getProfileSharePayload(window.location.href);
      if (payload)
        void sendMessage("openSharedProfilesImport", `?profiles=${payload}`).catch(() => {});
    }
    ctx.addEventListener(window, "hashchange", openImport);
    openImport();
  },
});

import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { allowedRedirectUrl } from "../utils/redirectUrl";

export default function ExitIframe() {
  const app = useAppBridge();
  const { search } = useLocation();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    app.loading(true);
    if (!search) return;

    const params = new URLSearchParams(search);
    const url = allowedRedirectUrl(params.get("redirectUri"), location.hostname);

    if (url) {
      window.open(url, "_top");
    } else {
      app.loading(false);
      setShowWarning(true);
    }
  }, [app, search]);

  return showWarning ? (
    <s-page inlineSize="small">
      <s-banner tone="warning" heading="Redirecting outside of Shopify">
        Apps can only use /exitiframe to reach Shopify or the app itself.
      </s-banner>
    </s-page>
  ) : null;
}

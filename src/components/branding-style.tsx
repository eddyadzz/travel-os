import { useEffect, useState } from "react";
import { getTenantByHost } from "@/lib/api/tenants";

/**
 * Injects the current tenant's primary color, accent color and font as CSS
 * overrides so the whole app is white-labelled per custom domain / subdomain.
 */
export function BrandingStyle() {
  const [injected, setInjected] = useState(false);

  useEffect(() => {
    if (injected) return;
    getTenantByHost({ data: window.location.host })
      .then((branding) => {
        if (!branding?.primaryColor) return;
        const existing = document.getElementById("tenant-branding");
        if (existing) existing.remove();
        const style = document.createElement("style");
        style.id = "tenant-branding";
        const fontRule = branding.fontFamily
          ? `body { font-family: ${branding.fontFamily}, system-ui, sans-serif; }`
          : "";
        style.textContent = `:root { --primary: ${branding.primaryColor}; --color-primary: ${branding.primaryColor}; ${
          branding.accentColor
            ? `--accent: ${branding.accentColor}; --color-accent: ${branding.accentColor};`
            : ""
        } } ${fontRule}`;
        document.head.appendChild(style);
        setInjected(true);
      })
      .catch(() => {});
  }, [injected]);

  return null;
}

export default function MiniCloudWindowPage() {
  // The RootLayout owns MiniCloudDock. This dedicated, authenticated route
  // keeps that live dock in an independent desktop window when its opener
  // navigates away or closes.
  return <span id="mini-cloud-window-root" hidden aria-hidden="true" />;
}

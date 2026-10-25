import { toPng } from 'html-to-image';

/**
 * High-fidelity print helper that captures the target element as a high-resolution PNG image
 * using html-to-image and prints it inside an isolated hidden iframe.
 * This guarantees 100% visual parity with the screen view and PDF downloads,
 * preventing any black-and-white rendering issues, missing borders, or font/color drift.
 */
export async function printElementDirect(
  elementOrId: HTMLElement | string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  title: string = 'Print Document'
): Promise<boolean> {
  let targetEl: HTMLElement | null = null;
  if (typeof elementOrId === 'string') {
    targetEl = document.getElementById(elementOrId);
  } else {
    targetEl = elementOrId;
  }

  if (!targetEl) {
    console.warn('Target element not found for print');
    return false;
  }

  try {
    // Generate crisp high-res image of the element (identical to PDF / image downloads)
    const dataUrl = await toPng(targetEl, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#ffffff',
    });

    // Create an isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-99999';
    iframe.setAttribute('aria-hidden', 'true');

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return false;
    }

    const printDocHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 4mm;
    }
    html, body {
      background-color: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
      text-align: center !important;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 0 auto !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="${title}" />
  <script>
    window.onload = function() {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.warn('Print trigger error:', e);
        }
      }, 400);
    };
  </script>
</body>
</html>`;

    doc.open();
    doc.write(printDocHtml);
    doc.close();

    return new Promise((resolve) => {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        resolve(true);
      }, 3000);
    });
  } catch (e) {
    console.warn('Image print capture failed, falling back to window.print():', e);
    window.print();
    return false;
  }
}

/**
 * Legacy wrapper: calls direct isolated print for elementId
 */
export async function printElement(elementId: string): Promise<void> {
  await printElementDirect(elementId, 'portrait', 'Official Document');
}

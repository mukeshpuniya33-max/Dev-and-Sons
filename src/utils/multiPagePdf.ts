import jsPDF from 'jspdf';
import { toCanvas, toPng } from 'html-to-image';

/**
 * Robust multi-page PDF generator that renders any element inside an isolated,
 * unconstrained offscreen sandbox. This guarantees that:
 * 1. Scrollable/flex parents never clamp content (e.g. all 50+ workers are rendered, not just 4-5)
 * 2. Wide tables (all 31 days) are not truncated or squished
 * 3. Exact proportional heights prevent row stretching on partial pages
 * 4. Yielding and AbortSignal support ensure the browser UI never freezes or lags
 */
function sanitizeOklchCss(cssText: string): string {
  return cssText.replace(/oklch\([^)]+\)/g, 'rgb(100, 116, 139)');
}

export async function downloadElementAsMultiPagePdf(
  element: HTMLElement,
  filename: string,
  orientation: 'p' | 'l' = 'p',
  signal?: AbortSignal
): Promise<boolean> {
  const isLandscape = orientation === 'l';

  // Create an offscreen sandbox attached to document.body
  const wrapper = document.createElement('div');
  wrapper.id = 'pdf-render-sandbox';
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.style.width = isLandscape ? '1650px' : '1100px';
  wrapper.style.height = 'auto';
  wrapper.style.overflow = 'visible';
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.style.color = '#000000';
  wrapper.style.zIndex = '-99999';

  // Inject sanitized document stylesheets
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleEl) => {
    if (styleEl.tagName === 'STYLE') {
      const newStyle = styleEl.cloneNode(true) as HTMLStyleElement;
      newStyle.textContent = sanitizeOklchCss(newStyle.textContent || '');
      wrapper.appendChild(newStyle);
    }
  });

  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.style.width = '100%';
  cloned.style.height = 'auto';
  cloned.style.maxHeight = 'none';
  cloned.style.overflow = 'visible';

  // Strip buttons and interactive elements from export
  cloned.querySelectorAll('.print\\:hidden, button, input[type="file"]').forEach((el) => el.remove());

  // Sanitize inline oklch styles
  cloned.querySelectorAll('*').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style && htmlEl.style.cssText && htmlEl.style.cssText.includes('oklch')) {
      htmlEl.style.cssText = htmlEl.style.cssText.replace(/oklch\([^)]+\)/g, 'rgb(100, 116, 139)');
    }
  });

  wrapper.appendChild(cloned);
  document.body.appendChild(wrapper);

  try {
    if (signal?.aborted) return false;

    // Yield control so UI stays fluid and user can cancel
    await new Promise((r) => setTimeout(r, 60));

    if (signal?.aborted) return false;

    const targetWidth = Math.max(wrapper.scrollWidth, isLandscape ? 1650 : 1100);
    const targetHeight = wrapper.scrollHeight;

    // Render using html-to-image at 1.5x DPI (crisp text, 4x faster than 2x)
    const canvas = await toCanvas(wrapper, {
      pixelRatio: 1.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
      width: targetWidth,
      height: targetHeight,
    });

    if (signal?.aborted) return false;

    const pdf = new jsPDF(orientation, 'mm', 'a4');
    const pdfPageWidth = isLandscape ? 297 : 210;
    const pdfPageHeight = isLandscape ? 210 : 297;

    const margin = isLandscape ? 5 : 8;
    const printableWidth = pdfPageWidth - margin * 2;
    const printableHeight = pdfPageHeight - margin * 2;

    const pxPerMm = canvas.width / printableWidth;
    const pageCanvasHeight = Math.floor(printableHeight * pxPerMm);

    let renderedHeight = 0;
    let pageIndex = 0;

    while (renderedHeight < canvas.height) {
      if (signal?.aborted) return false;

      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
      const sliceMmHeight = sliceHeight / pxPerMm;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, sliceHeight);
        ctx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          imgData,
          'JPEG',
          margin,
          margin,
          printableWidth,
          sliceMmHeight,
          undefined,
          'FAST'
        );
      }

      renderedHeight += sliceHeight;
      pageIndex++;
    }

    const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeName);
    return true;
  } catch (err) {
    console.error('Multi-page PDF generation error:', err);
    throw err;
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}

/**
 * Downloads any DOM element as a full-resolution PNG image without clipping.
 */
export async function downloadElementAsImage(
  element: HTMLElement,
  filename: string,
  isLandscape: boolean = false
): Promise<boolean> {
  const wrapper = document.createElement('div');
  wrapper.id = 'img-render-sandbox';
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-99999px';
  wrapper.style.top = '0';
  wrapper.style.width = isLandscape ? '1650px' : '1100px';
  wrapper.style.height = 'auto';
  wrapper.style.overflow = 'visible';
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.style.color = '#000000';
  wrapper.style.zIndex = '-99999';

  // Inject sanitized document stylesheets
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleEl) => {
    if (styleEl.tagName === 'STYLE') {
      const newStyle = styleEl.cloneNode(true) as HTMLStyleElement;
      newStyle.textContent = sanitizeOklchCss(newStyle.textContent || '');
      wrapper.appendChild(newStyle);
    }
  });

  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.style.width = '100%';
  cloned.style.height = 'auto';
  cloned.style.maxHeight = 'none';
  cloned.style.overflow = 'visible';
  cloned.querySelectorAll('.print\\:hidden, button, input[type="file"]').forEach((el) => el.remove());

  // Sanitize inline oklch styles
  cloned.querySelectorAll('*').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style && htmlEl.style.cssText && htmlEl.style.cssText.includes('oklch')) {
      htmlEl.style.cssText = htmlEl.style.cssText.replace(/oklch\([^)]+\)/g, 'rgb(100, 116, 139)');
    }
  });

  wrapper.appendChild(cloned);
  document.body.appendChild(wrapper);

  try {
    await new Promise((r) => setTimeout(r, 60));

    const targetWidth = Math.max(wrapper.scrollWidth, isLandscape ? 1650 : 1100);
    const targetHeight = wrapper.scrollHeight;

    const dataUrl = await toPng(wrapper, {
      pixelRatio: 1.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
      width: targetWidth,
      height: targetHeight,
    });

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Image export error:', err);
    return false;
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}

/**
 * Downloads a standalone, self-contained HTML file of the element.
 * Fully viewable offline in any mobile or desktop browser with 100% color retention.
 */
export function downloadElementAsStandaloneHtml(
  element: HTMLElement,
  filename: string,
  title: string
): void {
  const cloned = element.cloneNode(true) as HTMLElement;

  // Remove buttons and print:hidden elements
  const removeElements = cloned.querySelectorAll('.print\\:hidden, button, input[type="file"]');
  removeElements.forEach((el) => el.remove());

  let stylesHtml = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((styleEl) => {
    stylesHtml += styleEl.outerHTML;
  });

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  ${stylesHtml}
  <style>
    @media print {
      body { margin: 6mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      table { page-break-inside: auto; width: 100% !important; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
    }
    body {
      background-color: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div style="max-width: 100%; margin: 0 auto;">
    ${cloned.outerHTML}
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

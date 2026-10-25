import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { printElementDirect } from './printHelper';

/**
 * Generates and downloads a clean, high-resolution PDF of the payslip element.
 * Uses html-to-image to fully support modern CSS (including Tailwind CSS v4 OKLCH colors).
 */
export async function downloadPayslipPdf(elementId: string, filename: string): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) {
    return false;
  }

  try {
    // Generate high-resolution PNG using browser native SVG foreignObject renderer
    const dataUrl = await toPng(element, {
      quality: 0.98,
      pixelRatio: 1.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Create a temporary image to read exact natural dimensions
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const imgWidth = 210; // A4 standard width in mm
    const pageHeight = 295; // A4 standard height in mm
    const imgHeight = (img.height * imgWidth) / img.width;

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Subsequent pages if payslip exceeds 1 page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
    return true;
  } catch (err) {
    console.error('PDF generation error, falling back to direct isolated print:', err);
    await printElementDirect(element, 'portrait', filename);
    return false;
  }
}


export {
  downloadElementAsMultiPagePdf,
  downloadElementAsImage,
  downloadElementAsStandaloneHtml,
} from './multiPagePdf';

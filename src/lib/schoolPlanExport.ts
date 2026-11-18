import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'
import JSZip from 'jszip'

const A4_WIDTH = 297
const A4_HEIGHT = 210
const PAGE_MARGIN = 5
const MAX_WIDTH = A4_WIDTH - PAGE_MARGIN * 2
const MAX_HEIGHT = A4_HEIGHT - PAGE_MARGIN * 2

function safeFileName(name: string, extension: string) {
  const cleaned = name
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const base = cleaned || 'خطة-أسبوعية'
  return base.endsWith(`.${extension}`) ? base : `${base}.${extension}`
}

async function renderElement(element: HTMLElement) {
  await document.fonts.ready
  const rect = element.getBoundingClientRect()
  const canvas = await html2canvas(element, {
    scale: Math.min(2, Math.max(1.5, 2048 / Math.max(rect.width, 1))),
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    width: element.scrollWidth || rect.width,
    height: element.scrollHeight || rect.height,
    windowWidth: document.documentElement.scrollWidth,
  })
  return canvas
}

function createLandscapePdf(title: string) {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })
  pdf.setProperties({ title, subject: 'الخطط الأسبوعية الذكية - نمذجة التعلم' })
  return pdf
}

function addCanvasAsPage(pdf: jsPDF, canvas: HTMLCanvasElement, isFirst: boolean) {
  if (!isFirst) {
    pdf.addPage('a4', 'landscape')
  }
  const ratio = Math.min(MAX_WIDTH / canvas.width, MAX_HEIGHT / canvas.height)
  const width = canvas.width * ratio
  const height = canvas.height * ratio
  pdf.addImage(
    canvas.toDataURL('image/png'),
    'PNG',
    (A4_WIDTH - width) / 2,
    (A4_HEIGHT - height) / 2,
    width,
    height,
    undefined,
    'FAST',
  )
}

function removeBlankPage(pdf: jsPDF) {
  // jsPDF يبدأ بصفحة واحدة؛ إن بقيت صفحة فارغة زائدة تُحذف
  const count = pdf.getNumberOfPages()
  if (count > 1) {
    pdf.setPage(1)
  }
  return pdf
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportPlanImage(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await renderElement(element)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), 'image/png'),
  )
  if (!blob) {
    throw new Error('تعذر إنشاء صورة الخطة')
  }
  downloadBlob(blob, safeFileName(filename, 'png'))
}

export async function exportPlanPdf(
  items: Array<{ element: HTMLElement; filename: string }>,
  options: { combined: boolean; zipName?: string },
): Promise<void> {
  if (items.length === 0) return

  if (options.combined) {
    const title = options.zipName ?? 'الخطط-الأسبوعية.pdf'
    const pdf = createLandscapePdf(title)
    for (const [index, item] of items.entries()) {
      const canvas = await renderElement(item.element)
      addCanvasAsPage(pdf, canvas, index === 0)
    }
    removeBlankPage(pdf)
    pdf.save(safeFileName(title.replace(/\.pdf$/i, ''), 'pdf'))
    return
  }

  const zip = new JSZip()
  for (const item of items) {
    const pdf = createLandscapePdf(item.filename)
    const canvas = await renderElement(item.element)
    addCanvasAsPage(pdf, canvas, true)
    removeBlankPage(pdf)
    zip.file(safeFileName(item.filename, 'pdf'), pdf.output('arraybuffer'))
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  downloadBlob(blob, safeFileName(options.zipName ?? 'الخطط-الأسبوعية', 'zip'))
}

import jsPDF from "jspdf";
import { APP_NAME } from "../constants";
import { formatarDataHora } from "./formatadores";

export function criarDocumento(titulo: string): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setProperties({ title: `${titulo} - ${APP_NAME}` });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(APP_NAME, 14, 16);
  doc.setFontSize(12);
  doc.text(titulo, 14, 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Gerado em ${formatarDataHora(new Date().toISOString())}`, 14, 31);
  return doc;
}

export function aplicarRodape(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(APP_NAME, 14, 288);
    doc.text(`Página ${pagina} de ${total}`, 176, 288);
    doc.setTextColor(0);
  }
}

export function salvarPdf(doc: jsPDF, nomeArquivo: string): void {
  aplicarRodape(doc);
  doc.save(nomeArquivo);
}

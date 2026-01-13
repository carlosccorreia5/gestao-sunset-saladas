// src/types/global.d.ts
import 'vite/client';

declare global {
  interface Window {
    XLSX: any;
    saveAs: any;
    jsPDF: any;
    autoTable: any;
  }
}

export {};
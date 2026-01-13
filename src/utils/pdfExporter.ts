// src/utils/pdfExporter.ts - VERSÃO FINAL CORRIGIDA

// Declaração global única - SEM interface Window duplicada
declare global {
  interface Window {
    jsPDF: any;
    autoTable: any;
  }
}

let _jsPDF: any = null;
let _autoTable: any = null;

export const loadPDFLibraries = async (): Promise<boolean> => {
  try {
    console.log('🔍 Carregando bibliotecas PDF...');
    
    // Tentar usar do window primeiro (CDN)
    if (typeof window !== 'undefined' && window.jsPDF) {
      console.log('✅ Usando jsPDF do window (CDN)');
      _jsPDF = window.jsPDF;
      
      // Tentar carregar autoTable do CDN primeiro
      if (window.autoTable) {
        _autoTable = window.autoTable;
        console.log('✅ Usando autoTable do window (CDN)');
      } else {
        // Fallback: carregar dinamicamente
        try {
          const autoTableModule = await import('jspdf-autotable');
          _autoTable = autoTableModule.default;
          console.log('✅ AutoTable carregado dinamicamente');
        } catch (error) {
          console.warn('⚠️ AutoTable não encontrado, tentando método alternativo');
          // Método alternativo para autoTable
          _autoTable = null;
        }
      }
      return true;
    }
    
    // Fallback: carregar tudo dinamicamente
    console.log('📦 Carregando bibliotecas dinamicamente...');
    const jsPDFModule = await import('jspdf');
    _jsPDF = jsPDFModule.default;
    
    try {
      const autoTableModule = await import('jspdf-autotable');
      _autoTable = autoTableModule.default;
      console.log('✅ Bibliotecas carregadas com sucesso');
    } catch (error) {
      console.warn('⚠️ AutoTable não disponível, usando funcionalidade básica');
      _autoTable = null;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar bibliotecas PDF:', error);
    return false;
  }
};

export const createPDFDocument = (): any => {
  if (!_jsPDF) {
    throw new Error('jsPDF não carregado. Chame loadPDFLibraries() primeiro.');
  }
  return new _jsPDF('p', 'mm', 'a4');
};

export const addAutoTable = (doc: any, options: any): any => {
  // Se autoTable não estiver disponível, usar alternativa básica
  if (!_autoTable) {
    console.warn('⚠️ AutoTable não disponível, usando método básico');
    return addBasicTable(doc, options);
  }
  
  // Verificar diferentes formatos de autoTable
  if (typeof _autoTable === 'function') {
    return _autoTable(doc, options);
  } else if (typeof doc.autoTable === 'function') {
    return doc.autoTable(options);
  } else if (typeof doc.autoTable === 'object' && typeof doc.autoTable.apply === 'function') {
    return doc.autoTable.apply(doc, [options]);
  } else {
    console.warn('⚠️ Formato de autoTable não reconhecido, usando método básico');
    return addBasicTable(doc, options);
  }
};

// Função alternativa básica para quando autoTable não está disponível
const addBasicTable = (doc: any, options: any): any => {
  const { startY = 30, head = [], body = [], theme = 'grid' } = options;
  
  let currentY = startY;
  const marginX = 20;
  const maxWidth = 170; // Largura da página menos margens
  
  // Calcular largura das colunas
  const colCount = Math.max(head[0]?.length || 0, body[0]?.length || 0);
  const colWidth = maxWidth / colCount;
  
  // Desenhar cabeçalho
  if (head.length > 0) {
    doc.setFillColor(41, 128, 185); // Azul
    doc.rect(marginX, currentY, maxWidth, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    
    head[0].forEach((header: string, index: number) => {
      doc.text(header, marginX + (index * colWidth) + 2, currentY + 7);
    });
    
    currentY += 10;
  }
  
  // Desenhar linhas do corpo
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  body.forEach((row: any[], rowIndex: number) => {
    // Alternar cores das linhas
    if (theme === 'grid' || theme === 'striped') {
      if (rowIndex % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(marginX, currentY, maxWidth, 10, 'F');
      }
    }
    
    row.forEach((cell: any, colIndex: number) => {
      const cellText = cell?.toString() || '';
      doc.text(cellText, marginX + (colIndex * colWidth) + 2, currentY + 7);
    });
    
    currentY += 10;
    
    // Verificar se precisa de nova página
    if (currentY > 270 && rowIndex < body.length - 1) {
      doc.addPage();
      currentY = 20;
    }
  });
  
  // Retornar a posição Y final para o chamador
  return { finalY: currentY + 10 };
};

export const isPDFReady = (): boolean => {
  return !!_jsPDF;
};

// Interface para opções da tabela
interface TableOptions {
  startY?: number;
  head?: string[][];
  body?: any[][];
  theme?: string;
  headStyles?: any;
  columnStyles?: any;
  [key: string]: any;
}

// Função para gerar e salvar PDF diretamente
export const generateAndSavePDF = async (
  title: string,
  content: string,
  fileName = 'documento.pdf'
): Promise<void> => {
  try {
    const loaded = await loadPDFLibraries();
    if (!loaded) {
      throw new Error('Bibliotecas PDF não disponíveis');
    }
    
    const doc = createPDFDocument();
    
    // Configurar o documento
    doc.setFontSize(16);
    doc.text(title, 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(content, 180);
    doc.text(splitText, 20, 40);
    
    // Salvar o PDF
    doc.save(fileName);
    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
};

// Função para criar PDF com tabela de dados (versão simplificada)
export const createTablePDF = async (
  title: string,
  headers: string[],
  data: any[][],
  fileName = 'relatorio.pdf',
  options: TableOptions = {}
): Promise<void> => {
  try {
    const loaded = await loadPDFLibraries();
    if (!loaded) {
      throw new Error('Bibliotecas PDF não disponíveis');
    }
    
    const doc = createPDFDocument();
    
    // Adicionar título
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 105, 20, { align: 'center' });
    
    // Adicionar data
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 30, { align: 'center' });
    
    // Configurar opções da tabela
    const tableOptions: TableOptions = {
      startY: 40,
      head: [headers],
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      ...options
    };
    
    // Adicionar tabela (com fallback automático)
    addAutoTable(doc, tableOptions);
    
    // Adicionar rodapé se possível
    try {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
      }
    } catch (error) {
      console.warn('Não foi possível adicionar rodapé:', error);
    }
    
    // Salvar o PDF
    doc.save(fileName);
    
  } catch (error) {
    console.error('Erro ao criar PDF com tabela:', error);
    throw error;
  }
};
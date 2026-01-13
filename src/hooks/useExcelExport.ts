import { useState, useCallback } from 'react';

// Declarações de tipo para evitar erros do TypeScript
// O Vercel precisa destas declarações para compilar corretamente
// CORREÇÃO: Removemos os tipos não utilizados ou adicionamos export

// Opção 1: Remover os tipos não utilizados (mais simples)
// Comente ou remova as linhas abaixo:

// Opção 2: Exportar os tipos para serem utilizados
// export type XLSXType = any;
// export type SaveAsType = (blob: Blob, fileName: string) => void;

// Opção 3: Usar uma interface global (recomendado se usa window.XLSX)
declare global {
  interface Window {
    XLSX: any;
    saveAs: (blob: Blob, fileName: string) => void;
  }
}

export const useExcelExport = () => {
  const [isLoading, setIsLoading] = useState(false);

  const exportToExcel = useCallback(async (data: any[], fileName: string, sheetName = 'Relatório') => {
    setIsLoading(true);
    
    try {
      // Verificar se estamos no navegador (cliente)
      if (typeof window === 'undefined') {
        throw new Error('Exportação Excel só disponível no navegador');
      }

      if (!data || data.length === 0) {
        throw new Error('Nenhum dado para exportar');
      }

      // Verificar se as bibliotecas estão carregadas globalmente
      if (!window.XLSX || !window.saveAs) {
        throw new Error(
          'Bibliotecas de exportação não disponíveis. ' +
          'Recarregue a página ou verifique as dependências.'
        );
      }

      // Criar worksheet
      const ws = window.XLSX.utils.json_to_sheet(data);
      
      // Criar workbook
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      // Gerar buffer Excel
      const excelBuffer = window.XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array' 
      });
      
      // Criar blob e salvar
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      window.saveAs(blob, fileName);
      
      return true;
    } catch (error: any) {
      console.error('Erro ao exportar Excel:', error);
      
      // Mensagem de erro mais amigável
      if (error.message.includes('não disponíveis')) {
        throw new Error(
          '📗 Excel: Bibliotecas não carregadas\n\n' +
          'Solução 1: Recarregue a página\n' +
          'Solução 2: Instale as dependências no StackBlitz:\n' +
          'npm install xlsx file-saver'
        );
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exportMultipleSheets = useCallback(async (
    sheets: Array<{ data: any[]; sheetName: string }>,
    fileName: string
  ) => {
    setIsLoading(true);
    
    try {
      // Verificar se estamos no navegador (cliente)
      if (typeof window === 'undefined') {
        throw new Error('Exportação Excel só disponível no navegador');
      }

      // Verificar se as bibliotecas estão carregadas globalmente
      if (!window.XLSX || !window.saveAs) {
        throw new Error(
          'Bibliotecas de exportação não disponíveis. ' +
          'Recarregue a página ou verifique as dependências.'
        );
      }

      const wb = window.XLSX.utils.book_new();

      sheets.forEach((sheet, index) => {
        if (sheet.data && sheet.data.length > 0) {
          const ws = window.XLSX.utils.json_to_sheet(sheet.data);
          window.XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName || `Sheet${index + 1}`);
        }
      });

      const excelBuffer = window.XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array' 
      });
      
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      window.saveAs(blob, fileName);
      
      return true;
    } catch (error: any) {
      console.error('Erro ao exportar múltiplas abas:', error);
      
      if (error.message.includes('não disponíveis')) {
        throw new Error(
          '📗 Excel: Bibliotecas não carregadas\n\n' +
          'Solução 1: Recarregue a página\n' +
          'Solução 2: Instale as dependências no StackBlitz:\n' +
          'npm install xlsx file-saver'
        );
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    exportToExcel,
    exportMultipleSheets,
    isLoading
  };
};
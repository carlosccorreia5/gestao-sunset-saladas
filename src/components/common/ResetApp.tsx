// src/components/common/ResetApp.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ResetApp() {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔄 RESETANDO APLICAÇÃO...');
    
    const resetAll = async () => {
      try {
        // 1. Mostrar status
        console.log('🔐 Fazendo logout do Supabase...');
        await supabase.auth.signOut();
        
        // 2. Limpar todo o storage local
        console.log('🗑️ Limpando localStorage...');
        localStorage.clear();
        
        console.log('🗑️ Limpando sessionStorage...');
        sessionStorage.clear();
        
        // 3. Limpar cookies específicos
        console.log('🍪 Limpando cookies...');
        const cookies = document.cookie.split(";");
        for (let cookie of cookies) {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          // Limpa o cookie definindo data expirada
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        }
        
        // 4. Limpar IndexedDB (opcional)
        if ('indexedDB' in window) {
          console.log('🗄️ Limpando IndexedDB...');
          try {
            const dbs = await window.indexedDB.databases();
            dbs.forEach(db => {
              if (db.name) {
                window.indexedDB.deleteDatabase(db.name);
              }
            });
          } catch (err) {
            console.log('⚠️ Não foi possível limpar IndexedDB:', err);
          }
        }
        
        // 5. Limpar cache do Service Worker
        if ('serviceWorker' in navigator && 'caches' in window) {
          console.log('⚡ Limpando cache do Service Worker...');
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
              await registration.unregister();
            }
            
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
              await caches.delete(cacheName);
            }
          } catch (err) {
            console.log('⚠️ Não foi possível limpar Service Worker:', err);
          }
        }
        
        console.log('✅ Reset completo!');
        
        // 6. Aguardar um pouco e redirecionar
        setTimeout(() => {
          console.log('🔀 Redirecionando para login...');
          // Navega primeiro, depois recarrega
          navigate('/login/production', { 
            replace: true,
            state: { fromReset: true }
          });
          
          // Força recarregamento após navegação
          setTimeout(() => {
            window.location.reload();
          }, 100);
          
        }, 1500);
        
      } catch (error) {
        console.error('❌ Erro no reset:', error);
        // Mesmo com erro, tenta redirecionar
        navigate('/login/production', { replace: true });
        window.location.reload();
      }
    };
    
    resetAll();
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f8f9fa',
      flexDirection: 'column',
      gap: '20px',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#FF9800', fontSize: '28px', margin: 0 }}>
        🔄 Resetando Aplicação
      </h1>
      <p style={{ color: '#666', fontSize: '16px' }}>
        Limpando cache, cookies e sessões...
      </p>
      <div style={{
        width: '60px',
        height: '60px',
        border: '5px solid #e0e0e0',
        borderTop: '5px solid #FF9800',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <div style={{ marginTop: '20px', color: '#999', fontSize: '14px' }}>
        <p>Esta operação irá:</p>
        <ul style={{ textAlign: 'left', paddingLeft: '20px' }}>
          <li>Fazer logout da sua sessão</li>
          <li>Limpar cache local</li>
          <li>Remover cookies</li>
          <li>Redirecionar para o login</li>
        </ul>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
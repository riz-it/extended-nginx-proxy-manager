import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import Login from './Login'

function Root() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('npm_auth_token')
  );

  useEffect(() => {
    const handleUnauthorized = () => setIsAuthenticated(false);
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  return isAuthenticated ? (
    <App onLogout={() => {
      localStorage.removeItem('npm_auth_token');
      setIsAuthenticated(false);
    }} />
  ) : (
    <Login onLogin={() => setIsAuthenticated(true)} />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

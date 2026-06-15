import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { path: '/', label: 'Recipes' },
  { path: '/meal-plans', label: 'Meal Plans' },
  { path: '/substitutions', label: 'Substitutions' },
  { path: '/ingredients', label: 'Ingredients' },
  { path: '/import', label: 'Import' },
];

function isActive(pathname: string, itemPath: string) {
  return itemPath === '/' ? pathname === '/' : pathname.startsWith(itemPath);
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  function linkClass(itemPath: string, extra = '') {
    return `text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
      isActive(location.pathname, itemPath)
        ? 'bg-orange-100 text-orange-700'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    } ${extra}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="text-xl font-bold text-gray-900">
            Let Them Cook
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex gap-4">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} className={linkClass(item.path)}>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop user + logout */}
          <div className="hidden sm:flex items-center gap-3">
            {user && <span className="text-sm text-gray-500">{user.email}</span>}
            <button
              onClick={handleLogout}
              className="text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>

          {/* Mobile hamburger toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="sm:hidden text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md p-2"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav id="mobile-nav" className="sm:hidden border-t border-gray-100 px-4 py-2 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={linkClass(item.path, 'block')}
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-2 flex items-center justify-between gap-3">
              {user && <span className="text-sm text-gray-500 truncate">{user.email}</span>}
              <button
                onClick={handleLogout}
                className="text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 shrink-0"
              >
                Log out
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

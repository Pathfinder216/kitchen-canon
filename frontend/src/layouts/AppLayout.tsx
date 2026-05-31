import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { path: '/', label: 'Recipes' },
  { path: '/meal-plans', label: 'Meal Plans' },
  { path: '/substitutions', label: 'Substitutions' },
  { path: '/ingredients', label: 'Ingredients' },
  { path: '/import', label: 'Import' },
];

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="text-xl font-bold text-gray-900">
            Let Them Cook
          </Link>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
                  (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path))
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user && <span className="text-sm text-gray-500 hidden sm:inline">{user.email}</span>}
            <button
              onClick={handleLogout}
              className="text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

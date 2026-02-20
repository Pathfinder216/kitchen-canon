import { Link, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Recipes' },
  { path: '/meal-plans', label: 'Meal Plans' },
  { path: '/import', label: 'Import' },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

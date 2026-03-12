import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Heart, BarChart2, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useLanguage } from '../contexts/LanguageContext';

export default function Layout() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-[#F2F2F7] text-black font-sans selection:bg-blue-200">
      <header className="bg-[#F2F2F7]/80 backdrop-blur-xl px-6 py-4 sticky top-0 z-10 flex items-center justify-between border-b border-black/5">
        <div className="w-8"></div>
        <h1 className="text-xl font-bold tracking-tight text-black text-center">{t('appTitle')}</h1>
        <button 
          onClick={() => navigate('/settings')}
          className="p-2 text-gray-500 hover:text-[#007AFF] hover:bg-gray-200/50 rounded-full transition-colors flex items-center justify-center active:scale-95"
          title={t('settingsTitle')}
        >
          <SettingsIcon size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-black/5 flex justify-around items-center h-[84px] pb-safe">
        <NavLink
          to="/"
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center justify-center w-full h-full space-y-1 text-[10px] font-medium transition-colors active:scale-95",
              isActive ? "text-[#007AFF]" : "text-gray-400 hover:text-gray-600"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Home size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span>{t('navToday')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/preferences"
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center justify-center w-full h-full space-y-1 text-[10px] font-medium transition-colors active:scale-95",
              isActive ? "text-[#007AFF]" : "text-gray-400 hover:text-gray-600"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Heart size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span>{t('navPreferences')}</span>
            </>
          )}
        </NavLink>
        <NavLink
          to="/reports"
          className={({ isActive }) =>
            clsx(
              "flex flex-col items-center justify-center w-full h-full space-y-1 text-[10px] font-medium transition-colors active:scale-95",
              isActive ? "text-[#007AFF]" : "text-gray-400 hover:text-gray-600"
            )
          }
        >
          {({ isActive }) => (
            <>
              <BarChart2 size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span>{t('navReports')}</span>
            </>
          )}
        </NavLink>
      </nav>
    </div>
  );
}

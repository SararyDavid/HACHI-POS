import React from 'react';
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Cpu,
  Lock,
  User
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  cartCount = 0,
  cashierName = 'Alex S.',
  onOpenPinModal
}) {
  const navItems = [
    { id: 'pos', label: 'POS Terminal', icon: ShoppingCart, badge: cartCount },
    { id: 'inventory', label: 'Inventory & Stock', icon: Package },
    { id: 'sales', label: 'Sales & Reports', icon: BarChart3 }
  ];

  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-4 bg-white/90 backdrop-blur-xs border-b border-sky-100 z-30 shadow-xs no-print w-full">
      {/* Brand Logo & Title with Hachi Mascot */}
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-sky-300 bg-white shadow-xs flex items-center justify-center">
          <img src="/hachi.jpg" alt="Hachi" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-base tracking-tight text-slate-800">
              HACHI<span className="text-sky-500">TECH</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
              POS v2.4
            </span>
          </div>
          <p className="text-[10px] text-slate-400 hidden sm:block leading-none">Retail Hardware & IT Solutions</p>
        </div>
      </div>

      {/* Navigation View Switcher */}
      <nav className="flex items-center p-0.5 bg-sky-50/80 rounded-2xl border border-sky-100">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive 
                  ? 'bg-white text-sky-600 shadow-xs border border-sky-200/60 font-bold' 
                  : 'text-slate-600 hover:text-sky-600 hover:bg-white/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-500' : 'text-slate-400'}`} />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Cashier Sign-In & Lock */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenPinModal}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-slate-700 text-xs font-bold border border-sky-200/80 transition-all cursor-pointer shadow-2xs"
          title="Switch Cashier / Lock Terminal"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="hidden sm:inline">{cashierName}</span>
          <Lock className="w-3 h-3 text-slate-400 ml-0.5" />
        </button>
      </div>
    </header>
  );
}

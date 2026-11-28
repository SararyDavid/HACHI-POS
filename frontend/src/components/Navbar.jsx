import React from 'react';
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Lock
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
    <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-surface border-b border-border z-30 shadow-soft no-print w-full">
      {/* Brand Logo & Title with Hachi Mascot */}
      <div className="flex items-center space-x-3">
        {/* Mascot logo on a white rounded tile with 1.5px brand-100 ring and very soft blue glow */}
        <div className="w-9 h-9 rounded-xl overflow-hidden bg-surface ring-[1.5px] ring-brand-100 shadow-brand-glow flex items-center justify-center p-0.5 shrink-0">
          <img src="/hachi.jpg" alt="Hachi" className="w-full h-full object-cover rounded-lg" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-base tracking-tight text-txt-900">
              HACHI<span className="text-brand-600">TECH</span>
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-pill bg-canvas text-txt-600 font-medium border border-border">
              POS v2.4
            </span>
          </div>
          <p className="text-[10px] text-txt-400 hidden sm:block leading-none mt-0.5">Retail Hardware & IT Solutions</p>
        </div>
      </div>

      {/* Navigation View Switcher */}
      <nav className="flex items-center p-1 bg-canvas rounded-xl border border-border">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-btn text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive 
                  ? 'bg-brand-50 text-brand-600 font-bold border border-brand-100 shadow-xs' 
                  : 'text-txt-600 hover:text-brand-600 hover:bg-surface/80'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-600' : 'text-txt-400'}`} />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-pill bg-brand-600 text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Cashier User Pill */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onOpenPinModal}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-btn bg-surface hover:bg-canvas text-txt-900 text-xs font-semibold border border-border transition-all cursor-pointer shadow-soft"
          title="Switch Cashier / Lock Terminal"
        >
          <span className="w-2 h-2 rounded-full bg-success-600"></span>
          <span className="hidden sm:inline">{cashierName}</span>
          <Lock className="w-3.5 h-3.5 text-txt-400 ml-0.5" />
        </button>
      </div>
    </header>
  );
}

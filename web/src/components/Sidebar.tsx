'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  HardHat, 
  Layers, 
  MessageSquare, 
  History, 
  AlertTriangle, 
  BarChart3, 
  Settings,
  LogOut,
  X
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: HardHat, label: 'Obras', href: '/obras' },
  { icon: Layers, label: 'Fases', href: '/fases' },
  { icon: MessageSquare, label: 'Perguntas', href: '/perguntas' },
  { icon: History, label: 'Histórico', href: '/historico' },
  { icon: AlertTriangle, label: 'Alertas', href: '/alertas' },
  { icon: BarChart3, label: 'Relatórios', href: '/relatorios' },
  { icon: Settings, label: 'Configurações', href: '/configuracoes' },
];

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop de fundo escuro para fechar o menu no mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-full flex-col px-3 py-4">
          <div className="mb-8 flex items-center px-4">
            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <HardHat size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Obra<span className="text-indigo-600">SaaS</span>
            </span>
            
            {/* Botão de Fechar no Mobile */}
            <button
              onClick={onClose}
              className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Fechar Menu"
            >
              <X size={18} />
            </button>
          </div>
          
          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-100 pt-4">
            <button className="flex w-full items-center rounded-lg px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600">
              <LogOut className="mr-3 h-5 w-5 text-slate-400" />
              Sair do Sistema
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

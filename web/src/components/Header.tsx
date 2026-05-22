'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, Search, Settings, UserPlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de perfil ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const applySearch = () => {
    const params = new URLSearchParams(searchParams);
    if (searchQuery) {
      params.set('q', searchQuery);
    } else {
      params.delete('q');
    }
    router.replace(`?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applySearch();
    }
  };

  return (
    <header className="fixed top-0 z-30 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md lg:pl-64">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        <div className="flex flex-1 items-center">
          <div className="relative w-full max-w-md lg:max-w-xs">
            <button 
              onClick={applySearch}
              className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-emerald-600 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              className="block w-full rounded-full border-0 bg-slate-100 py-1.5 pl-10 pr-3 text-sm text-slate-900 ring-1 ring-inset ring-transparent transition-all placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-emerald-600"
              placeholder="Buscar obras..."
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            aria-label="Notificações"
            className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-600"
          >
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>
          
          <div className="relative flex items-center border-l border-slate-200 pl-4" ref={profileRef}>
            <div className="mr-3 text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900">Eng. João Silva</p>
              <p className="text-xs text-slate-500">Administrador</p>
            </div>
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              aria-label="Menu do Usuário"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:ring-2 hover:ring-emerald-600 hover:ring-offset-2 transition-all"
            >
              <User size={20} />
            </button>

            {/* Menu Dropdown do Perfil */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-100 bg-white p-2 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="px-3 py-2 border-b border-slate-100 mb-2">
                  <p className="text-sm font-medium text-slate-900">João Silva</p>
                  <p className="text-xs text-slate-500 truncate">joao.silva@obrasaas.com</p>
                </div>
                
                <div className="space-y-1">
                  <button 
                    onClick={() => { setIsProfileMenuOpen(false); /* Ação futura */ }}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="mr-3 h-4 w-4 text-slate-400" />
                    Visualizar Perfil
                  </button>
                  
                  <button 
                    onClick={() => { setIsProfileMenuOpen(false); /* Ação futura */ }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <UserPlus className="mr-3 h-4 w-4 text-emerald-500" />
                      <span>Cadastrar Novo Adm</span>
                    </div>
                  </button>
                </div>

                <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-600">Limite de Administradores</span>
                    <span className="text-xs font-bold text-emerald-600">1 / 10</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[10%]"></div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 text-right">9 vagas disponíveis</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

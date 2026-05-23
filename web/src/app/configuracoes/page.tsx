'use client';

import React, { useState } from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  MessageSquare, 
  Database, 
  CreditCard, 
  Check, 
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState('assinatura');

  const menuItems = [
    { id: 'perfil', icon: User, label: 'Perfil' },
    { id: 'assinatura', icon: CreditCard, label: 'Plano e Assinatura' },
    { id: 'whatsapp', icon: MessageSquare, label: 'Integração WhatsApp' },
    { id: 'notificacoes', icon: Bell, label: 'Notificações' },
    { id: 'seguranca', icon: Shield, label: 'Segurança' },
  ];

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-2">
          <ArrowLeft size={16} /> Voltar ao Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500">Gerencie sua empresa, usuários e planos.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Menu Lateral */}
        <div className="lg:col-span-1 space-y-1">
          {menuItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Conteúdo Dinâmico */}
        <div className="lg:col-span-3">
          {activeTab === 'assinatura' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Seu Plano Atual</h3>
                    <p className="text-sm text-slate-500">Você está no plano <span className="font-bold text-indigo-600">Profissional</span></p>
                  </div>
                  <span className="px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold ring-2 ring-indigo-50">
                    Ativo até 12/06/2026
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Uso de Obras</p>
                    <p className="text-xl font-black text-slate-900 mt-1">8 / 15</p>
                    <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: '53%' }}></div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Usuários</p>
                    <p className="text-xl font-black text-slate-900 mt-1">4 / 10</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Valor Mensal</p>
                    <p className="text-xl font-black text-slate-900 mt-1">R$ 299,00</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-2xl border-2 border-indigo-600 bg-white p-6 shadow-md relative">
                   <div className="absolute -top-3 left-6 bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full">RECOMENDADO</div>
                   <h4 className="text-lg font-bold text-slate-900">Profissional</h4>
                   <p className="text-3xl font-black text-slate-900 mt-2">R$ 299<span className="text-sm font-normal text-slate-400">/mês</span></p>
                   <ul className="mt-6 space-y-3">
                     {[ 'Até 15 obras', 'Usuários ilimitados', 'Relatórios Executivos', 'Suporte WhatsApp 24/7' ].map((feat) => (
                       <li key={feat} className="flex items-center text-sm text-slate-600">
                         <Check size={16} className="text-indigo-600 mr-2" /> {feat}
                       </li>
                     ))}
                   </ul>
                   <button disabled className="mt-8 w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-400 cursor-not-allowed">Seu Plano Atual</button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
                   <h4 className="text-lg font-bold text-slate-900">Enterprise</h4>
                   <p className="text-3xl font-black text-slate-900 mt-2">R$ 999<span className="text-sm font-normal text-slate-400">/mês</span></p>
                   <ul className="mt-6 space-y-3">
                     {[ 'Obras Ilimitadas', 'Branding Customizado', 'API de Integração', 'Consultoria Técnica' ].map((feat) => (
                       <li key={feat} className="flex items-center text-sm text-slate-600">
                         <Check size={16} className="text-indigo-600 mr-2" /> {feat}
                       </li>
                     ))}
                   </ul>
                   <button className="mt-8 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors">Fazer Upgrade</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
             <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Integração WhatsApp (Evolution API)</h3>
                <p className="text-sm text-slate-500 mb-8">Conecte sua instância da Evolution API para habilitar o acompanhamento automático das obras.</p>
                {/* ... (campos anteriores) ... */}
                <button className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors">Testar Conexão</button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

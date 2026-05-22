import React from 'react';
import { HardHat, Mail, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
            <HardHat size={28} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bem-vindo de volta</h1>
          <p className="mt-2 text-slate-500">Acesse sua conta para gerenciar suas obras</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <form className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">E-mail Corporativo</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-slate-900 transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-700">Senha</label>
                <Link href="#" className="text-xs font-semibold text-emerald-600 hover:underline">Esqueceu a senha?</Link>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  className="block w-full rounded-xl border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-slate-900 transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <label htmlFor="remember" className="ml-2 block text-sm text-slate-600">
                Lembrar neste dispositivo
              </label>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
            >
              Entrar no Sistema
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500">
            Ainda não tem uma conta?{' '}
            <Link href="#" className="font-bold text-slate-900 hover:underline">Solicite acesso</Link>
          </div>
        </div>
        
        <p className="mt-8 text-center text-xs text-slate-400">
          &copy; 2026 ObraSaaS v1.0. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

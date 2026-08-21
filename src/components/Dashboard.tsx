import React, { useMemo } from 'react';
import { ClipboardList, PlusCircle, Clock, CheckCircle2, Users, Cross } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/lanDatabase';
import { User, Formula } from '../types';
import { useData } from '../hooks/useData';

export function Dashboard({ user, onNavigate }: { user: User; onNavigate: (tab: any) => void }) {
  const { data: customers } = useData(() => db.customers.list());
  const { data: insumos } = useData(() => db.insumos.list());
  const { data: formulas } = useData(() => db.formulas.list());
  const pendingFormulas = useMemo(() => (formulas ?? []).filter((f: Formula) => f.status === 'pending').length, [formulas]);
  const confirmedFormulas = useMemo(() => (formulas ?? []).filter((f: Formula) => f.status === 'confirmed' || f.status === 'completed').length, [formulas]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-zinc-900">Bem-vindo, {user.name}</h2>
        <p className="text-zinc-500">Aqui está o que está acontecendo na farmácia hoje.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard icon={<ClipboardList className="text-blue-600" />} label="Fórmulas Totais" value={formulas?.length ?? 0} color="bg-blue-50" />
        <StatCard icon={<Clock className="text-red-600" />} label="Pendentes" value={pendingFormulas} color="bg-red-50" />
        <StatCard icon={<CheckCircle2 className="text-emerald-600" />} label="Confirmadas" value={confirmedFormulas} color="bg-emerald-50" />
        <StatCard icon={<Users className="text-purple-600" />} label="Clientes" value={customers?.length ?? 0} color="bg-purple-50" />
        <StatCard icon={<Cross className="text-red-700" />} label="Insumos" value={insumos?.length ?? 0} color="bg-red-50" />
      </div>
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm max-w-2xl">
        <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-3 gap-4">
          <QuickActionButton icon={<PlusCircle />} label="Nova Fórmula" onClick={() => onNavigate('recipe')} color="pf-orange" />
          <QuickActionButton icon={<Clock />} label="Pendentes" onClick={() => onNavigate('pending')} color="bg-zinc-800" />
          <QuickActionButton icon={<CheckCircle2 />} label="Confirmadas" onClick={() => onNavigate('confirmed')} color="bg-zinc-800" />
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>{icon}</div>
      <div><p className="text-sm text-zinc-500 font-medium">{label}</p><p className="text-2xl font-bold text-zinc-900">{value}</p></div>
    </div>
  );
}

function QuickActionButton({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  const isPfOrange = color === 'pf-orange';
  return (
    <button
      onClick={onClick}
      style={isPfOrange ? { background: 'linear-gradient(135deg, #C5243E, #9B1A2E)' } : undefined}
      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl text-white transition-transform hover:scale-[1.02] active:scale-[0.98] hover:opacity-90 ${isPfOrange ? '' : color}`}>
      {icon}<span className="font-medium">{label}</span>
    </button>
  );
}
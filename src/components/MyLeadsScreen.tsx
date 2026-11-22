import React, { useState } from 'react';
import {
  Users,
  LayoutGrid,
  List,
  Download,
  Search,
  Filter,
  Phone,
  Globe,
  Trash2,
  Calendar,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Send,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { BusinessItem, LeadStatus } from '../types';
import { OpportunityScoreBadge } from './OpportunityScoreBadge';
import { exportLeadsToCsv, updateLeadStatus, deleteLead } from '../services/storage';

const PIPELINE_STATUSES: { id: LeadStatus; label: string; color: string; badgeBg: string }[] = [
  { id: 'nuevo', label: 'Nuevo', color: 'border-slate-500 text-slate-300', badgeBg: 'bg-slate-800' },
  { id: 'analizado', label: 'Analizado', color: 'border-[#7d39eb] text-[#b9a0ff]', badgeBg: 'bg-[#7d39eb]/30' },
  { id: 'contactado', label: 'Contactado', color: 'border-amber-500 text-amber-400', badgeBg: 'bg-amber-950/60' },
  { id: 'respondio', label: 'Respondió', color: 'border-purple-400 text-purple-300', badgeBg: 'bg-purple-950/60' },
  { id: 'reunion', label: 'Reunión', color: 'border-cyan-400 text-cyan-300', badgeBg: 'bg-cyan-950/60' },
  { id: 'cliente', label: 'Cliente', color: 'border-[#c6ff33] text-[#c6ff33]', badgeBg: 'bg-[#c6ff33]/20' },
  { id: 'descartado', label: 'Descartado', color: 'border-rose-500 text-rose-400', badgeBg: 'bg-rose-950/60' },
];

interface Props {
  leads: BusinessItem[];
  onSelectBusiness: (business: BusinessItem) => void;
  onRefreshLeads: () => void;
}

export const MyLeadsScreen: React.FC<Props> = ({
  leads,
  onSelectBusiness,
  onRefreshLeads,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Categories present in saved leads
  const existingCategories = Array.from(new Set(leads.map((l) => l.category))).filter(Boolean);

  const filteredLeads = leads.filter((lead) => {
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && lead.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = lead.name.toLowerCase().includes(q);
      const matchAddr = lead.address.toLowerCase().includes(q);
      const matchPhone = (lead.phone || '').includes(q);
      const matchEmail = (lead.email || '').toLowerCase().includes(q);
      const matchNotes = (lead.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchAddr && !matchPhone && !matchEmail && !matchNotes) return false;
    }
    return true;
  });

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    updateLeadStatus(leadId, newStatus);
    onRefreshLeads();
  };

  const handleDelete = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Eliminar este negocio de tus leads guardados?')) {
      deleteLead(leadId);
      onRefreshLeads();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#000000] text-white">
      {/* Header */}
      <div className="p-6 border-b border-white/10 bg-white/[0.02] backdrop-blur-md shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#c6ff33]" />
              <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Mis Leads Guardados</span>
                <span className="text-xs font-mono font-bold bg-[#7d39eb]/30 text-[#b9a0ff] px-2.5 py-0.5 rounded-full border border-[#7d39eb]/40">
                  {leads.length}
                </span>
                <span className="font-serif italic text-[#b9a0ff] font-normal text-sm ml-1">Pipeline Comercial</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Gestiona el ciclo de prospección, fases de contacto y notas privadas para cada negocio.
            </p>
          </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
            {/* Export CSV button */}
            <button
              type="button"
              onClick={() => exportLeadsToCsv(filteredLeads)}
              disabled={leads.length === 0}
              className="px-4 py-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-30 shadow-md"
            >
              <Download className="w-3.5 h-3.5 text-[#c6ff33]" />
              <span>Exportar CSV ({filteredLeads.length})</span>
            </button>

            {/* View Switcher */}
            <div className="flex items-center border border-white/10 rounded-xl bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  viewMode === 'kanban' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Tablero Kanban"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  viewMode === 'table' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Tabla de leads"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="px-6 py-2.5 border-b border-white/10 bg-white/[0.01] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 relative z-20">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono o notas..."
              className="bg-black/60 border border-white/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 w-64 focus:outline-none focus:border-[#7d39eb]"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] font-medium">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#7d39eb]"
            >
              <option value="all">Todos los estados</option>
              {PIPELINE_STATUSES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          {existingCategories.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-medium">Categoría:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white capitalize focus:outline-none focus:border-[#7d39eb]"
              >
                <option value="all">Todas las categorías</option>
                {existingCategories.map((c) => (
                  <option key={c} value={c} className="capitalize">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-400">
          Mostrando <strong className="text-white font-mono">{filteredLeads.length}</strong> de {leads.length} leads
        </span>
      </div>

      {/* Main Content View */}
      <div
        className={`flex-1 min-h-0 p-6 ${
          viewMode === 'kanban' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {leads.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center p-8 border border-white/10 rounded-3xl bg-white/[0.02] max-w-md mx-auto mt-8 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#7d39eb]/20 border border-[#7d39eb]/40 flex items-center justify-center text-[#c6ff33] mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Aún no tienes leads guardados</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ve a la sección «Buscar», selecciona negocios locales que te interesen y pulsa «Guardar en leads» para iniciar tu prospección.
            </p>
          </div>
        ) : viewMode === 'kanban' ? (
          /* KANBAN BOARD VIEW */
          <div className="flex gap-4 overflow-x-auto pb-2 flex-1 min-h-0 items-stretch">
            {PIPELINE_STATUSES.map((column) => {
              const columnLeads = filteredLeads.filter((l) => l.status === column.id);

              return (
                <div
                  key={column.id}
                  className="w-72 shrink-0 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md flex flex-col h-full max-h-full shadow-lg overflow-hidden"
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-white/10 flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full border ${column.color}`} />
                      <span>{column.label}</span>
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${column.badgeBg} text-white`}>
                      {columnLeads.length}
                    </span>
                  </div>

                  {/* Cards container */}
                  <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-0 kanban-scrollbar pr-2">
                    {columnLeads.length === 0 ? (
                      <div className="h-24 flex flex-col items-center justify-center text-center p-3 text-slate-500 text-[11px] border border-dashed border-white/5 rounded-xl">
                        Sin leads en esta fase
                      </div>
                    ) : (
                      columnLeads.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => onSelectBusiness(item)}
                          className="p-3.5 rounded-xl border border-white/10 bg-white/[0.04] hover:border-[#7d39eb]/60 hover:bg-white/[0.07] transition-all cursor-pointer space-y-2 group shadow-sm"
                        >
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-bold text-xs text-white group-hover:text-[#b9a0ff] transition-colors leading-tight truncate">
                            {item.name}
                          </h4>
                          <OpportunityScoreBadge
                            score={item.detailedOpportunityScore || item.provisionalOpportunityScore}
                            breakdown={item.opportunityBreakdown}
                            isDetailed={!!item.detailedOpportunityScore}
                            size="sm"
                          />
                        </div>

                        <div className="text-[11px] text-[#b9a0ff] truncate">
                          {item.category}
                        </div>

                        {/* Phone & Web */}
                        <div className="text-[11px] text-slate-300 space-y-0.5">
                          {item.phone && (
                            <div className="flex items-center gap-1 font-mono">
                              <Phone className="w-2.5 h-2.5 text-[#c6ff33]" />
                              <span>{item.phone}</span>
                            </div>
                          )}
                          <div>
                            {item.websiteUri ? (
                              item.isSocialOrDirectoryWebsite ? (
                                <span className="text-[10px] text-amber-300 font-medium bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                  Solo red/directorio
                                </span>
                              ) : (
                                <span className="text-[#b9a0ff] truncate block text-[10px] hover:underline">
                                  {item.websiteUri.replace(/^https?:\/\//, '')}
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-rose-300 font-bold bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                                Sin web
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Internal Notes Preview */}
                        {item.notes && (
                          <div className="text-[10px] text-slate-300 italic bg-black/40 border border-white/5 p-2 rounded-lg truncate">
                            «{item.notes}»
                          </div>
                        )}

                        {/* Next Action Date */}
                        {item.nextActionDate && (
                          <div className="text-[10px] text-[#b9a0ff] flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-[#c6ff33]" />
                            <span>{item.nextActionDate}</span>
                          </div>
                        )}

                        {/* Quick Status Mover Dropdown & Delete */}
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                          <select
                            value={item.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStatusChange(item.id, e.target.value as LeadStatus)}
                            className="bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-[#7d39eb]"
                          >
                            {PIPELINE_STATUSES.map((st) => (
                              <option key={st.id} value={st.id}>
                                Mover a: {st.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={(e) => handleDelete(item.id, e)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                            title="Eliminar de leads"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {item.savedAt && (
                          <div className="flex items-center justify-end text-[10px] pt-1.5 border-t border-white/5">
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(item.savedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="border border-white/10 rounded-2xl overflow-x-auto bg-white/[0.02] backdrop-blur-md">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] font-semibold text-slate-400">
                  <th className="p-3.5">Negocio</th>
                  <th className="p-3.5">Categoría</th>
                  <th className="p-3.5">Teléfono</th>
                  <th className="p-3.5">Web</th>
                  <th className="p-3.5">Oportunidad</th>
                  <th className="p-3.5">Fase Comercial</th>
                  <th className="p-3.5">Próxima Acción</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLeads.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#7d39eb]/10 transition-colors cursor-pointer"
                      onClick={() => onSelectBusiness(item)}
                    >

                      <td className="p-3.5">
                        <div className="font-bold text-white hover:text-[#b9a0ff] transition-colors">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {item.address}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-300">{item.category}</td>

                      <td className="p-3.5 whitespace-nowrap">
                        {item.phone ? (
                          <a
                            href={`tel:${item.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-slate-200 hover:text-[#c6ff33] inline-flex items-center gap-1 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-[#c6ff33]" />
                            <span>{item.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {item.websiteUri ? (
                          item.isSocialOrDirectoryWebsite ? (
                            <span className="text-[10px] text-amber-300 font-medium bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                              Red/directorio
                            </span>
                          ) : (
                            <a
                              href={item.websiteUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#b9a0ff] hover:text-[#c6ff33] hover:underline truncate max-w-[140px] inline-flex items-center gap-1 transition-colors"
                            >
                              <span className="truncate">{item.websiteUri.replace(/^https?:\/\//, '')}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          )
                        ) : (
                          <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                            Sin web
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <OpportunityScoreBadge
                          score={item.detailedOpportunityScore || item.provisionalOpportunityScore}
                          breakdown={item.opportunityBreakdown}
                          isDetailed={!!item.detailedOpportunityScore}
                          size="sm"
                        />
                      </td>

                      <td className="p-3.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as LeadStatus)}
                          className="bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-[#7d39eb]"
                        >
                          {PIPELINE_STATUSES.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                        {item.nextActionDate || '-'}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectBusiness(item)}
                            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-[#7d39eb] text-white text-xs font-semibold cursor-pointer transition-all border border-white/10"
                          >
                            Ficha
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(item.id, e)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

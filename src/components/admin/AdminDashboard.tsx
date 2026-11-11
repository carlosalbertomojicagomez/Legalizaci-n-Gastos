import React, { useState, useMemo } from 'react';
import { Gasto } from '../../types';
import { formatCOP, formatFecha } from '../../utils/validations';
import { exportarGastosAExcel } from '../../utils/excelExporter';
import { CatalogModal } from './CatalogModal';
import {
  FileSpreadsheet,
  Check,
  X,
  Eye,
  Filter,
  DollarSign,
  Layers,
  Settings,
  Calendar,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Cloud,
  QrCode
} from 'lucide-react';

interface Props {
  gastos: Gasto[];
  onActualizarEstado: (id: string, nuevoEstado: 'aprobado' | 'rechazado', comentario?: string) => Promise<void>;
  catalogs: { tiposGasto: string[]; tiposPago: string[] };
  onSaveCatalogs: (tiposGasto: string[], tiposPago: string[]) => Promise<void>;
  onAbrirDrive: () => void;
  onAbrirSheets: () => void;
}

export const AdminDashboard: React.FC<Props> = ({
  gastos,
  onActualizarEstado,
  catalogs,
  onSaveCatalogs,
  onAbrirDrive,
  onAbrirSheets,
}) => {
  // Modales
  const [gastoSeleccionado, setGastoSeleccionado] = useState<Gasto | null>(null);
  const [modalCatalogos, setModalCatalogos] = useState(false);
  const [modalAccion, setModalAccion] = useState<{
    id: string;
    accion: 'aprobado' | 'rechazado';
    emisor: string;
  } | null>(null);
  const [comentarioAccion, setComentarioAccion] = useState('');
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [copiadoCufe, setCopiadoCufe] = useState(false);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroResponsable, setFiltroResponsable] = useState('todos');
  const [filtroTipoGasto, setFiltroTipoGasto] = useState('todos');
  const [filtroTipoPago, setFiltroTipoPago] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busquedaTexto, setBusquedaTexto] = useState('');

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 8;

  // Lista única de responsables para filtro
  const listaResponsables = useMemo(() => {
    const set = new Set<string>();
    gastos.forEach((g) => {
      if (g.nombre_responsable) set.add(g.nombre_responsable);
    });
    return Array.from(set).sort();
  }, [gastos]);

  // Filtrado reactivo de gastos
  const gastosFiltrados = useMemo(() => {
    return gastos.filter((g) => {
      if (filtroEstado !== 'todos' && g.estado !== filtroEstado) return false;
      if (filtroResponsable !== 'todos' && g.nombre_responsable !== filtroResponsable) return false;
      if (filtroTipoGasto !== 'todos' && g.tipo_gasto !== filtroTipoGasto) return false;
      if (filtroTipoPago !== 'todos' && g.tipo_pago !== filtroTipoPago) return false;
      if (fechaDesde && g.fecha_emision < fechaDesde) return false;
      if (fechaHasta && g.fecha_emision > fechaHasta) return false;

      if (busquedaTexto.trim()) {
        const query = busquedaTexto.toLowerCase();
        const coincide =
          (g.emisor && g.emisor.toLowerCase().includes(query)) ||
          (g.numero_factura && g.numero_factura.toLowerCase().includes(query)) ||
          (g.cufe && g.cufe.toLowerCase().includes(query)) ||
          (g.objeto && g.objeto.toLowerCase().includes(query)) ||
          (g.nombre_responsable && g.nombre_responsable.toLowerCase().includes(query));
        if (!coincide) return false;
      }

      return true;
    });
  }, [
    gastos,
    filtroEstado,
    filtroResponsable,
    filtroTipoGasto,
    filtroTipoPago,
    fechaDesde,
    fechaHasta,
    busquedaTexto,
  ]);

  // KPIs
  const sumaTotal = useMemo(
    () => gastosFiltrados.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0),
    [gastosFiltrados]
  );
  const countPendientes = useMemo(
    () => gastosFiltrados.filter((g) => g.estado === 'pendiente').length,
    [gastosFiltrados]
  );
  const countAprobados = useMemo(
    () => gastosFiltrados.filter((g) => g.estado === 'aprobado').length,
    [gastosFiltrados]
  );

  // Totales por tipo de gasto (resumen para auditoría)
  const resumenPorTipoGasto = useMemo(() => {
    const mapa: { [key: string]: number } = {};
    gastosFiltrados.forEach((g) => {
      const tipo = g.tipo_gasto || 'Otro';
      mapa[tipo] = (mapa[tipo] || 0) + (Number(g.total) || 0);
    });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [gastosFiltrados]);

  // Totales por responsable
  const resumenPorResponsable = useMemo(() => {
    const mapa: { [key: string]: { total: number; count: number } } = {};
    gastosFiltrados.forEach((g) => {
      const resp = g.nombre_responsable || 'Sin asignar';
      if (!mapa[resp]) mapa[resp] = { total: 0, count: 0 };
      mapa[resp].total += Number(g.total) || 0;
      mapa[resp].count += 1;
    });
    return Object.entries(mapa).sort((a, b) => b[1].total - a[1].total);
  }, [gastosFiltrados]);

  // Paginación
  const totalPaginas = Math.ceil(gastosFiltrados.length / elementosPorPagina) || 1;
  const gastosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return gastosFiltrados.slice(inicio, inicio + elementosPorPagina);
  }, [gastosFiltrados, paginaActual, elementosPorPagina]);

  const handleEjecutarAccion = async () => {
    if (!modalAccion) return;
    setErrorAccion(null);
    if (modalAccion.accion === 'rechazado' && !comentarioAccion.trim()) {
      setErrorAccion('Debe ingresar un motivo u observación para rechazar la factura.');
      return;
    }

    setProcesandoAccion(true);
    try {
      await onActualizarEstado(modalAccion.id, modalAccion.accion, comentarioAccion.trim());
      setModalAccion(null);
      setComentarioAccion('');
      setErrorAccion(null);
    } catch (err: any) {
      setErrorAccion('Error al actualizar estado: ' + err.message);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const copiarAlPortapapeles = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoCufe(true);
    setTimeout(() => setCopiadoCufe(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Módulo de Auditoría y Fiscalización DIAN
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Panel del Administrador
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Control de legalizaciones operacionales en tiempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setModalCatalogos(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Editar Catálogos</span>
          </button>

          <button
            onClick={onAbrirDrive}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md transition active:scale-95"
            title="Abrir almacenamiento y respaldos en Google Drive"
          >
            <Cloud className="w-4 h-4" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={onAbrirSheets}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md transition active:scale-95"
            title="Sincronizar y gestionar hojas en Google Sheets (Cloud)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Google Sheets</span>
          </button>

          <button
            onClick={() => exportarGastosAExcel(gastosFiltrados)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition active:scale-95"
            title="Exportar hoja con fotos incrustadas"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN (KPIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Total Legalizado
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white">
              {formatCOP(sumaTotal)}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Por Aprobar
            </span>
            <p className="text-lg font-black text-amber-600 dark:text-amber-400">
              {countPendientes} facturas
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Aprobadas
            </span>
            <p className="text-lg font-black text-blue-600 dark:text-blue-400">
              {countAprobados} facturas
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Registros Filtrados
            </span>
            <p className="text-lg font-black text-slate-900 dark:text-white">
              {gastosFiltrados.length} de {gastos.length}
            </p>
          </div>
        </div>
      </div>

      {/* DESGLOSE POR TIPO DE GASTO Y POR RESPONSABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Desglose por Tipo de Gasto */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2 dark:border-slate-700">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Totales por Tipo de Gasto
            </h4>
            <span className="text-[11px] font-mono text-slate-400">{resumenPorTipoGasto.length} categorías</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {resumenPorTipoGasto.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Sin datos disponibles</p>
            ) : (
              resumenPorTipoGasto.map(([tipo, totalTipo]) => {
                const porcentaje = sumaTotal > 0 ? Math.round((totalTipo / sumaTotal) * 100) : 0;
                return (
                  <div key={tipo} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{tipo}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCOP(totalTipo)} <span className="text-[10px] text-slate-400">({porcentaje}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Desglose por Responsable */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2 dark:border-slate-700">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Totales por Responsable
            </h4>
            <span className="text-[11px] font-mono text-slate-400">{resumenPorResponsable.length} funcionarios</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {resumenPorResponsable.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Sin datos disponibles</p>
            ) : (
              resumenPorResponsable.map(([resp, data]) => (
                <div
                  key={resp}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                      {resp.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{resp}</p>
                      <span className="text-[10px] text-slate-400">{data.count} comprobante(s)</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatCOP(data.total)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS AVANZADOS */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filtros Operacionales</span>
          </div>
          {(filtroEstado !== 'todos' ||
            filtroResponsable !== 'todos' ||
            filtroTipoGasto !== 'todos' ||
            filtroTipoPago !== 'todos' ||
            fechaDesde ||
            fechaHasta ||
            busquedaTexto) && (
            <button
              onClick={() => {
                setFiltroEstado('todos');
                setFiltroResponsable('todos');
                setFiltroTipoGasto('todos');
                setFiltroTipoPago('todos');
                setFechaDesde('');
                setFechaHasta('');
                setBusquedaTexto('');
              }}
              className="text-[11px] text-rose-500 hover:underline font-semibold"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Búsqueda rápida */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por emisor, consecutivo, CUFE o justificación..."
            value={busquedaTexto}
            onChange={(e) => {
              setBusquedaTexto(e.target.value);
              setPaginaActual(1);
            }}
            className="w-full text-xs p-2.5 pl-9 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Responsable</label>
            <select
              value={filtroResponsable}
              onChange={(e) => {
                setFiltroResponsable(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="todos">Todos los Responsables</option>
              {listaResponsables.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Tipo de Gasto</label>
            <select
              value={filtroTipoGasto}
              onChange={(e) => {
                setFiltroTipoGasto(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="todos">Todos los Tipos de Gasto</option>
              {catalogs.tiposGasto.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">Medio de Pago</label>
            <select
              value={filtroTipoPago}
              onChange={(e) => {
                setFiltroTipoPago(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="todos">Todos los Medios de Pago</option>
              {catalogs.tiposPago.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rango de Fechas */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>Fechas de emisión:</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => {
              setFechaDesde(e.target.value);
              setPaginaActual(1);
            }}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
          />
          <span>hasta</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => {
              setFechaHasta(e.target.value);
              setPaginaActual(1);
            }}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* TABLA PRINCIPAL CON MINATURAS Y ACCIONES */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Evidencia</th>
                <th className="p-3.5">Fecha</th>
                <th className="p-3.5">Responsable</th>
                <th className="p-3.5">Emisor / Factura</th>
                <th className="p-3.5">Clasificación</th>
                <th className="p-3.5">Total (COP)</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {gastosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No se encontraron comprobantes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                gastosPaginados.map((g) => (
                  <tr
                    key={g.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition"
                  >
                    {/* Miniatura */}
                    <td className="p-3.5">
                      {g.foto_url ? (
                        <button
                          onClick={() => setGastoSeleccionado(g)}
                          className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative group block shadow-sm"
                          title="Ampliar factura y ver CUFE"
                        >
                          <img
                            src={g.foto_url}
                            alt="Evidencia"
                            className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">Sin foto</span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-semibold">{g.fecha_emision}</div>
                      <span className="text-[10px] text-slate-400">
                        Reg: {new Date(g.creado_en).toLocaleDateString('es-CO')}
                      </span>
                    </td>

                    {/* Responsable */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {g.nombre_responsable}
                      </div>
                      <div className="text-[10px] text-slate-400">{g.cargo}</div>
                    </td>

                    {/* Emisor y Consecutivo */}
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {g.emisor}
                      </div>
                      <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                        Fac: {g.numero_factura}
                      </div>
                    </td>

                    {/* Clasificación */}
                    <td className="p-3.5">
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-md font-medium text-[11px] block w-fit mb-0.5">
                        {g.tipo_gasto}
                      </span>
                      <span className="text-[10px] text-slate-400">{g.tipo_pago}</span>
                    </td>

                    {/* Total COP */}
                    <td className="p-3.5 font-black text-slate-900 dark:text-white whitespace-nowrap text-sm">
                      {formatCOP(Number(g.total))}
                    </td>

                    {/* Estado */}
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          g.estado === 'aprobado'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : g.estado === 'rechazado'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {g.estado === 'aprobado' && <CheckCircle2 className="w-3 h-3" />}
                        {g.estado === 'rechazado' && <XCircle className="w-3 h-3" />}
                        {g.estado === 'pendiente' && <Clock className="w-3 h-3" />}
                        {g.estado}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() =>
                            setModalAccion({
                              id: g.id,
                              accion: 'aprobado',
                              emisor: g.emisor,
                            })
                          }
                          className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
                          title="Aprobar legalización"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setModalAccion({
                              id: g.id,
                              accion: 'rechazado',
                              emisor: g.emisor,
                            })
                          }
                          className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition"
                          title="Rechazar legalización"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
          <span>
            Mostrando {gastosPaginados.length} de {gastosFiltrados.length} registros (Página {paginaActual} de {totalPaginas})
          </span>
          <div className="flex gap-2">
            <button
              disabled={paginaActual <= 1}
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              className="p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
            <button
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              className="p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DETALLES Y ZOOM DE FACTURA */}
      {gastoSeleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-zoom-out"
          onClick={() => setGastoSeleccionado(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-5 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 cursor-default max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b pb-3 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                    Comprobante Fiscal DIAN
                  </span>
                  {gastoSeleccionado.confianza_extraccion && (
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                        gastoSeleccionado.confianza_extraccion === 'alta'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      IA: Confianza {gastoSeleccionado.confianza_extraccion}
                    </span>
                  )}
                </div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  {gastoSeleccionado.emisor}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                  <span>Factura: <strong className="text-slate-600 dark:text-slate-200">{gastoSeleccionado.numero_factura}</strong></span>
                  {gastoSeleccionado.nit_emisor && (
                    <span>NIT: <strong className="text-slate-600 dark:text-slate-200">{gastoSeleccionado.nit_emisor}</strong></span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setGastoSeleccionado(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Imagen ampliada con enlace directo al soporte original */}
            {gastoSeleccionado.foto_url && (
              <div className="space-y-1.5">
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center max-h-[50vh] relative group">
                  <img
                    src={gastoSeleccionado.foto_url}
                    alt="Factura original"
                    className="max-h-[50vh] w-auto object-contain"
                  />
                  <a
                    href={gastoSeleccionado.foto_url}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute top-2 right-2 px-2.5 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Ver Original</span>
                  </a>
                </div>
                <span className="text-[10px] text-slate-400 block text-right">
                  Foto física archivada en base de datos contable
                </span>
              </div>
            )}

            {/* Código CUFE 96 hex con botón copiar */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  CUFE DIAN (96 Hexadecimales):
                </span>
                <button
                  onClick={() => copiarAlPortapapeles(gastoSeleccionado.cufe)}
                  className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiadoCufe ? '¡Copiado!' : 'Copiar CUFE'}</span>
                </button>
              </div>
              <p className="font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 select-all">
                {gastoSeleccionado.cufe}
              </p>
            </div>

            {/* Parámetros QR DIAN si existen */}
            {gastoSeleccionado.qr_dian && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                  <QrCode className="w-4 h-4 text-blue-500" />
                  Cadena / Parámetros QR DIAN:
                </span>
                <p className="font-mono text-[9px] text-slate-600 dark:text-slate-300 break-all bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 select-all leading-tight">
                  {gastoSeleccionado.qr_dian}
                </p>
              </div>
            )}

            {/* Desglose contable */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 text-[10px]">Neto:</span>
                <p className="font-bold">{formatCOP(gastoSeleccionado.valor_neto)}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 text-[10px]">IVA Liquidado:</span>
                <p className="font-bold">{formatCOP(gastoSeleccionado.iva)}</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Total:</span>
                <p className="font-black text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatCOP(gastoSeleccionado.total)}
                </p>
              </div>
            </div>

            {/* Justificación y auditoría */}
            <div className="text-xs space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Justificación Operacional:</span>
              <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {gastoSeleccionado.objeto || 'Sin descripción'}
              </p>
            </div>

            {gastoSeleccionado.comentario_aprobacion && (
              <div className="text-xs space-y-1 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                <span className="font-bold">Observación del Auditor:</span>
                <p>{gastoSeleccionado.comentario_aprobacion}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA APROBAR / RECHAZAR CON COMENTARIOS */}
      {modalAccion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setModalAccion(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 dark:border-slate-700">
              <h3 className="font-black text-base">
                {modalAccion.accion === 'aprobado' ? 'Aprobar Legalización' : 'Rechazar Legalización'}
              </h3>
              <button
                onClick={() => setModalAccion(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Factura de <strong>{modalAccion.emisor}</strong>. Ingrese el comentario u observación de auditoría:
            </p>

            <textarea
              rows={3}
              placeholder={
                modalAccion.accion === 'aprobado'
                  ? 'Observación opcional (ej: Comprobante conforme y validado en DIAN)'
                  : 'Motivo obligatorio del rechazo (ej: Monto no coincide con soporte / CUFE ilegible)'
              }
              value={comentarioAccion}
              onChange={(e) => setComentarioAccion(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
            />

            {errorAccion && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                {errorAccion}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalAccion(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleEjecutarAccion}
                disabled={procesandoAccion}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 ${
                  modalAccion.accion === 'aprobado'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {procesandoAccion ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    {modalAccion.accion === 'aprobado' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    <span>Confirmar {modalAccion.accion}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CATÁLOGOS */}
      <CatalogModal
        isOpen={modalCatalogos}
        onClose={() => setModalCatalogos(false)}
        catalogs={catalogs}
        onSave={onSaveCatalogs}
      />
    </div>
  );
};

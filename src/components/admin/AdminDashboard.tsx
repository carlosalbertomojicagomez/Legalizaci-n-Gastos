import React, { useState, useMemo } from 'react';
import { Gasto } from '../../types';
import { formatCOP } from '../../utils/validations';
import { exportarGastosAExcel } from '../../utils/excelExporter';
import { CatalogModal } from './CatalogModal';
import { SecureImage } from '../common/SecureImage';
import {
  FileSpreadsheet,
  Check,
  X,
  Eye,
  DollarSign,
  Layers,
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
  QrCode,
  Users,
  MessageSquare,
  ArrowUpDown,
  Filter,
  FileCode2,
  FileText
} from 'lucide-react';

interface Props {
  gastos: Gasto[];
  onActualizarEstado: (id: string, nuevoEstado: 'aprobado' | 'rechazado', comentario?: string) => Promise<void>;
  catalogs: { tiposGasto: string[]; tiposPago: string[] };
  onSaveCatalogs: (tiposGasto: string[], tiposPago: string[]) => Promise<void>;
  onAbrirDrive: () => void;
  onAbrirSheets: () => void;
  onAbrirChat?: (gasto?: Gasto) => void;
  onAbrirUsuarios?: () => void;
}

export const AdminDashboard: React.FC<Props> = ({
  gastos,
  onActualizarEstado,
  catalogs,
  onSaveCatalogs,
  onAbrirDrive,
  onAbrirSheets,
  onAbrirChat,
  onAbrirUsuarios,
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
  const [mostrarRawIa, setMostrarRawIa] = useState(false);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroResponsable, setFiltroResponsable] = useState('todos');
  const [filtroTipoGasto, setFiltroTipoGasto] = useState('todos');
  const [filtroTipoPago, setFiltroTipoPago] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busquedaTexto, setBusquedaTexto] = useState('');

  // Ordenamiento
  const [ordenColumna, setOrdenColumna] = useState<'fecha' | 'total' | 'emisor' | 'estado'>('fecha');
  const [ordenDireccion, setOrdenDireccion] = useState<'asc' | 'desc'>('desc');

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
          (g.nombre_responsable && g.nombre_responsable.toLowerCase().includes(query)) ||
          (g.nit_emisor && g.nit_emisor.toLowerCase().includes(query));
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

  // Ordenamiento reactivo
  const gastosOrdenados = useMemo(() => {
    const list = [...gastosFiltrados];
    list.sort((a, b) => {
      let valA: any = a.creado_en;
      let valB: any = b.creado_en;

      if (ordenColumna === 'total') {
        valA = Number(a.total) || 0;
        valB = Number(b.total) || 0;
      } else if (ordenColumna === 'emisor') {
        valA = (a.emisor || '').toLowerCase();
        valB = (b.emisor || '').toLowerCase();
      } else if (ordenColumna === 'estado') {
        valA = a.estado;
        valB = b.estado;
      }

      if (valA < valB) return ordenDireccion === 'asc' ? -1 : 1;
      if (valA > valB) return ordenDireccion === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [gastosFiltrados, ordenColumna, ordenDireccion]);

  // Paginación
  const totalPaginas = Math.ceil(gastosOrdenados.length / elementosPorPagina) || 1;
  const gastosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return gastosOrdenados.slice(inicio, inicio + elementosPorPagina);
  }, [gastosOrdenados, paginaActual]);

  // KPIs reales
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
  const countRechazados = useMemo(
    () => gastosFiltrados.filter((g) => g.estado === 'rechazado').length,
    [gastosFiltrados]
  );

  // Totales por tipo de gasto (gráfico / barras)
  const resumenPorTipoGasto = useMemo(() => {
    const mapa: { [key: string]: number } = {};
    gastosFiltrados.forEach((g) => {
      const tipo = g.tipo_gasto || 'Otro';
      mapa[tipo] = (mapa[tipo] || 0) + (Number(g.total) || 0);
    });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [gastosFiltrados]);

  // Copiar CUFE al portapapeles
  const copiarAlPortapapeles = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoCufe(true);
    setTimeout(() => setCopiadoCufe(false), 2000);
  };

  const handleEjecutarAccion = async () => {
    if (!modalAccion) return;

    if (modalAccion.accion === 'rechazado' && !comentarioAccion.trim()) {
      setErrorAccion('El motivo de rechazo es obligatorio para auditar la legalización.');
      return;
    }

    setProcesandoAccion(true);
    setErrorAccion(null);

    try {
      await onActualizarEstado(modalAccion.id, modalAccion.accion, comentarioAccion);
      setModalAccion(null);
      setComentarioAccion('');
      if (gastoSeleccionado && gastoSeleccionado.id === modalAccion.id) {
        setGastoSeleccionado({
          ...gastoSeleccionado,
          estado: modalAccion.accion,
          comentario_aprobacion: comentarioAccion,
        });
      }
    } catch (err: any) {
      setErrorAccion(err.message || 'Error al procesar la auditoría');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const toggleOrden = (columna: 'fecha' | 'total' | 'emisor' | 'estado') => {
    if (ordenColumna === columna) {
      setOrdenDireccion((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrdenColumna(columna);
      setOrdenDireccion('desc');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Barra superior de herramientas y accesos rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#07426B] dark:text-blue-400">
            Panel de Auditoría Fiscal
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Resumen General de Legalizaciones
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onAbrirUsuarios && (
            <button
              onClick={onAbrirUsuarios}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
            >
              <Users className="w-4 h-4 text-[#07426B] dark:text-blue-400" />
              <span>Usuarios y Roles</span>
            </button>
          )}

          <button
            onClick={() => setModalCatalogos(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
          >
            <Layers className="w-4 h-4 text-[#07426B] dark:text-blue-400" />
            <span>Catálogos</span>
          </button>

          <button
            onClick={() => exportarGastosAExcel(gastosFiltrados)}
            disabled={gastosFiltrados.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[#07426B] hover:bg-[#052F4D] text-white font-bold text-xs shadow-md transition disabled:opacity-40"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#2CAE4A]" />
            <span>Descargar Excel con Evidencias</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Reales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-slate-400 text-xs font-semibold">Valor Acumulado</span>
          <div className="text-lg sm:text-2xl font-black text-[#07426B] dark:text-blue-400 tracking-tight">
            ${formatCOP(sumaTotal)}
          </div>
          <span className="text-[10px] text-slate-400 block">
            {gastosFiltrados.length} facturas filtradas
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
            <span>Pendientes</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400">
            {countPendientes}
          </div>
          <span className="text-[10px] text-slate-400 block">Por auditar</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
            <span>Aprobadas</span>
            <CheckCircle2 className="w-4 h-4 text-[#2CAE4A]" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-[#2CAE4A]">
            {countAprobados}
          </div>
          <span className="text-[10px] text-slate-400 block">Conformes con DIAN</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
            <span>Rechazadas</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400">
            {countRechazados}
          </div>
          <span className="text-[10px] text-slate-400 block">Requieren corrección</span>
        </div>
      </div>

      {/* Gráfico / Barras de Gasto por Tipo */}
      {resumenPorTipoGasto.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Distribución por Tipo de Gasto
          </h3>
          <div className="space-y-2">
            {resumenPorTipoGasto.slice(0, 5).map(([tipo, monto]) => {
              const porcentaje = sumaTotal > 0 ? (monto / sumaTotal) * 100 : 0;
              return (
                <div key={tipo} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{tipo}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ${formatCOP(monto)} ({porcentaje.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#07426B] to-[#2CAE4A] rounded-full transition-all duration-500"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por emisor, NIT, factura, CUFE, responsable o justificación..."
              value={busquedaTexto}
              onChange={(e) => {
                setBusquedaTexto(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full text-xs p-2.5 pl-9 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPaginaActual(1);
              }}
              className="text-xs p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-semibold"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobado">Aprobadas</option>
              <option value="rechazado">Rechazadas</option>
            </select>

            <select
              value={filtroTipoGasto}
              onChange={(e) => {
                setFiltroTipoGasto(e.target.value);
                setPaginaActual(1);
              }}
              className="text-xs p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-semibold"
            >
              <option value="todos">Todos los Tipos</option>
              {catalogs.tiposGasto.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {listaResponsables.length > 0 && (
              <select
                value={filtroResponsable}
                onChange={(e) => {
                  setFiltroResponsable(e.target.value);
                  setPaginaActual(1);
                }}
                className="text-xs p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-semibold"
              >
                <option value="todos">Todos los Responsables</option>
                {listaResponsables.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE FACTURAS CON MINATURAS Y ACCIONES */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Evidencia</th>
                <th
                  onClick={() => toggleOrden('fecha')}
                  className="p-3.5 cursor-pointer hover:text-[#07426B] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Fecha</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5">Responsable</th>
                <th
                  onClick={() => toggleOrden('emisor')}
                  className="p-3.5 cursor-pointer hover:text-[#07426B] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Emisor / NIT</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5">Clasificación</th>
                <th
                  onClick={() => toggleOrden('total')}
                  className="p-3.5 cursor-pointer hover:text-[#07426B] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Total (COP)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleOrden('estado')}
                  className="p-3.5 cursor-pointer hover:text-[#07426B] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Estado</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {gastosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                      No hay comprobantes para mostrar
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {gastos.length === 0
                        ? 'Aún no se han radicado facturas en el sistema. Los trabajadores pueden registrarlas desde el módulo de captura.'
                        : 'No se encontraron gastos con los filtros aplicados. Intente ajustar el texto de búsqueda o los filtros.'}
                    </p>
                  </td>
                </tr>
              ) : (
                gastosPaginados.map((g) => (
                  <tr
                    key={g.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    {/* Miniatura Protegida */}
                    <td className="p-3.5">
                      {g.foto_url ? (
                        <button
                          type="button"
                          onClick={() => setGastoSeleccionado(g)}
                          className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative group block shadow-sm"
                          title="Ampliar factura y ver CUFE"
                        >
                          <SecureImage
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
                      <div className="font-bold text-slate-900 dark:text-white">
                        {g.fecha_emision}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(g.creado_en).toLocaleDateString('es-CO')}
                      </span>
                    </td>

                    {/* Responsable */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {g.nombre_responsable}
                      </div>
                      <div className="text-[10px] text-slate-400">{g.cargo}</div>
                    </td>

                    {/* Emisor y NIT */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {g.emisor}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>Fac: <strong>{g.numero_factura}</strong></span>
                        {g.nit_emisor && <span>| NIT: {g.nit_emisor}</span>}
                      </div>
                    </td>

                    {/* Clasificación */}
                    <td className="p-3.5">
                      <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {g.tipo_gasto}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="p-3.5 whitespace-nowrap font-mono font-black text-sm text-[#07426B] dark:text-blue-400">
                      ${formatCOP(g.total)}
                    </td>

                    {/* Estado */}
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          g.estado === 'aprobado'
                            ? 'bg-emerald-50 text-[#206A3C] border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : g.estado === 'rechazado'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {g.estado === 'aprobado' ? (
                          <Check className="w-3 h-3" />
                        ) : g.estado === 'rechazado' ? (
                          <X className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{g.estado}</span>
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setGastoSeleccionado(g)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          title="Ver detalle completo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {g.estado === 'pendiente' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setModalAccion({
                                  id: g.id,
                                  accion: 'aprobado',
                                  emisor: g.emisor,
                                })
                              }
                              className="p-1.5 rounded-xl text-[#2CAE4A] hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition"
                              title="Aprobar legalización"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModalAccion({
                                  id: g.id,
                                  accion: 'rechazado',
                                  emisor: g.emisor,
                                })
                              }
                              className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                              title="Rechazar legalización"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>
              Página {paginaActual} de {totalPaginas} ({gastosOrdenados.length} facturas)
            </span>
            <div className="flex gap-1">
              <button
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                className="p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              <button
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                className="p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLES Y ZOOM DE FACTURA */}
      {gastoSeleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-zoom-out"
          onClick={() => setGastoSeleccionado(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 cursor-default max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b pb-3 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-[#07426B] dark:text-blue-400">
                    Comprobante Fiscal DIAN — Colaves
                  </span>
                  {gastoSeleccionado.confianza_extraccion && (
                    <span
                      className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                        gastoSeleccionado.confianza_extraccion === 'alta'
                          ? 'bg-emerald-100 text-[#206A3C]'
                          : 'bg-amber-100 text-amber-800'
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
                  <span>Factura: <strong>{gastoSeleccionado.numero_factura}</strong></span>
                  {gastoSeleccionado.nit_emisor && (
                    <span>NIT: <strong>{gastoSeleccionado.nit_emisor}</strong></span>
                  )}
                  <span>Fecha: <strong>{gastoSeleccionado.fecha_emision}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setGastoSeleccionado(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Imagen protegida ampliada */}
            {gastoSeleccionado.foto_url && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center max-h-[45vh] relative group">
                <SecureImage
                  src={gastoSeleccionado.foto_url}
                  alt="Factura completa"
                  className="max-h-[45vh] w-auto object-contain"
                />
              </div>
            )}

            {/* Código CUFE 96 hex con botón copiar */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2CAE4A]" />
                  CUFE DIAN (96 Hexadecimales):
                </span>
                <button
                  type="button"
                  onClick={() => copiarAlPortapapeles(gastoSeleccionado.cufe)}
                  className="flex items-center gap-1 text-[11px] text-[#07426B] dark:text-blue-400 font-bold hover:underline"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiadoCufe ? '¡Copiado!' : 'Copiar CUFE'}</span>
                </button>
              </div>
              <p className="font-mono text-[10px] text-slate-600 dark:text-slate-300 break-all bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 select-all">
                {gastoSeleccionado.cufe}
              </p>
            </div>

            {/* Desglose contable */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 text-[10px] block">Neto:</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  ${formatCOP(gastoSeleccionado.valor_neto)}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <span className="text-slate-400 text-[10px] block">IVA Liquidado:</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  ${formatCOP(gastoSeleccionado.iva)}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[#206A3C] dark:text-emerald-400 text-[10px] font-bold block">
                  Total:
                </span>
                <p className="font-black text-[#2CAE4A] text-sm">
                  ${formatCOP(gastoSeleccionado.total)}
                </p>
              </div>
            </div>

            {/* Justificación operacional */}
            <div className="text-xs space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Justificación Operativa ({gastoSeleccionado.nombre_responsable}):
              </span>
              <p className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                {gastoSeleccionado.objeto || 'Sin descripción'}
              </p>
            </div>

            {/* Trazabilidad de Auditoría */}
            {gastoSeleccionado.revisado_por && (
              <div className="text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>Auditado por: <strong>{gastoSeleccionado.revisado_por}</strong></span>
                  {gastoSeleccionado.actualizado_en && (
                    <span>{new Date(gastoSeleccionado.actualizado_en).toLocaleString('es-CO')}</span>
                  )}
                </div>
                {gastoSeleccionado.comentario_aprobacion && (
                  <p className="text-slate-700 dark:text-slate-300 pt-0.5">
                    Observación: <em>"{gastoSeleccionado.comentario_aprobacion}"</em>
                  </p>
                )}
              </div>
            )}

            {/* Botones de acción dentro del modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t dark:border-slate-800">
              <div className="flex items-center gap-2">
                {onAbrirChat && (
                  <button
                    type="button"
                    onClick={() => {
                      onAbrirChat(gastoSeleccionado);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#2CAE4A]" />
                    <span>Notificar en Google Chat</span>
                  </button>
                )}
              </div>

              {gastoSeleccionado.estado === 'pendiente' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModalAccion({
                        id: gastoSeleccionado.id,
                        accion: 'rechazado',
                        emisor: gastoSeleccionado.emisor,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Rechazar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setModalAccion({
                        id: gastoSeleccionado.id,
                        accion: 'aprobado',
                        emisor: gastoSeleccionado.emisor,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-[#2CAE4A] hover:bg-[#00984C] text-white text-xs font-bold shadow-md transition flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Aprobar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA APROBAR / RECHAZAR CON COMENTARIOS */}
      {modalAccion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setModalAccion(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 dark:border-slate-800">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {modalAccion.accion === 'aprobado'
                  ? 'Aprobar Legalización de Gasto'
                  : 'Rechazar Legalización de Gasto'}
              </h3>
              <button
                onClick={() => setModalAccion(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Factura de <strong>{modalAccion.emisor}</strong>. Ingrese la observación de auditoría contable para el trabajador:
            </p>

            <textarea
              rows={3}
              placeholder={
                modalAccion.accion === 'aprobado'
                  ? 'Observación opcional (ej: Comprobante y CUFE conformes ante DIAN).'
                  : 'Motivo obligatorio del rechazo (ej: Monto no coincide con soporte / CUFE ilegible).'
              }
              value={comentarioAccion}
              onChange={(e) => setComentarioAccion(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
            />

            {errorAccion && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                {errorAccion}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalAccion(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEjecutarAccion}
                disabled={procesandoAccion}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 ${
                  modalAccion.accion === 'aprobado'
                    ? 'bg-[#2CAE4A] hover:bg-[#00984C]'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {procesandoAccion ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    {modalAccion.accion === 'aprobado' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    <span>Confirmar {modalAccion.accion}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CATÁLOGOS */}
      {modalCatalogos && (
        <CatalogModal
          isOpen={modalCatalogos}
          onClose={() => setModalCatalogos(false)}
          catalogs={catalogs}
          onSave={onSaveCatalogs}
        />
      )}
    </div>
  );
};

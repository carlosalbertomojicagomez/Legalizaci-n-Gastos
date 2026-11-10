import React, { useState } from 'react';
import { X, Plus, Trash2, Check, RotateCcw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  catalogs: { tiposGasto: string[]; tiposPago: string[] };
  onSave: (tiposGasto: string[], tiposPago: string[]) => Promise<void>;
}

export const CatalogModal: React.FC<Props> = ({
  isOpen,
  onClose,
  catalogs,
  onSave,
}) => {
  const [tiposGasto, setTiposGasto] = useState<string[]>(catalogs.tiposGasto);
  const [tiposPago, setTiposPago] = useState<string[]>(catalogs.tiposPago);
  const [nuevoGasto, setNuevoGasto] = useState('');
  const [nuevoPago, setNuevoPago] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (!isOpen) return null;

  const agregarGasto = () => {
    const val = nuevoGasto.trim();
    if (val && !tiposGasto.includes(val)) {
      setTiposGasto([...tiposGasto, val]);
      setNuevoGasto('');
    }
  };

  const agregarPago = () => {
    const val = nuevoPago.trim();
    if (val && !tiposPago.includes(val)) {
      setTiposPago([...tiposPago, val]);
      setNuevoPago('');
    }
  };

  const eliminarGasto = (item: string) => {
    setTiposGasto(tiposGasto.filter((x) => x !== item));
  };

  const eliminarPago = (item: string) => {
    setTiposPago(tiposPago.filter((x) => x !== item));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await onSave(tiposGasto, tiposPago);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b pb-3 dark:border-slate-700">
          <div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white">
              Gestión de Catálogos Auxiliares
            </h3>
            <p className="text-xs text-slate-500">
              Configuración de opciones para trabajadores en campo
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sección Tipos de Gasto */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Tipos de Gasto ({tiposGasto.length})
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ej: Peajes / Parqueaderos..."
              value={nuevoGasto}
              onChange={(e) => setNuevoGasto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarGasto())}
              className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              onClick={agregarGasto}
              className="px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
            {tiposGasto.map((item) => (
              <span
                key={item}
                className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-600"
              >
                {item}
                <Trash2
                  className="w-3.5 h-3.5 text-rose-500 hover:text-rose-700 cursor-pointer"
                  onClick={() => eliminarGasto(item)}
                />
              </span>
            ))}
          </div>
        </div>

        {/* Sección Tipos de Pago */}
        <div className="space-y-2 pt-2 border-t dark:border-slate-700">
          <label className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Tipos de Pago ({tiposPago.length})
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ej: Tarjeta prepago..."
              value={nuevoPago}
              onChange={(e) => setNuevoPago(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregarPago())}
              className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              onClick={agregarPago}
              className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
            {tiposPago.map((item) => (
              <span
                key={item}
                className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-600"
              >
                {item}
                <Trash2
                  className="w-3.5 h-3.5 text-rose-500 hover:text-rose-700 cursor-pointer"
                  onClick={() => eliminarPago(item)}
                />
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center gap-1.5 shadow-md transition"
          >
            <Check className="w-4 h-4" />
            <span>{guardando ? 'Guardando...' : 'Aplicar Cambios'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

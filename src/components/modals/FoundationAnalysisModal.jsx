// components/modals/FoundationAnalysisModal.jsx
// ★ Sesión 14 — Fundaciones C. Dos pasos en una sola ventana:
//   1) parámetros de suelo/carga → .inp corrible (viga de fundación sobre lecho elástico).
//   2) se corre `ccx fundaciones` fuera de la app y se vuelve con el .dat → tabla de presión
//      de contacto por tramo vs σadm.
// Cuando la app migre a Tauri este paso intermedio manual desaparece (el mismo core sirve).
import { useMemo, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import {
  collectFoundationSupportModel, downloadCalculixFoundation,
  parseCalculixDatDisplacements, computeFoundationPressures,
  resolveSigmaAdm, FOUNDATION_ANALYSIS_DEFAULTS
} from '../../core/exportCalculixFoundation.js';
import Modal from '../ui/Modal.jsx';
import { Field, NumberInput, ErrorText } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export default function FoundationAnalysisModal({ open, onClose }) {
  const model = useModelStore((s) => s.model);
  const [opts, setOpts] = useState({
    nodeSpacing: FOUNDATION_ANALYSIS_DEFAULTS.nodeSpacing,
    lineLoadKgfM: FOUNDATION_ANALYSIS_DEFAULTS.lineLoadKgfM,
    padLoadKgf: FOUNDATION_ANALYSIS_DEFAULTS.padLoadKgf,
    subgradeModulusKgfCm3: FOUNDATION_ANALYSIS_DEFAULTS.subgradeModulusKgfCm3,
    includeSelfWeight: true
  });
  const [pressures, setPressures] = useState(null);
  const [error, setError] = useState('');

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
    setOpts((o) => ({ ...o, [k]: v }));
    setPressures(null);
  };

  const support = useMemo(() => {
    if (!open) return null;
    try { return collectFoundationSupportModel(model, opts); } catch (err) { return { error: err.message }; }
  }, [open, model, opts]);

  const sigmaAdm = resolveSigmaAdm(model, opts);

  const handleDat = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !support) return;
    setError('');
    try {
      const disp = parseCalculixDatDisplacements(await file.text());
      if (disp.size === 0) return setError('El archivo no contiene un bloque de desplazamientos ("displacements ... for set NFUND"). ¿Es el .dat que generó ccx?');
      setPressures(computeFoundationPressures(support, disp, opts));
    } catch (err) {
      setError(`No se pudo leer el .dat: ${err.message}`);
    }
  };

  if (!support) return null;
  const empty = !support.nodes?.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Análisis de fundaciones (CalculiX)"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        <Button variant="primary" disabled={empty} onClick={() => downloadCalculixFoundation(model, opts)}>
          Descargar fundaciones.inp
        </Button>
      </>}
    >
      <ErrorText>{error || support.error}</ErrorText>
      <p className="text-xs text-[#8a8a85] mb-3">
        Viga de fundación sobre lecho elástico: resortes verticales (balasto × área tributaria) en
        cada nodo. El modelo no tiene cargas, así que la bajada de carga del muro se ingresa acá.
      </p>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Carga de muro" hint="kgf/m">
          <NumberInput value={opts.lineLoadKgfM} onChange={set('lineLoadKgfM')} />
        </Field>
        <Field label="Carga por poyo" hint="kgf">
          <NumberInput value={opts.padLoadKgf} onChange={set('padLoadKgf')} />
        </Field>
        <Field label="Balasto por defecto" hint="kgf/cm³">
          <NumberInput value={opts.subgradeModulusKgfCm3} onChange={set('subgradeModulusKgfCm3')} />
        </Field>
        <Field label="Separación de nodos" hint="mm">
          <NumberInput value={opts.nodeSpacing} onChange={set('nodeSpacing')} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={opts.includeSelfWeight} onChange={set('includeSelfWeight')} />
        Incluir peso propio del hormigón (2500 kgf/m³)
      </label>
      <p className="text-xs text-[#8a8a85] mb-3">
        σ<sub>adm</sub> = <b>{sigmaAdm} kgf/cm²</b> {model.projectParams?.some((p) => p.name === 'sigmaAdm')
          ? '(parámetro de proyecto «sigmaAdm»)'
          : '(valor por defecto — define el parámetro de proyecto «sigmaAdm» para fijarlo)'}.
        El balasto de cada sección de librería, si está definido, manda sobre el valor de arriba.
      </p>

      {empty ? (
        <p className="text-sm text-[#8a8a85]">No hay fundaciones resueltas en el modelo.</p>
      ) : (
        <div className="text-xs text-[#5a5a55] bg-[#f7f7f4] border border-[#e4e4e0] rounded-md px-2.5 py-2 mb-3">
          {support.nodes.length} nodos · {support.runs.length} tramos corridos · {support.pads.length} poyos ·{' '}
          {(support.meta.totalLoadN / 9.80665 / 1000).toFixed(2)} tonf sobre{' '}
          {(support.meta.totalAreaMm2 / 1e6).toFixed(2)} m² de sello ·{' '}
          presión media {fmt(support.meta.meanPressureKgfCm2)} kgf/cm²
        </div>
      )}
      {support.warnings?.map((w, i) => (
        <p key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-2">{w}</p>
      ))}

      <div className="border-t border-[#e4e4e0] pt-3 mt-1">
        <p className="text-sm font-medium text-[#1a1a18] mb-1">Resultados</p>
        <p className="text-xs text-[#8a8a85] mb-2">
          Corre <code className="font-mono">ccx fundaciones</code> en tu terminal y carga acá el
          <code className="font-mono"> .dat</code> que deja. La presión de contacto se obtiene como
          balasto × asentamiento.
        </p>
        <input type="file" accept=".dat,.txt" onChange={handleDat} className="text-xs mb-3" disabled={empty} />

        {pressures && (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-[#5a5a55] border-b border-[#e4e4e0]">
                <th className="py-1">Tramo</th><th>Tipo</th>
                <th className="text-right">Asent. máx (mm)</th>
                <th className="text-right">p máx</th>
                <th className="text-right">p / σadm</th>
                <th className="text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {pressures.rows.map((r) => (
                <tr key={`${r.kind}-${r.elementId}`} className="border-b border-[#f0f0ec]">
                  <td className="py-1">F{r.elementId}</td>
                  <td className="font-sans">{r.kind}</td>
                  <td className="text-right">{fmt(r.settleMaxMm, 3)}</td>
                  <td className="text-right">{fmt(r.pMaxKgfCm2)}</td>
                  <td className="text-right">{fmt(r.ratio)}</td>
                  <td className={`text-right font-sans ${r.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                    {r.ok ? 'OK' : 'EXCEDE'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pressures?.missingNodes.length > 0 && (
          <p className="text-xs text-amber-800 mt-2">
            {pressures.missingNodes.length} nodos del modelo no aparecen en el .dat — ¿el .dat
            corresponde a este mismo .inp (mismos parámetros)?
          </p>
        )}
      </div>
    </Modal>
  );
}

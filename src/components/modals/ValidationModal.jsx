// components/modals/ValidationModal.jsx
import { useMemo, useState } from 'react';
import { useModelStore } from '../../store/useModelStore.js';
import { evaluateModelReview } from '../../core/modelReview.js';
import { downloadReviewMarkdown } from '../../core/reportMarkdown.js';
import {
  groupFindingsBySeverity,
  presentFinding,
  resolveFindingNavigation
} from '../../core/domainFindingPresentation.js';
import Modal from '../ui/Modal.jsx';
import { NumberInput } from '../ui/Field.jsx';
import { Button } from '../ui/Button.jsx';

const SECTION_UI = {
  error: {
    title: 'Errores',
    suffix: ' — bloquean una exportación confiable',
    heading: 'text-red-700',
    row: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    action: 'text-red-700'
  },
  warning: {
    title: 'Advertencias',
    suffix: '',
    heading: 'text-amber-700',
    row: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    action: 'text-amber-700'
  },
  info: {
    title: 'Información',
    suffix: '',
    heading: 'text-[#5a5a55]',
    row: 'bg-[#f2f2ee] border-[#e4e4e0]',
    text: 'text-[#3d3d38]',
    action: 'text-[#5a5a55]'
  }
};

const CONNECTIVITY_CATEGORIES = new Set([
  'Sin apoyo',
  'Sin conexión superior',
  'Extremo sin apoyo'
]);
const EMPTY_REVIEW = Object.freeze({ findings: [] });

function FindingRow({ finding, onNavigate }) {
  const presented = presentFinding(finding);
  const ui = SECTION_UI[finding.severity];
  const isCriticalConnectivity = CONNECTIVITY_CATEGORIES.has(finding.category);
  const hasDetails = (
    presented.ruleTitle
    || presented.measuredText
    || presented.limitText
    || presented.sources.length > 0
  );

  return (
    <li className={`text-sm border rounded-md px-3 py-2 flex justify-between items-start gap-3 ${ui.row}`}>
      <div className={ui.text}>
        <div><span className="font-medium">{finding.category}: </span>{finding.message}</div>
        {isCriticalConnectivity && (
          <div className="mt-1 text-xs font-medium">Crítico para CalculiX</div>
        )}
        {hasDetails && (
          <div className="mt-1.5 space-y-0.5 text-xs">
            {presented.ruleTitle && (
              <div><span className="font-medium">Regla:</span> {presented.ruleTitle} <span className="opacity-70">({presented.ruleId})</span></div>
            )}
            {presented.measuredText && (
              <div><span className="font-medium">Medida:</span> {presented.measuredText}</div>
            )}
            {presented.limitText && (
              <div><span className="font-medium">Límite:</span> {presented.limitText}</div>
            )}
            {presented.sources.map((source) => (
              <div key={`${source.doc}:${source.url}`}>
                <span className="font-medium">Fuente:</span>{' '}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {source.doc} — {source.ed}; {source.seccion}
                </a>
                <span className="opacity-70"> (consulta {source.consultado})</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {presented.navigation && (
        <button
          className={`hover:underline text-xs shrink-0 ${ui.action}`}
          onClick={() => onNavigate(finding)}
        >
          {presented.navigation.label}
        </button>
      )}
    </li>
  );
}

export default function ValidationModal({ open, onClose, canvasSize }) {
  const model = useModelStore((s) => s.model);
  const centerOnElement = useModelStore((s) => s.centerOnElement);
  const selectRoofSystem = useModelStore((s) => s.selectRoofSystem);
  const selectRoofPlane = useModelStore((s) => s.selectRoofPlane);
  const [extraMargin, setExtraMargin] = useState(0);

  const normalizedExtraMargin = Number(extraMargin) || 0;
  const review = useMemo(
    () => (open ? evaluateModelReview(model, normalizedExtraMargin) : EMPTY_REVIEW),
    [open, model, normalizedExtraMargin]
  );
  const findings = review.findings;
  const sections = groupFindingsBySeverity(findings);
  const totalCount = findings.length;

  const exportReport = () => {
    downloadReviewMarkdown(review, { projectInfo: model.projectInfo });
  };

  const goToFinding = (finding) => {
    const target = resolveFindingNavigation(finding);
    if (!target) return;
    if (target.kind === 'roofPlane') selectRoofPlane(target.id);
    else if (target.kind === 'roofSystem') selectRoofSystem(target.id);
    else centerOnElement(target.id, canvasSize.width, canvasSize.height);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Verificación de coherencia geométrica"
      width="max-w-lg"
      footer={(
        <>
          <Button onClick={exportReport}>Exportar informe (.md)</Button>
          <Button variant="primary" onClick={onClose}>Cerrar</Button>
        </>
      )}
    >
      <div className="flex items-end gap-3 mb-4 bg-[#f2f2ee] border border-[#e4e4e0] rounded-md px-3 py-2.5">
        <label className="text-sm flex-1">
          <span className="block font-medium text-[#3d3d38] mb-1">Margen extra de conectividad</span>
          <span className="block text-xs text-[#8a8a85] mb-1.5">Se suma a la tolerancia (ya calculada por el ancho real de cada par de elementos). Súbelo si tienes ménsulas o desfases intencionales.</span>
          <NumberInput value={extraMargin} onChange={(e) => setExtraMargin(e.target.value)} className="w-28" />
          <span className="text-xs text-[#8a8a85] ml-2">mm</span>
        </label>
      </div>

      {totalCount === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm font-medium text-[#1a1a18]">Sin problemas detectados.</p>
          <p className="text-xs text-[#8a8a85] mt-1">Referencias, largos, traslapes, conectividad, vanos y techumbre revisados — el modelo está geométricamente sano.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.filter((section) => section.findings.length > 0).map((section) => {
            const ui = SECTION_UI[section.severity];
            return (
              <div key={section.severity}>
                <h3 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${ui.heading}`}>
                  {ui.title} ({section.findings.length}){ui.suffix}
                </h3>
                <ul className="space-y-1.5">
                  {section.findings.map((finding, i) => (
                    <FindingRow
                      key={i}
                      finding={finding}
                      onNavigate={goToFinding}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

import {
  structuralConcept,
  structuralConceptCategories,
  structuralConceptOptions
} from '../core/structuralConceptGlossary.js';

export function StructuralConceptHint({ scope, value, compact = false }) {
  const concept = structuralConcept(scope, value);
  if (!concept) return null;
  return (
    <div className={`rounded border border-[#dddcd5] bg-[#fafaf7] text-[#55554f] ${compact ? 'mt-1 p-2 text-[11px]' : 'mt-2 p-3 text-xs'}`}>
      <div><strong>Qué declara:</strong> {concept.declares}</div>
      {!compact && <div className="mt-1"><strong>Efecto:</strong> {concept.effect}</div>}
      <div className="mt-1"><strong>No significa:</strong> {concept.notMeans}</div>
    </div>
  );
}

export function StructuralConceptGlossaryPanel() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#deded8] bg-white p-4">
        <h3 className="font-semibold">Glosario estructural del Modelador</h3>
        <p className="mt-1 text-sm text-[#66665f]">
          Cada concepto separa lo que declara el usuario, el efecto que habilita en los motores y lo que deliberadamente no puede inferirse.
        </p>
      </div>
      {structuralConceptCategories().map((category) => (
        <section key={category.scope} className="rounded-lg border border-[#deded8] bg-white p-4">
          <h4 className="font-semibold">{category.title}</h4>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {structuralConceptOptions(category.scope).map(({ value, label }) => {
              const concept = structuralConcept(category.scope, value);
              return (
                <article key={value} className="rounded-lg border border-[#e5e5df] p-3">
                  <div className="font-medium">{label}</div>
                  <p className="mt-1 text-sm text-[#55554f]">{concept.meaning}</p>
                  <dl className="mt-3 space-y-2 text-xs text-[#66665f]">
                    <div><dt className="inline font-semibold text-[#383834]">Qué declara: </dt><dd className="inline">{concept.declares}</dd></div>
                    <div><dt className="inline font-semibold text-[#383834]">Efecto: </dt><dd className="inline">{concept.effect}</dd></div>
                    <div><dt className="inline font-semibold text-[#383834]">No significa: </dt><dd className="inline">{concept.notMeans}</dd></div>
                    {concept.provenance && <div><dt className="inline font-semibold text-[#383834]">Procedencia: </dt><dd className="inline">{concept.provenance}</dd></div>}
                  </dl>
                  <details className="mt-2 text-xs text-[#77776f]"><summary className="cursor-pointer">Referencia interna</summary><code>{category.scope}:{value}</code></details>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

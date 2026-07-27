// components/ui/Field.jsx
import { useMemo, useRef, useState } from 'react';
import { resolveValue } from '../../core/projectParams.js';
import { isElementRef } from '../../core/elementReferences.js';
import { getElementShortLabel } from '../../core/naming.js';

const inputBase = 'w-full border border-[#e4e4e0] rounded-md px-2.5 py-1.5 text-sm text-[#1a1a18] focus:outline-none focus:ring-2 focus:ring-[#3d3d3855] focus:border-[#3d3d38] disabled:bg-[#f2f2ee] disabled:text-[#8a8a85]';
const numericBase = 'font-mono';

export function Field({ label, hint, children }) {
  return (
    <label className="block text-sm mb-3">
      <span className="block font-medium text-[#1a1a18] mb-1">
        {label}
        {hint && <span className="font-normal text-xs text-[#8a8a85] ml-1.5">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput({ className = '', ...props }) {
  return <input {...props} className={`${inputBase} ${className}`} />;
}

export function NumberInput({ className = '', onFocus, ...props }) {
  // ★ Fix: se usa type="text" + inputMode="decimal" en vez de type="number". Los inputs
  // number controlados en React tienen un bug conocido (facebook/react#7359): el DOM no
  // siempre resincroniza el texto mostrado tras cada tecla, aunque el valor numérico interno
  // ya haya cambiado — se veía como "031000" en vez de "31000" al escribir sobre un 0 inicial.
  // Con type="text" no existe esa capa de parseo/normalización nativa, así que el problema
  // desaparece de raíz. El teclado numérico en móvil sigue apareciendo gracias a inputMode.
  // onFocus selecciona todo el contenido como resguardo adicional (reemplaza en vez de insertar).
  return (
    <input
      type="text"
      inputMode="decimal"
      {...props}
      onFocus={(e) => { e.target.select(); onFocus?.(e); }}
      className={`${inputBase} ${numericBase} ${className}`}
    />
  );
}

export function SelectInput({ className = '', children, ...props }) {
  return (
    <select {...props} className={`${inputBase} bg-white ${className}`}>
      {children}
    </select>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5 mb-3">{children}</p>;
}

/**
 * Campo numérico que además acepta fórmulas de parámetro de proyecto: "=nombre" o "=nombre + 20".
 * `value` es el valor crudo guardado en el elemento (number o string "=..."); `onChange` recibe ese mismo crudo.
 * `paramsMap` es el mapa {nombre: valor} construido con buildParamsMap(model.projectParams).
 *
 * ★ Autocompletado: mientras se escribe una fórmula, sugiere los nombres de parámetro de
 * proyecto que calzan con lo que se está tecleando (útil cuando hay muchos y cuesta recordarlos).
 * `projectParams` (opcional, array completo {name,value,unit,description}) permite mostrar
 * también la unidad en la sugerencia; si se omite, igual funciona solo con los nombres.
 */
export function FormulaInput({ value, onChange, paramsMap = {}, elementsById = {}, projectParams = null, className = '', ...props }) {
  const raw = value ?? '';
  const formula = typeof raw === 'string' && raw.trim().startsWith('=');
  const resolved = formula ? resolveValue(raw, paramsMap, elementsById) : null;
  const invalid = formula && !isFinite(resolved);

  const inputRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [tokenRange, setTokenRange] = useState(null); // {start, end} en `raw` a reemplazar
  const [highlight, setHighlight] = useState(0);

  const paramNames = useMemo(() => Object.keys(paramsMap), [paramsMap]);
  const unitByName = useMemo(() => {
    const m = {};
    for (const p of projectParams || []) m[p.name] = p.unit;
    return m;
  }, [projectParams]);

  const suggestOpen = formula && suggestions.length > 0;

  // Encuentra el identificador parcial justo antes del cursor (o "" si el cursor
  // viene justo después de '=' u operador, momento en que también corresponde sugerir).
  const computeToken = (text, pos) => {
    const before = text.slice(0, pos);
    const m = before.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
    if (m) return { partial: m[0], start: pos - m[0].length, end: pos };
    if (/[=+\-*/(\s]$/.test(before) || before.trim() === '=') return { partial: '', start: pos, end: pos };
    return null;
  };

  const refreshSuggestions = (text, pos) => {
    if (typeof text !== 'string' || !text.trim().startsWith('=')) { setSuggestions([]); return; }
    const token = computeToken(text, pos);
    if (!token) { setSuggestions([]); return; }
    const matches = paramNames.filter(
      (n) => n.toLowerCase().startsWith(token.partial.toLowerCase()) && n !== token.partial
    );
    setTokenRange({ start: token.start, end: token.end });
    setSuggestions(matches);
    setHighlight(0);
  };

  const applySuggestion = (name) => {
    if (!tokenRange) return;
    const next = raw.slice(0, tokenRange.start) + name + raw.slice(tokenRange.end);
    onChange(next);
    setSuggestions([]);
    const el = inputRef.current;
    requestAnimationFrame(() => {
      if (!el) return;
      const p = tokenRange.start + name.length;
      el.focus();
      el.setSelectionRange(p, p);
    });
  };

  const handleChange = (e) => {
    const text = e.target.value;
    const pos = e.target.selectionStart ?? text.length;
    onChange(text);
    refreshSuggestions(text, pos);
  };

  const handleKeyDown = (e) => {
    if (!suggestOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[highlight]); }
    else if (e.key === 'Escape') { setSuggestions([]); }
  };

  return (
    <div className="relative">
      <input
        {...props}
        ref={inputRef}
        type="text"
        value={raw}
        autoComplete="off"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setSuggestions([]), 120)}
        className={`${inputBase} ${numericBase} ${invalid ? 'border-red-300' : ''} ${className}`}
        placeholder="150 o =espesor_tabique"
      />
      {suggestOpen && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-[#e4e4e0] rounded-md shadow-md text-sm">
          {suggestions.map((name, i) => (
            <li
              key={name}
              onMouseDown={(e) => { e.preventDefault(); applySuggestion(name); }}
              className={`px-2.5 py-1.5 cursor-pointer flex justify-between gap-3 ${i === highlight ? 'bg-[#f2f2ee]' : ''}`}
            >
              <span className="font-mono text-[#1a1a18]">{name}</span>
              <span className="text-[#8a8a85]">{paramsMap[name]}{unitByName[name] ? ` ${unitByName[name]}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {formula && (
        <p className={`text-xs mt-1 ${invalid ? 'text-red-700' : 'text-[#8a8a85]'}`}>
          {invalid ? 'Parámetro desconocido o fórmula inválida' : `= ${resolved}`}
        </p>
      )}
    </div>
  );
}

const REF_PREFIX = 'ref::';
function encodeRefOption(refElementId, edge) { return `${REF_PREFIX}${refElementId}::${edge}`; }
function decodeRefOption(opt) {
  const [, refElementId, edge] = opt.split('::');
  return { refElementId, edge };
}

/**
 * ★ Campo de eje (Tanda 3, ítem 2): selecciona un eje de la grilla, o una referencia
 * al borde/centro de otro elemento ("esta viga llega hasta el borde del último pilar").
 * `value` es el crudo guardado (ID de eje string, o {refElementId, edge}); `onChange` recibe ese mismo crudo.
 * `axes`: array de ejes de la grilla en el eje correspondiente (grid.xAxes o grid.yAxes).
 * `elements`: todos los elementos del modelo (para el grupo de referencias); `excludeElementId` oculta el propio elemento en edición.
 * `grid`: necesario para etiquetar los elementos referenciables (getElementShortLabel).
 */
export function AxisRefSelect({ value, onChange, axes, elements = [], excludeElementId, grid, className = '', ...props }) {
  const refValue = isElementRef(value) ? encodeRefOption(value.refElementId, value.edge) : (value ?? '');
  const refElements = elements.filter(el => el.id !== excludeElementId);

  return (
    <select
      {...props}
      value={refValue}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw.startsWith(REF_PREFIX) ? decodeRefOption(raw) : raw);
      }}
      className={`${inputBase} bg-white ${className}`}
    >
      <option value="" disabled>Seleccionar…</option>
      <optgroup label="Ejes">
        {axes.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
      </optgroup>
      {refElements.map(el => (
        <optgroup key={el.id} label={`Ref: ${getElementShortLabel(el, grid)}`}>
          <option value={encodeRefOption(el.id, 'min')}>↳ borde mínimo</option>
          <option value={encodeRefOption(el.id, 'max')}>↳ borde máximo</option>
          <option value={encodeRefOption(el.id, 'center')}>↳ centro</option>
        </optgroup>
      ))}
    </select>
  );
}

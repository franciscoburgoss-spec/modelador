const READY_SELECTOR = '[data-modelador-ready="true"]';

function failureMessage(value) {
  if (value && typeof value.message === 'string' && value.message.trim()) {
    return value.message;
  }
  if (typeof value === 'string' && value.trim()) return value;
  return 'Error de arranque no identificado.';
}

export function installBootGuard(targetWindow, targetDocument) {
  let active = true;

  const showFailure = (value) => {
    if (!active || targetDocument.querySelector(READY_SELECTOR)) return;
    const root = targetDocument.getElementById('root');
    if (!root) return;

    while (root.firstChild) root.removeChild(root.firstChild);
    const alert = targetDocument.createElement('section');
    alert.id = 'modelador-boot-error';
    alert.setAttribute('role', 'alert');
    alert.style.cssText = [
      'margin:24px',
      'padding:20px',
      'border:1px solid #fecaca',
      'border-radius:8px',
      'background:#fef2f2',
      'color:#991b1b',
      'font:14px system-ui,sans-serif',
      'white-space:pre-wrap'
    ].join(';');
    alert.textContent = [
      'Modelador no pudo iniciar.',
      '',
      failureMessage(value),
      '',
      'Cierra la aplicación y vuelve a abrirla. Si el problema continúa, conserva este mensaje.'
    ].join('\n');
    root.appendChild(alert);
  };

  const onError = (event) => showFailure(event.error || event.message);
  const onUnhandledRejection = (event) => showFailure(event.reason);
  targetWindow.addEventListener('error', onError);
  targetWindow.addEventListener('unhandledrejection', onUnhandledRejection);

  return {
    dispose() {
      if (!active) return;
      active = false;
      targetWindow.removeEventListener('error', onError);
      targetWindow.removeEventListener('unhandledrejection', onUnhandledRejection);
    },
    showFailure
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const guard = installBootGuard(window, document);
  window.__MODELADOR_COMPLETE_BOOT__ = () => {
    guard.dispose();
    delete window.__MODELADOR_COMPLETE_BOOT__;
  };
}

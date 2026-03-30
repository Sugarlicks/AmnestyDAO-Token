import { boot } from 'quasar/wrappers';

export default boot(() => {
  const g: any = (typeof globalThis !== 'undefined') ? (globalThis as any) : (window as any);

  // Ensure process global exists and has version fields
  const p: any = g.process || {};
  if (!p.versions || typeof p.versions !== 'object') {
    p.versions = {};
  }
  if (typeof p.versions.node !== 'string') {
    p.versions.node = '18.0.0';
  }
  if (typeof p.version !== 'string') {
    p.version = 'v18.0.0';
  }
  g.process = p;

});



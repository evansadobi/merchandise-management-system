export default function ComingSoonView({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="text-4xl mb-4">🚧</div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">{moduleName}</h2>
      <p className="text-slate-500 max-w-md mb-6">
        This module is part of a future project phase and is currently hidden behind feature flags as per system requirements.
      </p>
      <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
        Status: Locked / Coming Soon
      </span>
    </div>
  );
}
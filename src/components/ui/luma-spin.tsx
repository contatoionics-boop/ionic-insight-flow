export const LumaSpin = ({ size = 65 }: { size?: number }) => {
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Carregando"
    >
      <span className="absolute block animate-loaderAnim rounded-md bg-primary" />
      <span className="absolute block animate-loaderAnim animation-delay rounded-md bg-primary/60" />
      <style>{`
        @keyframes loaderAnim {
          0%   { inset: 0 35px 35px 0; }
          12.5%{ inset: 0 35px 0 0; }
          25%  { inset: 35px 35px 0 0; }
          37.5%{ inset: 35px 0 0 0; }
          50%  { inset: 35px 0 0 35px; }
          62.5%{ inset: 0 0 0 35px; }
          75%  { inset: 0 0 35px 35px; }
          87.5%{ inset: 0 0 35px 0; }
          100% { inset: 0 35px 35px 0; }
        }
        .animate-loaderAnim { animation: loaderAnim 2.5s infinite; }
        .animation-delay { animation-delay: -1.25s; }
      `}</style>
    </div>
  );
};

export default LumaSpin;

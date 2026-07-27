// components/ui/Button.jsx
const VARIANTS = {
  primary: 'bg-[#3d3d38] hover:bg-[#26251f] text-white',
  secondary: 'border border-[#d8d8d3] text-[#5a5a55] hover:bg-[#f2f2ee] hover:text-[#1a1a18]',
  danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
};

export function Button({ variant = 'secondary', className = '', ...props }) {
  return (
    <button
      {...props}
      className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

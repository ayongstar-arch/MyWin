import React from 'react';

interface MetricsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

const MetricsCard: React.FC<MetricsCardProps> = ({ label, value, subValue, color = "text-white" }) => {
  return (
    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
      <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {subValue && <div className="text-slate-500 text-xs mt-1">{subValue}</div>}
    </div>
  );
};

export default MetricsCard;

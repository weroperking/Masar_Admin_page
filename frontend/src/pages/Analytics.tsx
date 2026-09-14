import { LineChart, BarChart } from 'lucide-react';

export function Analytics() {
  return (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Analytics</h1>
        <p className="text-neutral-500 mt-1">Platform usage and product metrics.</p>
      </div>
      
      <div className="flex-1 bg-white border border-neutral-200 rounded-xl flex flex-col items-center justify-center text-center p-8 shadow-sm">
        <div className="flex gap-4 mb-6">
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-400">
            <LineChart className="w-8 h-8" />
          </div>
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-400">
            <BarChart className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-xl font-medium text-neutral-900 mb-2">PostHog Integration Pending</h2>
        <p className="text-neutral-500 max-w-md">
          This page is reserved for your PostHog analytics dashboard iframe. 
          Configure the embed URL in the environment variables to activate this view.
        </p>
      </div>
    </div>
  );
}

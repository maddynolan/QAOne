import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Users,
  BarChart3,
  LineChart,
} from 'lucide-react';

export type WorkloadModelType =
  | 'constant_vus'
  | 'ramping_vus'
  | 'per_vu_iterations'
  | 'shared_iterations'
  | 'constant_arrival_rate'
  | 'ramping_arrival_rate';

export interface WorkloadModelSelectorProps {
  selected: WorkloadModelType;
  onSelect: (model: WorkloadModelType) => void;
  virtualUsers: number;
  onVirtualUsersChange: (vus: number) => void;
  duration: number;
  onDurationChange: (duration: number) => void;
  iterations: number;
  onIterationsChange: (iterations: number) => void;
  arrivalRate?: number;
  onArrivalRateChange?: (rate: number) => void;
}

const ICON_MAP: Record<WorkloadModelType, React.ReactNode> = {
  constant_vus: <ArrowRight className="h-5 w-5" />,
  ramping_vus: <TrendingUp className="h-5 w-5" />,
  per_vu_iterations: <RefreshCw className="h-5 w-5" />,
  shared_iterations: <Users className="h-5 w-5" />,
  constant_arrival_rate: <BarChart3 className="h-5 w-5" />,
  ramping_arrival_rate: <LineChart className="h-5 w-5" />,
};

const WORKLOAD_MODELS: {
  id: WorkloadModelType;
  name: string;
  description: string;
  fields: string[];
  color: string;
}[] = [
  {
    id: 'constant_vus',
    name: 'Constant VUs',
    description: 'Fixed number of virtual users for the entire test duration',
    fields: ['virtualUsers', 'duration'],
    color: 'border-blue-500',
  },
  {
    id: 'ramping_vus',
    name: 'Ramping VUs',
    description: 'VUs increase/decrease in stages over time',
    fields: ['stages'],
    color: 'border-green-500',
  },
  {
    id: 'per_vu_iterations',
    name: 'Per-VU Iterations',
    description: 'Each VU runs exactly N iterations then stops',
    fields: ['virtualUsers', 'iterations'],
    color: 'border-purple-500',
  },
  {
    id: 'shared_iterations',
    name: 'Shared Iterations',
    description: 'Total iterations shared across all VUs',
    fields: ['virtualUsers', 'iterations'],
    color: 'border-orange-500',
  },
  {
    id: 'constant_arrival_rate',
    name: 'Constant Arrival Rate',
    description: 'Fixed requests/second regardless of response time',
    fields: ['arrivalRate', 'duration', 'virtualUsers'],
    color: 'border-cyan-500',
  },
  {
    id: 'ramping_arrival_rate',
    name: 'Ramping Arrival Rate',
    description: 'Requests/second changes in stages over time',
    fields: ['stages'],
    color: 'border-pink-500',
  },
];

export default function WorkloadModelSelector({
  selected,
  onSelect,
  virtualUsers,
  onVirtualUsersChange,
  duration,
  onDurationChange,
  iterations,
  onIterationsChange,
  arrivalRate,
  onArrivalRateChange,
}: WorkloadModelSelectorProps) {
  const selectedModel = WORKLOAD_MODELS.find((m) => m.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Workload Model</h3>
        <Badge variant="outline" className="text-xs">
          k6 compatible
        </Badge>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {WORKLOAD_MODELS.map((model) => {
          const isSelected = selected === model.id;
          return (
            <Card
              key={model.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected
                  ? `${model.color} border-2 bg-accent/50`
                  : 'border border-border hover:border-muted-foreground/40'
              }`}
              onClick={() => onSelect(model.id)}
            >
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    }
                  >
                    {ICON_MAP[model.id]}
                  </span>
                  <span className="text-sm font-medium leading-tight">
                    {model.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {model.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuration Fields */}
      {selectedModel && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">
              Configure: {selectedModel.name}
            </h4>

            {selected === 'constant_vus' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wm-vus">Virtual Users</Label>
                  <Input
                    id="wm-vus"
                    type="number"
                    min={1}
                    max={10000}
                    value={virtualUsers}
                    onChange={(e) =>
                      onVirtualUsersChange(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wm-dur">Duration (seconds)</Label>
                  <Input
                    id="wm-dur"
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) =>
                      onDurationChange(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
              </div>
            )}

            {selected === 'ramping_vus' && (
              <p className="text-sm text-muted-foreground">
                Configure stages in the Stages Editor below.
              </p>
            )}

            {selected === 'per_vu_iterations' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wm-vus-pv">Virtual Users</Label>
                  <Input
                    id="wm-vus-pv"
                    type="number"
                    min={1}
                    max={10000}
                    value={virtualUsers}
                    onChange={(e) =>
                      onVirtualUsersChange(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wm-iter-pv">Iterations per VU</Label>
                  <Input
                    id="wm-iter-pv"
                    type="number"
                    min={1}
                    value={iterations}
                    onChange={(e) =>
                      onIterationsChange(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
              </div>
            )}

            {selected === 'shared_iterations' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wm-vus-si">Virtual Users</Label>
                  <Input
                    id="wm-vus-si"
                    type="number"
                    min={1}
                    max={10000}
                    value={virtualUsers}
                    onChange={(e) =>
                      onVirtualUsersChange(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wm-iter-si">Total Iterations</Label>
                  <Input
                    id="wm-iter-si"
                    type="number"
                    min={1}
                    value={iterations}
                    onChange={(e) =>
                      onIterationsChange(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
              </div>
            )}

            {selected === 'constant_arrival_rate' && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wm-rate">Rate (req/s)</Label>
                  <Input
                    id="wm-rate"
                    type="number"
                    min={1}
                    value={arrivalRate ?? 10}
                    onChange={(e) =>
                      onArrivalRateChange?.(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wm-dur-ar">Duration (seconds)</Label>
                  <Input
                    id="wm-dur-ar"
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) =>
                      onDurationChange(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wm-maxvus">Max VUs (pre-allocated)</Label>
                  <Input
                    id="wm-maxvus"
                    type="number"
                    min={1}
                    max={10000}
                    value={virtualUsers}
                    onChange={(e) =>
                      onVirtualUsersChange(parseInt(e.target.value) || 1)
                    }
                  />
                </div>
              </div>
            )}

            {selected === 'ramping_arrival_rate' && (
              <p className="text-sm text-muted-foreground">
                Configure stages in the Stages Editor below.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

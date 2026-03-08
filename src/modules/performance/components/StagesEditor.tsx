import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Plus,
  Trash2,
  TrendingUp,
  Activity,
  Zap,
  Flame,
  Timer,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface Stage {
  duration: number;
  target: number;
}

export interface StagesEditorProps {
  stages: Stage[];
  onStagesChange: (stages: Stage[]) => void;
  targetLabel?: string;
}

const PRESETS: { name: string; icon: React.ReactNode; stages: Stage[] }[] = [
  {
    name: 'Ramp Up',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    stages: [
      { duration: 30, target: 10 },
      { duration: 60, target: 50 },
      { duration: 30, target: 50 },
    ],
  },
  {
    name: 'Ramp Up/Down',
    icon: <Activity className="h-3.5 w-3.5" />,
    stages: [
      { duration: 30, target: 10 },
      { duration: 60, target: 50 },
      { duration: 60, target: 50 },
      { duration: 30, target: 10 },
    ],
  },
  {
    name: 'Spike',
    icon: <Zap className="h-3.5 w-3.5" />,
    stages: [
      { duration: 10, target: 5 },
      { duration: 5, target: 200 },
      { duration: 30, target: 200 },
      { duration: 5, target: 5 },
      { duration: 30, target: 5 },
    ],
  },
  {
    name: 'Stress',
    icon: <Flame className="h-3.5 w-3.5" />,
    stages: [
      { duration: 30, target: 20 },
      { duration: 60, target: 50 },
      { duration: 60, target: 100 },
      { duration: 60, target: 150 },
      { duration: 30, target: 0 },
    ],
  },
  {
    name: 'Soak',
    icon: <Timer className="h-3.5 w-3.5" />,
    stages: [
      { duration: 60, target: 30 },
      { duration: 600, target: 30 },
      { duration: 60, target: 0 },
    ],
  },
];

function stagesToChartData(
  stages: Stage[]
): { time: number; target: number }[] {
  const data: { time: number; target: number }[] = [];
  let currentTime = 0;

  data.push({ time: 0, target: 0 });
  stages.forEach((stage) => {
    currentTime += stage.duration;
    data.push({ time: currentTime, target: stage.target });
  });
  return data;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function getRampIcon(current: number, previous: number) {
  if (current > previous)
    return <ArrowUp className="h-4 w-4 text-green-500" />;
  if (current < previous)
    return <ArrowDown className="h-4 w-4 text-red-500" />;
  return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
}

export default function StagesEditor({
  stages,
  onStagesChange,
  targetLabel = 'VUs',
}: StagesEditorProps) {
  const chartData = useMemo(() => stagesToChartData(stages), [stages]);
  const totalDuration = useMemo(
    () => stages.reduce((sum, s) => sum + s.duration, 0),
    [stages]
  );

  const updateStage = (index: number, field: keyof Stage, value: number) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    onStagesChange(updated);
  };

  const deleteStage = (index: number) => {
    onStagesChange(stages.filter((_, i) => i !== index));
  };

  const addStage = () => {
    const lastTarget = stages.length > 0 ? stages[stages.length - 1].target : 0;
    onStagesChange([...stages, { duration: 30, target: lastTarget }]);
  };

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Presets</Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => onStagesChange(preset.stages)}
            >
              {preset.icon}
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Stages Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Stages</Label>
          <Badge variant="secondary" className="text-xs">
            Total: {formatDuration(totalDuration)}
          </Badge>
        </div>

        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No stages defined. Select a preset or add a stage manually.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[40px_1fr_1fr_32px_32px] gap-2 px-1 text-xs text-muted-foreground font-medium">
              <span>#</span>
              <span>Duration (s)</span>
              <span>Target ({targetLabel})</span>
              <span></span>
              <span></span>
            </div>

            {/* Rows */}
            {stages.map((stage, index) => {
              const prevTarget = index > 0 ? stages[index - 1].target : 0;
              return (
                <div
                  key={index}
                  className="grid grid-cols-[40px_1fr_1fr_32px_32px] gap-2 items-center"
                >
                  <span className="text-xs text-muted-foreground font-mono text-center">
                    {index + 1}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={stage.duration}
                    onChange={(e) =>
                      updateStage(
                        index,
                        'duration',
                        parseInt(e.target.value) || 1
                      )
                    }
                    className="h-8 text-sm"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={stage.target}
                    onChange={(e) =>
                      updateStage(
                        index,
                        'target',
                        parseInt(e.target.value) || 0
                      )
                    }
                    className="h-8 text-sm"
                  />
                  <div className="flex justify-center">
                    {getRampIcon(stage.target, prevTarget)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteStage(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={addStage}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Stage
        </Button>
      </div>

      {/* Visual Preview */}
      {stages.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Stage Preview</Label>
              <Badge variant="outline" className="text-xs">
                {formatDuration(totalDuration)}
              </Badge>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="stageGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}s`}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    label={{
                      value: targetLabel,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11 },
                    }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value} ${targetLabel}`,
                      'Target',
                    ]}
                    labelFormatter={(label) => `Time: ${label}s`}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Area
                    type="linear"
                    dataKey="target"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#stageGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

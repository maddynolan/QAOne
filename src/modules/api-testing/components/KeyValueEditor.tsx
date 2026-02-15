/**
 * KeyValueEditor - reusable key-value pair editor for headers and params.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { KeyValuePair } from "./constants";

export function KeyValueEditor({
  pairs,
  onUpdate,
  onToggle,
  onAdd,
  onRemove,
  keyPlaceholder,
  valuePlaceholder,
}: {
  pairs: KeyValuePair[];
  onUpdate: (index: number, key: string, value: string) => void;
  onToggle: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  return (
    <div className="space-y-2">
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pair.enabled}
            onChange={() => onToggle(i)}
            className="cursor-pointer"
          />
          <Input
            className="flex-1 h-8 text-sm font-mono"
            placeholder={keyPlaceholder}
            value={pair.key}
            onChange={e => onUpdate(i, "key", e.target.value)}
          />
          <Input
            className="flex-1 h-8 text-sm font-mono"
            placeholder={valuePlaceholder}
            value={pair.value}
            onChange={e => onUpdate(i, "value", e.target.value)}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
            onClick={() => onRemove(i)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="w-3 h-3 mr-1" />
        Add Row
      </Button>
    </div>
  );
}

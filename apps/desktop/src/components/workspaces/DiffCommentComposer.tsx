import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface DiffCommentComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function DiffCommentComposer({ value, onChange, onSave, onCancel }: DiffCommentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-2 border-y border-border bg-zinc-950/40 p-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-h-20 rounded border border-border bg-background p-2 text-xs font-mono text-foreground"
        placeholder="Add review comment (Markdown supported)"
      />
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSave}>
          Save comment
        </Button>
      </div>
    </div>
  );
}

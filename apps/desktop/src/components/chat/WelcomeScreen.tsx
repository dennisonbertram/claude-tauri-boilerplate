import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
  onNewChat: () => void;
}

export function WelcomeScreen({ onNewChat }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
          ◆
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Claude Code
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
          Start a conversation to work with Claude on your code. Each conversation is saved and can be resumed at any time.
        </p>
      </div>

      <Button onClick={onNewChat} size="lg" className="gap-2 px-8">
        <span>New Conversation</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘N
        </kbd>
      </Button>
    </div>
  );
}

import { Bank } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useConnectBank } from '@/hooks/usePlaid';

interface ConnectBankButtonProps {
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function ConnectBankButton({
  onSuccess,
  variant = 'default',
  size = 'default',
  className,
}: ConnectBankButtonProps) {
  const { connect, isConnecting, error } = useConnectBank();

  const handleClick = async () => {
    const session = await connect();
    if (session) {
      onSuccess?.();
    }
  };

  return (
    <div className={className}>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isConnecting}
      >
        <Bank className="h-4 w-4" data-icon="inline-start" />
        {isConnecting ? 'Connecting...' : 'Connect Bank Account'}
      </Button>
      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}

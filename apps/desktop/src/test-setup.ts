import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { registerDefaultToolRenderers } from '@/components/chat/gen-ui/defaultRenderers';

beforeEach(() => {
  registerDefaultToolRenderers();
});
